import json
import logging
import re
from http.server import BaseHTTPRequestHandler
from typing import Any

from api.account_deletion import (
    AccountDeletionError,
    authenticate_user,
    confirm_account_deletion,
    create_deletion_request,
    load_config,
    validate_token,
)


logger = logging.getLogger(__name__)
MAX_BODY_BYTES = 4_096
TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{40,64}$")


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Referrer-Policy", "no-referrer")
    handler.end_headers()
    handler.wfile.write(encoded)


def _read_payload(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    try:
        content_length = int(handler.headers.get("Content-Length", ""))
    except ValueError as error:
        raise AccountDeletionError(400, "A solicitação está inválida.", "request_validation") from error
    if content_length <= 0 or content_length > MAX_BODY_BYTES:
        raise AccountDeletionError(400, "A solicitação está inválida.", "request_validation")
    try:
        payload = json.loads(handler.rfile.read(content_length))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AccountDeletionError(400, "A solicitação está inválida.", "request_validation") from error
    if not isinstance(payload, dict):
        raise AccountDeletionError(400, "A solicitação está inválida.", "request_validation")
    return payload


def _access_token(handler: BaseHTTPRequestHandler) -> str:
    authorization = handler.headers.get("Authorization", "")
    if not authorization.startswith("Bearer ") or len(authorization) > 8_192:
        raise AccountDeletionError(401, "Entre na sua conta para continuar.", "authentication")
    token = authorization[7:].strip()
    if not token:
        raise AccountDeletionError(401, "Entre na sua conta para continuar.", "authentication")
    return token


def _confirmation_token(payload: dict[str, Any]) -> str:
    token = payload.get("token")
    if not isinstance(token, str) or not TOKEN_PATTERN.fullmatch(token):
        raise AccountDeletionError(400, "O link de confirmação é inválido.", "token_validation")
    return token


def _handle_post(handler: BaseHTTPRequestHandler) -> None:
    payload = _read_payload(handler)
    action = payload.get("action")
    if action not in ("request", "validate", "confirm"):
        raise AccountDeletionError(400, "A solicitação está inválida.", "request_validation")
    access_token = _access_token(handler) if action == "request" else None
    config = load_config(require_email=action == "request")

    if action == "request":
        if access_token is None:
            raise AccountDeletionError(401, "Entre na sua conta para continuar.", "authentication")
        user = authenticate_user(config, access_token)
        email = user.get("email")
        if not isinstance(email, str) or not email.strip():
            raise AccountDeletionError(400, "A conta não possui um e-mail para confirmação.", "email_validation")
        create_deletion_request(config, user["id"], email)
        _json_response(handler, 200, {"status": "email_sent"})
        return

    token = _confirmation_token(payload)
    if action == "validate":
        result = validate_token(config, token)
        state = result.get("status")
        if state not in ("valid", "expired", "invalid", "used"):
            raise AccountDeletionError(502, "Não foi possível validar este link.", "token_validation")
        _json_response(handler, 200, {"status": state})
        return

    confirm_account_deletion(config, token)
    _json_response(handler, 200, {"status": "deleted"})


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        try:
            _handle_post(self)
        except AccountDeletionError as error:
            logger.info(
                "account_deletion_request_rejected stage=%s error_type=AccountDeletionError http_status=%s",
                error.stage,
                error.status,
            )
            _json_response(self, error.status, {"error": error.message})
        except Exception as error:
            logger.error(
                "account_deletion_request_failure stage=handler error_type=%s",
                type(error).__name__,
            )
            _json_response(self, 500, {"error": "Não foi possível concluir a solicitação. Tente novamente."})

    def do_GET(self) -> None:
        _json_response(self, 405, {"error": "Método não permitido."})

    def do_DELETE(self) -> None:
        _json_response(self, 405, {"error": "Método não permitido."})

    def log_message(self, _format: str, *_args: Any) -> None:
        super().log_message(_format, *_args)