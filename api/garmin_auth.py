"""Private Vercel function for the Garmin credential and MFA exchange."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from garminconnect import Garmin
from garminconnect.exceptions import (
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)


MAX_BODY_BYTES = 250_000
MFA_TTL_SECONDS = 10 * 60
SIGNATURE_TOLERANCE_SECONDS = 90


class AuthFailure(Exception):
    """A bounded, client-safe authentication failure."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code


def _key() -> bytes:
    value = os.environ.get("GARMIN_ENCRYPTION_KEY", "")
    if not re.fullmatch(r"[a-fA-F0-9]{64}", value):
        raise RuntimeError("GARMIN_ENCRYPTION_KEY is not configured")
    return bytes.fromhex(value)


def _signing_key() -> bytes:
    return hmac.new(
        _key(),
        b"fitlog-garmin-auth-signing-v1",
        hashlib.sha256,
    ).digest()


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _encrypt_mfa_state(client_state: dict[str, Any], session_id: str) -> str:
    payload = json.dumps(
        {
            "sessionId": session_id,
            "expiresAt": int(time.time()) + MFA_TTL_SECONDS,
            "clientState": client_state,
        },
        separators=(",", ":"),
    ).encode("utf-8")
    nonce = os.urandom(12)
    aad = f"fitlog:garmin:mfa:v1:{session_id}".encode("utf-8")
    ciphertext = AESGCM(_key()).encrypt(nonce, payload, aad)
    return f"v1.{_b64encode(nonce)}.{_b64encode(ciphertext)}"


def _decrypt_mfa_state(state: str, session_id: str) -> dict[str, Any]:
    try:
        version, encoded_nonce, encoded_ciphertext = state.split(".", 2)
        if version != "v1":
            raise ValueError("unsupported state version")
        aad = f"fitlog:garmin:mfa:v1:{session_id}".encode("utf-8")
        plaintext = AESGCM(_key()).decrypt(
            _b64decode(encoded_nonce),
            _b64decode(encoded_ciphertext),
            aad,
        )
        payload = json.loads(plaintext)
        if payload.get("sessionId") != session_id:
            raise ValueError("session mismatch")
        if not isinstance(payload.get("expiresAt"), int):
            raise ValueError("missing expiry")
        if payload["expiresAt"] < int(time.time()):
            raise AuthFailure(400, "MFA_EXPIRED", "The verification session expired.")
        client_state = payload.get("clientState")
        if not isinstance(client_state, dict):
            raise ValueError("invalid client state")
        return client_state
    except AuthFailure:
        raise
    except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        raise AuthFailure(400, "MFA_EXPIRED", "The verification session is invalid.") from exc
    except Exception as exc:
        raise AuthFailure(400, "MFA_EXPIRED", "The verification session is invalid.") from exc


def _garmin_token(garmin: Garmin) -> dict[str, str]:
    client = garmin.client
    access_token = client.di_token
    refresh_token = client.di_refresh_token
    client_id = client.di_client_id
    if not all(isinstance(value, str) and len(value) > 2 for value in (
        access_token,
        refresh_token,
        client_id,
    )):
        raise AuthFailure(
            502,
            "TOKEN_UNAVAILABLE",
            "Garmin did not return a reusable session.",
        )
    return {
        "kind": "di",
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "clientId": client_id,
    }


def _start(payload: dict[str, Any]) -> dict[str, Any]:
    username = payload.get("username")
    password = payload.get("password")
    session_id = payload.get("sessionId")
    if (
        not isinstance(username, str)
        or not 3 <= len(username) <= 320
        or not isinstance(password, str)
        or not 1 <= len(password) <= 500
        or not isinstance(session_id, str)
        or not re.fullmatch(r"[a-f0-9-]{36}", session_id)
    ):
        raise AuthFailure(400, "INVALID_REQUEST", "Invalid sign-in request.")

    garmin = Garmin(username, password, return_on_mfa=True)
    try:
        status, client_state = garmin.login()
        if status == "needs_mfa":
            if not isinstance(client_state, dict):
                raise AuthFailure(502, "INVALID_RESPONSE", "Garmin returned an invalid response.")
            return {
                "status": "mfa_required",
                "state": _encrypt_mfa_state(client_state, session_id),
            }
        return {"status": "connected", "token": _garmin_token(garmin)}
    finally:
        garmin.password = None
        payload["password"] = None


