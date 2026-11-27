"""Private Vercel function for the Garmin credential and MFA exchange."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
from contextvars import ContextVar
from functools import wraps
from http.server import BaseHTTPRequestHandler
from typing import Any

import psycopg
import requests
from curl_cffi import requests as curl_requests
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
AUTH_BUDGET_SECONDS = 39
HANDLER_PATH = "/api/garmin_auth"
UUID_PATTERN = r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}"
_deadline: ContextVar[float | None] = ContextVar("garmin_auth_deadline", default=None)

# The SDK may log exceptions from external authentication requests. Keep
# credential exchange diagnostics confined to Fitlog's stable error codes.
logging.getLogger("garminconnect").setLevel(logging.CRITICAL + 1)


def _bounded_transport(request):
    @wraps(request)
    def wrapped(self, *args, **kwargs):
        deadline = _deadline.get()
        if deadline is not None:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("Garmin authentication deadline")
            # Leave room for a fallback transport or the token exchange.
            kwargs["timeout"] = min(7.0, remaining)
        return request(self, *args, **kwargs)
    return wrapped


# The pinned SDK creates its own requests and curl_cffi sessions in different
# login strategies. A context-local deadline covers both, including fallback
# strategies, without sharing a session or timer across invocations.
requests.Session.request = _bounded_transport(requests.Session.request)
curl_requests.Session.request = _bounded_transport(curl_requests.Session.request)


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
        b"fitlog-garmin-auth-signing-v2",
        hashlib.sha256,
    ).digest()


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _encrypt_mfa_state(
    client_state: dict[str, Any], session_id: str, expires_at: int | None = None
) -> str:
    payload = json.dumps(
        {
            "sessionId": session_id,
            "expiresAt": expires_at if expires_at is not None else int(time.time()) + MFA_TTL_SECONDS,
            "clientState": client_state,
        },
        separators=(",", ":"),
    ).encode("utf-8")
    nonce = os.urandom(12)
    aad = f"fitlog:garmin:mfa:v1:{session_id}".encode("utf-8")
    ciphertext = AESGCM(_key()).encrypt(nonce, payload, aad)
    return f"v1.{_b64encode(nonce)}.{_b64encode(ciphertext)}"


def _decrypt_mfa_state(state: str, session_id: str) -> tuple[dict[str, Any], int]:
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
        if payload["expiresAt"] <= int(time.time()):
            raise AuthFailure(400, "MFA_EXPIRED", "The verification session expired.")
        client_state = payload.get("clientState")
        if not isinstance(client_state, dict):
            raise ValueError("invalid client state")
        return client_state, payload["expiresAt"]
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
    if not (
        isinstance(access_token, str) and 20 < len(access_token) <= 16_384
        and isinstance(refresh_token, str) and 20 < len(refresh_token) <= 16_384
        and isinstance(client_id, str) and 3 <= len(client_id) <= 200
    ):
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
        or not re.fullmatch(UUID_PATTERN, session_id)
    ):
        raise AuthFailure(400, "INVALID_REQUEST", "Invalid sign-in request.")

    garmin = Garmin()
    try:
        # The high-level login reads GARMINTOKENS implicitly and can reuse a
        # different account. This entry point always uses the supplied credentials.
        status, client_state = garmin.client.login(username, password, return_on_mfa=True)
        if status == "needs_mfa":
            if not isinstance(client_state, dict):
                raise AuthFailure(502, "INVALID_RESPONSE", "Garmin returned an invalid response.")
            return {
                "status": "mfa_required",
                "state": _encrypt_mfa_state(client_state, session_id),
            }
        return {"status": "connected", "token": _garmin_token(garmin)}
    finally:
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
        or not re.fullmatch(UUID_PATTERN, session_id)
    ):
        raise AuthFailure(400, "INVALID_REQUEST", "Invalid verification request.")

    client_state, expires_at = _decrypt_mfa_state(state, session_id)
    garmin = Garmin()

    def retry(code: str) -> dict[str, str]:
        return {
            "status": "mfa_required",
            "state": _encrypt_mfa_state(garmin.client._mfa_client_state(), session_id, expires_at),
            "errorCode": code,
        }

    try:
        garmin.client.resume_login(client_state, mfa_code)
        return {"status": "connected", "token": _garmin_token(garmin)}
    except GarminConnectTooManyRequestsError:
        return retry("MFA_RATE_LIMITED")
    except GarminConnectAuthenticationError as exc:
        reason = str(exc).lower()
        if any(word in reason for word in ("expired", "invalid mfa client_state", "missing widget mfa context", "missing csrf token")):
            raise AuthFailure(400, "MFA_EXPIRED", "The verification session expired.") from exc
        if not getattr(garmin.client, "_mfa_pending", False) or any(
            word in reason for word in ("connection error", "non-json", "missing service ticket",
                                          "token exchange", "jwt_web", "unknown")
        ):
            raise AuthFailure(502, "GARMIN_UNAVAILABLE", "Garmin verification is unavailable.") from exc
        return retry("MFA_INVALID")
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
        if "token exchange" in str(exc).lower() or "jwt_web" in str(exc).lower():
            raise AuthFailure(502, "TOKEN_UNAVAILABLE", "Garmin did not return a reusable session.") from exc
        raise AuthFailure(401, "AUTH_REJECTED", "Garmin rejected the sign-in.") from exc
    except (GarminConnectConnectionError, TimeoutError) as exc:
        raise AuthFailure(502, "GARMIN_UNAVAILABLE", "Garmin sign-in is unavailable.") from exc
    except Exception as exc:
        raise AuthFailure(502, "GARMIN_UNAVAILABLE", "Garmin sign-in is unavailable.") from exc


def _valid_signature(raw_body: bytes, timestamp: str, nonce: str, signature: str) -> bool:
    if not re.fullmatch(r"[0-9]{10}", timestamp) or not re.fullmatch(UUID_PATTERN, nonce):
        return False
    if not re.fullmatch(r"[a-f0-9]{64}", signature):
        return False
    if abs(int(time.time()) - int(timestamp)) > SIGNATURE_TOLERANCE_SECONDS:
        return False
    prefix = f"POST\n{HANDLER_PATH}\n{timestamp}\n{nonce}\n".encode("ascii")
    expected = hmac.new(_signing_key(), prefix + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _claim_nonce(nonce: str) -> bool:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("Garmin database is not configured")
    # Keep the entry longer than the entire acceptance window, including a
    # sender clock ahead of this instance. A unique key enforces one claimant.
    with psycopg.connect(url, connect_timeout=4) as db:
        # Neon pooled URLs use PgBouncer, which rejects startup options.
        db.execute("SET LOCAL statement_timeout = '4s'")
        db.execute("DELETE FROM garmin_request_nonces WHERE expires_at < now()")
        result = db.execute(
            """INSERT INTO garmin_request_nonces (nonce, expires_at)
               VALUES (%s, now() + interval '4 minutes')
               ON CONFLICT DO NOTHING RETURNING nonce""",
            (nonce,),
        )
        return result.fetchone() is not None


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
        nonce = self.headers.get("X-Fitlog-Nonce", "")
        try:
            signed = self.path == HANDLER_PATH and _valid_signature(raw_body, timestamp, nonce, signature)
        except RuntimeError:
            self._json(503, {"error": "Service is not configured.", "code": "NOT_CONFIGURED"})
            return
        if not signed:
            self._json(401, {"error": "Unauthorized.", "code": "UNAUTHORIZED"})
            return

        deadline = time.monotonic() + AUTH_BUDGET_SECONDS
        try:
            claimed = _claim_nonce(nonce)
        except (RuntimeError, psycopg.Error):
            self._json(503, {"error": "Service unavailable.", "code": "SERVICE_UNAVAILABLE"})
            return
        if not claimed:
            self._json(409, {"error": "Request already used.", "code": "REPLAY"})
            return

        context = _deadline.set(deadline)
        try:
            payload = json.loads(raw_body)
            if not isinstance(payload, dict):
                raise ValueError("body must be an object")
            result = _dispatch(payload)
            if time.monotonic() >= deadline:
                raise AuthFailure(504, "AUTH_TIMEOUT", "Garmin sign-in took too long.")
            self._json(200, result)
        except (ValueError, TypeError, json.JSONDecodeError):
            self._json(400, {"error": "Invalid request.", "code": "INVALID_REQUEST"})
        except AuthFailure as exc:
            if time.monotonic() >= deadline:
                self._json(504, {"error": "Garmin sign-in took too long.", "code": "AUTH_TIMEOUT"})
            else:
                self._json(exc.status, {"error": str(exc), "code": exc.code})
        finally:
            _deadline.reset(context)

    def log_message(self, format: str, *args: Any) -> None:
        # Avoid the default request logging path; auth requests contain secrets.
        return
