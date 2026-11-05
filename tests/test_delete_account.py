import io
import json
import unittest
import uuid
from unittest.mock import call, patch

from api.account_deletion import (
    AccountDeletionConfig,
    AccountDeletionError,
    authenticate_user,
    confirm_account_deletion,
    create_deletion_request,
    hash_token,
    remove_owned_storage_objects,
    send_confirmation_email,
)
from api.delete_account import _handle_post


CONFIG = AccountDeletionConfig(
    supabase_url="https://project.supabase.co",
    supabase_public_key="public-key",
    supabase_service_key="server-secret",
    resend_api_key="resend-secret",
    resend_from_email="Fluxary <verified@example.com>",
)


class FakeHandler:
    def __init__(self, payload, headers=None):
        body = json.dumps(payload).encode("utf-8")
        self.rfile = io.BytesIO(body)
        self.headers = {"Content-Length": str(len(body)), **(headers or {})}
        self.wfile = io.BytesIO()
        self.status = None

    def send_response(self, status):
        self.status = status

    def send_header(self, _name, _value):
        pass

    def end_headers(self):
        pass


class AccountDeletionTests(unittest.TestCase):
    def test_tokens_are_stored_as_sha256_hashes(self):
        token = "random-one-time-token"

        self.assertEqual(len(hash_token(token)), 64)
        self.assertNotEqual(hash_token(token), token)
        self.assertEqual(hash_token(token), hash_token(token))

    @patch("api.account_deletion.send_confirmation_email")
    @patch("api.account_deletion._rpc", return_value={"status": "created"})
    @patch("api.account_deletion.secrets.randbelow", return_value=12345)
    @patch("api.account_deletion.uuid.uuid4", return_value=uuid.UUID("f287b855-fb39-4680-bf0f-1bf64dba32a1"))
    def test_request_persists_only_hash_and_mails_code_once(self, _request_id, _code, rpc, send_email):
        request_id = create_deletion_request(CONFIG, "user-uuid", "person@example.com")

        rpc.assert_called_once_with(
            CONFIG,
            "request_fluxary_account_deletion_code",
            {
                "p_user_id": "user-uuid",
                "p_request_id": "f287b855-fb39-4680-bf0f-1bf64dba32a1",
                "p_token_hash": hash_token("f287b855-fb39-4680-bf0f-1bf64dba32a1:012345"),
            },
        )
        self.assertEqual(request_id, "f287b855-fb39-4680-bf0f-1bf64dba32a1")
        send_email.assert_called_once_with(CONFIG, "person@example.com", "012345")

    @patch("api.account_deletion.send_confirmation_email")
    @patch("api.account_deletion._rpc", return_value={"status": "rate_limited"})
    def test_request_limit_does_not_send_email(self, _rpc, send_email):
        with self.assertRaises(AccountDeletionError) as raised:
            create_deletion_request(CONFIG, "user-uuid", "person@example.com")

        self.assertEqual(raised.exception.status, 429)
        send_email.assert_not_called()

    @patch("api.account_deletion.delete_auth_user")
    @patch("api.account_deletion.remove_owned_storage_objects")
    @patch("api.account_deletion.consume_token", return_value="user-uuid")
    @patch("api.account_deletion.validate_token", return_value={"status": "valid", "user_id": "user-uuid"})
    def test_confirmation_consumes_token_then_deletes_storage_and_own_auth_user(
        self, validate, consume, remove_storage, delete_user
    ):
        actions = []
        consume.side_effect = lambda *_args: actions.append("consume") or "user-uuid"
        remove_storage.side_effect = lambda *_args: actions.append("storage")
        delete_user.side_effect = lambda *_args: actions.append("auth")

        confirm_account_deletion(CONFIG, "a" * 43)

        validate.assert_called_once_with(CONFIG, "a" * 43)
        consume.assert_called_once_with(CONFIG, "a" * 43)
        remove_storage.assert_called_once_with(CONFIG, "user-uuid")
        delete_user.assert_called_once_with(CONFIG, "user-uuid")
        self.assertEqual(actions, ["consume", "storage", "auth"])

    @patch("api.account_deletion.delete_auth_user")
    @patch("api.account_deletion.remove_owned_storage_objects")
    @patch("api.account_deletion.consume_token", return_value="other-user")
    @patch("api.account_deletion.validate_token", return_value={"status": "valid", "user_id": "user-uuid"})
    def test_owner_mismatch_never_deletes_storage_or_auth_user(
        self, _validate, _consume, remove_storage, delete_user
    ):
        with self.assertRaises(AccountDeletionError):
            confirm_account_deletion(CONFIG, "a" * 43)

        remove_storage.assert_not_called()
        delete_user.assert_not_called()

    @patch("api.account_deletion.consume_token")
    @patch("api.account_deletion.remove_owned_storage_objects")
    @patch("api.account_deletion.validate_token")
    def test_expired_invalid_and_reused_tokens_cannot_reach_deletion(
        self, validate, remove_storage, consume
    ):
        for state in ("expired", "invalid", "used"):
            validate.return_value = {"status": state}
            with self.subTest(state=state), self.assertRaises(AccountDeletionError):
                confirm_account_deletion(CONFIG, "a" * 43)

        consume.assert_not_called()
        remove_storage.assert_not_called()

    @patch("api.account_deletion._request_json", return_value={"id": "session-user", "email": "person@example.com"})
    def test_user_identity_comes_from_supabase_session_not_request_payload(self, request_json):
        user = authenticate_user(CONFIG, "user-access-token")

        self.assertEqual(user["id"], "session-user")
        self.assertEqual(request_json.call_args.args[0], "https://project.supabase.co/auth/v1/user")
        self.assertEqual(
            request_json.call_args.args[2]["Authorization"],
            "Bearer user-access-token",
        )

    @patch("api.delete_account.create_deletion_request", return_value="f287b855-fb39-4680-bf0f-1bf64dba32a1")
    @patch("api.delete_account.authenticate_user", return_value={"id": "session-user", "email": "person@example.com"})
    @patch("api.delete_account.load_config", return_value=CONFIG)
    def test_request_uses_server_verified_user_id_not_submitted_id(
        self, _config, _authenticate, create_request
    ):
        handler = FakeHandler(
            {"action": "request", "user_id": "attacker-controlled-user"},
            {"Authorization": "Bearer session-token"},
        )

        _handle_post(handler)

        create_request.assert_called_once_with(CONFIG, "session-user", "person@example.com")
        self.assertEqual(handler.status, 200)
        self.assertEqual(
            json.loads(handler.wfile.getvalue()),
            {"status": "email_sent", "request_id": "f287b855-fb39-4680-bf0f-1bf64dba32a1"},
        )

    @patch("api.delete_account.authenticate_user")
    @patch("api.delete_account.load_config", return_value=CONFIG)
    def test_unauthenticated_request_cannot_create_deletion_request(self, _config, authenticate):
        handler = FakeHandler({"action": "request", "user_id": "attacker-controlled-user"})

        with self.assertRaises(AccountDeletionError):
            _handle_post(handler)

        authenticate.assert_not_called()

    @patch("api.delete_account.validate_deletion_code", return_value={"status": "invalid"})
    @patch("api.delete_account.load_config", return_value=CONFIG)
    def test_code_validation_uses_request_id_and_returns_invalid_status(self, _config, validate_code):
        request_id = "f287b855-fb39-4680-bf0f-1bf64dba32a1"
        handler = FakeHandler({"action": "validate", "request_id": request_id, "code": "001234"})

        _handle_post(handler)

        validate_code.assert_called_once_with(CONFIG, request_id, "001234")
        self.assertEqual(handler.status, 200)
        self.assertEqual(json.loads(handler.wfile.getvalue()), {"status": "invalid"})

    @patch("api.delete_account.validate_deletion_code")
    @patch("api.delete_account.load_config", return_value=CONFIG)
    def test_malformed_confirmation_code_is_rejected_before_database_lookup(self, _config, validate_code):
        handler = FakeHandler({
            "action": "validate",
            "request_id": "f287b855-fb39-4680-bf0f-1bf64dba32a1",
            "code": "12345x",
        })

        with self.assertRaises(AccountDeletionError):
            _handle_post(handler)

        validate_code.assert_not_called()

    @patch("api.account_deletion._remove_storage_objects")
    @patch("api.account_deletion._list_owned_storage_page")
    def test_storage_cleanup_uses_owned_paths_and_keyset_pagination(self, list_page, remove):
        list_page.side_effect = [
            [
                {"bucket_id": "avatars", "object_name": "user/avatar.png"},
                {"bucket_id": "receipts", "object_name": "user/receipt.pdf"},
            ],
            [],
        ]

        remove_owned_storage_objects(CONFIG, "user-uuid")

        self.assertEqual(
            remove.call_args_list,
            [
                call(CONFIG, "avatars", ["user/avatar.png"]),
                call(CONFIG, "receipts", ["user/receipt.pdf"]),
            ],
        )
        self.assertEqual(
            list_page.call_args_list,
            [
                call(CONFIG, "user-uuid", "", ""),
                call(CONFIG, "user-uuid", "receipts", "user/receipt.pdf"),
            ],
        )

    @patch("api.account_deletion._request_json")
    def test_email_uses_configured_sender_and_requested_copy(self, request_json):
        send_confirmation_email(CONFIG, "person@example.com", "012345")

        args = request_json.call_args.args
        email = args[3]
        self.assertEqual(args[0], "https://api.resend.com/emails")
        self.assertEqual(email["from"], "Fluxary <verified@example.com>")
        self.assertEqual(email["to"], ["person@example.com"])
        self.assertEqual(email["subject"], "Confirmação de exclusão da conta Fluxary")
        self.assertIn("30 minutos", email["html"])
        self.assertIn("basta ignorar este e-mail", email["text"])
        self.assertIn("012345", email["html"])
        self.assertIn("012345", email["text"])
        self.assertNotIn("https://", email["text"])


if __name__ == "__main__":
    unittest.main()