def _resume(payload: dict[str, Any]) -> dict[str, Any]:
    state = payload.get("state")
    mfa_code = payload.get("mfaCode")
    session_id = payload.get("sessionId")
    if (
        not isinstance(state, str)
        or not 20 <= len(state) <= 200_000
        or not isinstance(mfa_code, str)
        or not re.fullmatch(r"\d{4,10}", mfa_code)
        or not isinstance(session_id, str)
        or not re.fullmatch(r"[a-f0-9-]{36}", session_id)
    ):
        raise AuthFailure(400, "INVALID_REQUEST", "Invalid verification request.")

    client_state = _decrypt_mfa_state(state, session_id)
    garmin = Garmin()
    try:
        garmin.resume_login(client_state, mfa_code)
        return {"status": "connected", "token": _garmin_token(garmin)}
    except GarminConnectAuthenticationError as exc:
        # A rejected code can update Garmin's pending session cookies. Return
        # a freshly encrypted snapshot so a stateless function invocation can
        # safely retry the same MFA flow.
        if getattr(garmin.client, "_mfa_pending", False):
            try:
                retry_state = garmin.client._mfa_client_state()
                return {
                    "status": "mfa_required",
                    "state": _encrypt_mfa_state(retry_state, session_id),
                    "errorCode": "MFA_INVALID",
                }
            except Exception:
                pass
        raise AuthFailure(401, "MFA_INVALID", "The verification code was not accepted.") from exc
    finally:
        payload["mfaCode"] = None


def _dispatch(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        action = payload.get("action")
        if action == "start":
            return _start(payload)
        if action == "resume":
            return _resume(payload)
        raise AuthFailure(400, "INVALID_REQUEST", "Invalid sign-in action.")
    except AuthFailure:
        raise
    except GarminConnectTooManyRequestsError as exc:
        raise AuthFailure(429, "RATE_LIMITED", "Garmin is limiting sign-in attempts.") from exc
    except GarminConnectAuthenticationError as exc:
        raise AuthFailure(401, "AUTH_REJECTED", "Garmin rejected the sign-in.") from exc
    except (GarminConnectConnectionError, TimeoutError) as exc:
        raise AuthFailure(502, "GARMIN_UNAVAILABLE", "Garmin sign-in is unavailable.") from exc
    except Exception as exc:
        raise AuthFailure(502, "GARMIN_UNAVAILABLE", "Garmin sign-in is unavailable.") from exc


def _valid_signature(raw_body: bytes, timestamp: str, signature: str) -> bool:
    if not timestamp.isdigit() or not re.fullmatch(r"[a-f0-9]{64}", signature):
        return False
    if abs(int(time.time()) - int(timestamp)) > SIGNATURE_TOLERANCE_SECONDS:
        return False
    expected = hmac.new(
        _signing_key(),
        timestamp.encode("ascii") + b"." + raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


class handler(BaseHTTPRequestHandler):
    """Handle signed calls from the authenticated Next.js route."""

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json(400, {"error": "Invalid request.", "code": "INVALID_REQUEST"})
            return
        if content_length <= 0 or content_length > MAX_BODY_BYTES:
            self._json(400, {"error": "Invalid request.", "code": "INVALID_REQUEST"})
            return

        raw_body = self.rfile.read(content_length)
        timestamp = self.headers.get("X-Fitlog-Timestamp", "")
        signature = self.headers.get("X-Fitlog-Signature", "")
        try:
            signed = _valid_signature(raw_body, timestamp, signature)
        except RuntimeError:
            self._json(503, {"error": "Service is not configured.", "code": "NOT_CONFIGURED"})
            return
        if not signed:
            self._json(401, {"error": "Unauthorized.", "code": "UNAUTHORIZED"})
            return

        try:
            payload = json.loads(raw_body)
            if not isinstance(payload, dict):
                raise ValueError("body must be an object")
            result = _dispatch(payload)
            self._json(200, result)
        except (ValueError, TypeError, json.JSONDecodeError):
            self._json(400, {"error": "Invalid request.", "code": "INVALID_REQUEST"})
        except AuthFailure as exc:
            self._json(exc.status, {"error": str(exc), "code": exc.code})

    def log_message(self, format: str, *args: Any) -> None:
        # Avoid the default request logging path; auth requests contain secrets.
        return
