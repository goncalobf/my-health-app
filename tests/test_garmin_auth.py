import hashlib
import hmac
import http.client
import json
import os
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
from threading import Thread
from unittest.mock import MagicMock, Mock, patch
from urllib.parse import urlparse
from uuid import uuid4

import garmin_auth as auth


KEY = "42" * 32


class GarminAuthTest(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(os.environ, {"GARMIN_ENCRYPTION_KEY": KEY})
        environment.start()
        self.addCleanup(environment.stop)
        self.session_id = str(uuid4())

    def test_start_uses_explicit_credentials_and_returns_opaque_state(self):
        credentials = {"username": "qa@example.test", "password": "fixture-password"}
        provider = Mock()
        provider.client.login.return_value = ("needs_mfa", {"cookies": [{"name": "test-cookie"}]})
        payload = {"sessionId": self.session_id, **credentials}
        with patch.dict(os.environ, {"GARMINTOKENS": "/unused/fixture"}), patch.object(auth, "Garmin", return_value=provider):
            result = auth._start(payload)

        provider.client.login.assert_called_once_with(credentials["username"], credentials["password"], return_on_mfa=True)
        provider.login.assert_not_called()
        self.assertIsNone(payload["password"])
        self.assertEqual(result["status"], "mfa_required")
        self.assertNotIn("test-cookie", result["state"])
        decoded, _ = auth._decrypt_mfa_state(result["state"], self.session_id)
        self.assertEqual(decoded, {"cookies": [{"name": "test-cookie"}]})

    def test_invalid_code_updates_cookies_without_extending_expiry(self):
        original = {"cookies": []}
        expiry = int(time.time()) + 30
        state = auth._encrypt_mfa_state(original, self.session_id, expiry)
        payload = {"state": state, "sessionId": self.session_id, "mfaCode": "000000"}
        provider = Mock()
        provider.client._mfa_pending = True
        provider.client._mfa_client_state.return_value = {"cookies": [{"name": "updated"}]}
        provider.client.resume_login.side_effect = auth.GarminConnectAuthenticationError("MFA verification failed: INVALID_CODE")
        with patch.object(auth, "Garmin", return_value=provider):
            result = auth._resume(payload)

        provider.client.resume_login.assert_called_once_with(original, "000000")
        self.assertIsNone(payload["mfaCode"])
        self.assertEqual(result["errorCode"], "MFA_INVALID")
        retry_state, retry_expiry = auth._decrypt_mfa_state(result["state"], self.session_id)
        self.assertEqual(retry_state, {"cookies": [{"name": "updated"}]})
        self.assertEqual(retry_expiry, expiry)

    def test_expired_or_cross_session_state_never_contacts_garmin(self):
        expired = auth._encrypt_mfa_state({}, self.session_id, int(time.time()) - 1)
        valid = auth._encrypt_mfa_state({}, self.session_id)
        for state, session_id in [(expired, self.session_id), (valid, str(uuid4()))]:
            with self.subTest(session_id=session_id), patch.object(auth, "Garmin") as provider:
                with self.assertRaises(auth.AuthFailure) as raised:
                    auth._resume({"state": state, "sessionId": session_id, "mfaCode": "123456"})
                self.assertEqual(raised.exception.code, "MFA_EXPIRED")
                provider.assert_not_called()

    def test_resume_transport_failure_is_not_an_invalid_code(self):
        state = auth._encrypt_mfa_state({}, self.session_id)
        provider = Mock()
        provider.client._mfa_pending = True
        provider.client.resume_login.side_effect = auth.GarminConnectAuthenticationError("MFA verification failed: connection error")
        with patch.object(auth, "Garmin", return_value=provider), self.assertRaises(auth.AuthFailure) as raised:
            auth._resume({"state": state, "sessionId": self.session_id, "mfaCode": "123456"})
        self.assertEqual(raised.exception.code, "GARMIN_UNAVAILABLE")

    def test_transport_obeys_request_deadline(self):
        call = Mock()
        bounded = auth._bounded_transport(call)
        with patch.object(auth.time, "monotonic", return_value=100):
            context = auth._deadline.set(103)
            self.addCleanup(auth._deadline.reset, context)
            bounded(None, "GET", "https://example.test", timeout=30)
        call.assert_called_once_with(None, "GET", "https://example.test", timeout=3)
        with patch.object(auth.time, "monotonic", return_value=104):
            with self.assertRaises(TimeoutError):
                bounded(None, "GET", "https://example.test")
        call.assert_called_once()

    def test_nonce_sql_timeout_is_transaction_local_for_pooled_neon(self):
        with patch.dict(os.environ, {"DATABASE_URL": "postgresql://localhost/fixture"}):
            with patch.object(auth.psycopg, "connect", return_value=MagicMock()) as connect:
                database = connect.return_value.__enter__.return_value
                nonce = str(uuid4())
                database.execute.return_value.fetchone.return_value = (nonce,)
                self.assertTrue(auth._claim_nonce(nonce))
        connect.assert_called_once_with("postgresql://localhost/fixture", connect_timeout=4)
        self.assertEqual(database.execute.call_args_list[0].args, ("SET LOCAL statement_timeout = '4s'",))
        self.assertEqual(database.execute.call_args_list[-1].args[-1], (nonce,))

    def test_http_contract_and_atomic_nonce_claim(self):
        database = os.environ.get("GARMIN_TEST_DATABASE_URL")
        if not database:
            self.skipTest("Set GARMIN_TEST_DATABASE_URL to a migrated local Postgres database")
        self.assertIn(urlparse(database).hostname, {"localhost", "127.0.0.1", "::1"})
        body = json.dumps({"action": "start", "sessionId": self.session_id}).encode()
        timestamp = str(int(time.time()))
        nonce = str(uuid4())
        key = hmac.new(bytes.fromhex(KEY), b"fitlog-garmin-auth-signing-v2", hashlib.sha256).digest()
        prefix = f"POST\n/api/garmin_auth\n{timestamp}\n{nonce}\n".encode()
        signature = hmac.new(key, prefix + body, hashlib.sha256).hexdigest()
        headers = {"X-Fitlog-Timestamp": timestamp, "X-Fitlog-Nonce": nonce, "X-Fitlog-Signature": signature}
        server = ThreadingHTTPServer(("127.0.0.1", 0), auth.handler)
        self.addCleanup(server.server_close)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.shutdown)

        def request(path="/api/garmin_auth", payload=body):
            connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
            try:
                connection.request("POST", path, payload, headers)
                response = connection.getresponse()
                self.assertEqual(response.getheader("Cache-Control"), "no-store")
                return response.status, json.loads(response.read())
            finally:
                connection.close()

        with patch.dict(os.environ, {"DATABASE_URL": database}), patch.object(auth, "_dispatch", return_value={"status": "ok"}) as dispatch:
            self.assertEqual(request("/different")[0], 401)
            self.assertEqual(request(payload=body + b" ")[0], 401)
            with ThreadPoolExecutor(max_workers=2) as pool:
                requests = [pool.submit(request), pool.submit(request)]
                self.assertEqual(sorted(result.result()[0] for result in requests), [200, 409])
            dispatch.assert_called_once()
