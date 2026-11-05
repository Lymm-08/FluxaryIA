import hashlib
import html
import json
import logging
import os
import secrets
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen


logger = logging.getLogger(__name__)
EMAIL_SUBJECT = "Confirmação de exclusão da conta Fluxary"
TOKEN_LIFETIME_MINUTES = 30
STORAGE_PAGE_SIZE = 100
STORAGE_DELETE_BATCH_SIZE = 100


# Erros controlados preservam mensagens genéricas e deixam o estágio apenas nos logs.
class AccountDeletionError(Exception):
    def __init__(self, status: int, message: str, stage: str):
        super().__init__(message)
        self.status = status
        self.message = message
        self.stage = stage


@dataclass(frozen=True)
class AccountDeletionConfig:
    supabase_url: str
    supabase_public_key: str
    supabase_service_key: str
    resend_api_key: str
    resend_from_email: str
    public_app_url: str


# Configuração do backend; credenciais administrativas nunca são retornadas ao frontend.
def load_config(require_email: bool = False) -> AccountDeletionConfig:
    supabase_url = os.environ.get("VITE_SUPABASE_URL", "").strip().rstrip("/")
    supabase_public_key = (
        os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
        or os.environ.get("VITE_SUPABASE_ANON_KEY")
        or ""
    ).strip()
    supabase_service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    resend_api_key = os.environ.get("RESEND_API_KEY", "").strip()
    resend_from_email = os.environ.get("RESEND_FROM_EMAIL", "").strip()
    public_app_url = os.environ.get("PUBLIC_APP_URL", "").strip().rstrip("/")

    missing = []
    if not supabase_url:
        missing.append("VITE_SUPABASE_URL")
    if not supabase_public_key:
        missing.append("VITE_SUPABASE_ANON_KEY")
    if not supabase_service_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if require_email:
        if not resend_api_key:
            missing.append("RESEND_API_KEY")
        if not resend_from_email:
            missing.append("RESEND_FROM_EMAIL")
        if not public_app_url:
            missing.append("PUBLIC_APP_URL")
    if missing:
        logger.error(
            "account_deletion_configuration_error stage=configuration error_type=MissingConfiguration variables=%s",
            ",".join(missing),
        )
        raise AccountDeletionError(
            503,
            "A solicitação de exclusão não está configurada no servidor.",
            "configuration",
        )

    parsed_url = urlsplit(supabase_url)
    if parsed_url.scheme != "https" or not parsed_url.netloc:
        raise AccountDeletionError(503, "A solicitação de exclusão não está configurada no servidor.", "configuration")
    if public_app_url:
        app_url = urlsplit(public_app_url)
        is_local_http = app_url.scheme == "http" and app_url.hostname in ("localhost", "127.0.0.1")
        if not app_url.netloc or (app_url.scheme != "https" and not is_local_http):
            raise AccountDeletionError(503, "A solicitação de exclusão não está configurada no servidor.", "configuration")
    return AccountDeletionConfig(
        supabase_url=supabase_url,
        supabase_public_key=supabase_public_key,
        supabase_service_key=supabase_service_key,
        resend_api_key=resend_api_key,
        resend_from_email=resend_from_email,
        public_app_url=public_app_url,
    )


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# Chamadas HTTP compartilhadas com Supabase Auth, PostgREST, Storage e Resend.
def _request_json(
    url: str,
    method: str,
    headers: dict[str, str],
    payload: Any = None,
    stage: str = "external_request",
) -> Any:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=15) as response:
            content = response.read()
    except HTTPError as error:
        logger.warning(
            "account_deletion_external_error stage=%s error_type=HTTPError upstream_status=%s",
            stage,
            error.code,
        )
        if error.code == 429:
            raise AccountDeletionError(429, "Muitas tentativas. Aguarde antes de tentar novamente.", stage) from error
        if stage == "supabase_authenticate_user" and error.code in (400, 401, 403):
            raise AccountDeletionError(401, "Entre novamente na sua conta para continuar.", stage) from error
        if error.code in (401, 403):
            raise AccountDeletionError(502, "Não foi possível validar a solicitação com segurança.", stage) from error
        raise AccountDeletionError(502, "Um serviço necessário não concluiu a solicitação.", stage) from error
    except (TimeoutError, URLError) as error:
        logger.warning(
            "account_deletion_external_error stage=%s error_type=%s upstream_status=unknown",
            stage,
            type(error).__name__,
        )
        raise AccountDeletionError(503, "Um serviço necessário está temporariamente indisponível.", stage) from error
    if not content:
        return None
    try:
        return json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AccountDeletionError(502, "Um serviço necessário retornou uma resposta inválida.", stage) from error


def _service_headers(config: AccountDeletionConfig) -> dict[str, str]:
    return {
        "apikey": config.supabase_service_key,
        "Authorization": f"Bearer {config.supabase_service_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _rpc(config: AccountDeletionConfig, function: str, payload: dict[str, Any]) -> Any:
    return _request_json(
        f"{config.supabase_url}/rest/v1/rpc/{function}",
        "POST",
        _service_headers(config),
        payload,
        f"supabase_{function}",
    )


def authenticate_user(config: AccountDeletionConfig, access_token: str) -> dict[str, Any]:
    user = _request_json(
        f"{config.supabase_url}/auth/v1/user",
        "GET",
        {
            "apikey": config.supabase_public_key,
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
        stage="supabase_authenticate_user",
    )
    if not isinstance(user, dict) or not isinstance(user.get("id"), str):
        raise AccountDeletionError(401, "Entre novamente na sua conta para continuar.", "supabase_authenticate_user")
    return user


def create_deletion_request(
    config: AccountDeletionConfig,
    user_id: str,
    email: str,
) -> None:
    token = secrets.token_urlsafe(32)
    result = _rpc(
        config,
        "request_fluxary_account_deletion",
        {"p_user_id": user_id, "p_token_hash": hash_token(token)},
    )
    if not isinstance(result, dict):
        raise AccountDeletionError(502, "Não foi possível registrar a solicitação.", "supabase_create_request")
    if result.get("status") == "rate_limited":
        raise AccountDeletionError(429, "Você atingiu o limite de solicitações. Tente novamente amanhã.", "rate_limit")
    if result.get("status") != "created":
        raise AccountDeletionError(400, "Não foi possível registrar a solicitação.", "supabase_create_request")

    confirmation_url = f"{config.public_app_url}/#{urlencode({'accountDeletionToken': token})}"
    send_confirmation_email(config, email, confirmation_url)


# E-mail transacional com conteúdo HTML e texto simples.
def send_confirmation_email(
    config: AccountDeletionConfig,
    recipient: str,
    confirmation_url: str,
) -> None:
    safe_url = html.escape(confirmation_url, quote=True)
    html_content = f"""\
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f4f8f5;font-family:Arial,sans-serif;color:#26382d">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e1ece4;border-radius:16px">
          <tr><td style="padding:32px">
            <div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:#268158">FLUXARY</div>
            <h1 style="margin:18px 0 12px;font-size:23px">Confirme a exclusão da sua conta</h1>
            <p style="font-size:15px;line-height:1.6">Recebemos uma solicitação para excluir permanentemente sua conta Fluxary e os dados associados.</p>
            <p style="font-size:15px;line-height:1.6">Para continuar, confirme explicitamente na página segura do Fluxary:</p>
            <p style="margin:26px 0">
              <a href="{safe_url}" style="display:inline-block;padding:14px 20px;border-radius:10px;background:#21835c;color:#fff;text-decoration:none;font-weight:bold">Confirmar exclusão da conta</a>
            </p>
            <p style="font-size:13px;line-height:1.6;color:#68776d">Este link expira em {TOKEN_LIFETIME_MINUTES} minutos. Abrir o link não exclui a conta; será necessária uma confirmação final.</p>
            <p style="font-size:13px;line-height:1.6;color:#68776d">Se não foi você quem solicitou, basta ignorar este e-mail. Sua conta permanecerá ativa.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""
    text_content = (
        "Recebemos uma solicitação para excluir permanentemente sua conta Fluxary e os dados associados.\n\n"
        "Para continuar, abra o link e confirme explicitamente na página do Fluxary:\n"
        f"{confirmation_url}\n\n"
        f"O link expira em {TOKEN_LIFETIME_MINUTES} minutos. Abrir o link não exclui a conta.\n"
        "Se não foi você quem solicitou, basta ignorar este e-mail."
    )
    _request_json(
        "https://api.resend.com/emails",
        "POST",
        {
            "Authorization": f"Bearer {config.resend_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        {
            "from": config.resend_from_email,
            "to": [recipient],
            "subject": EMAIL_SUBJECT,
            "html": html_content,
            "text": text_content,
        },
        "resend_send_confirmation",
    )


def validate_token(config: AccountDeletionConfig, token: str) -> dict[str, Any]:
    result = _rpc(config, "validate_fluxary_account_deletion_token", {"p_token_hash": hash_token(token)})
    if not isinstance(result, dict):
        raise AccountDeletionError(502, "Não foi possível validar este link.", "supabase_validate_token")
    return result


# Limpeza paginada dos objetos cujo owner_id corresponde ao usuário autenticado.
def _list_owned_storage_page(
    config: AccountDeletionConfig,
    user_id: str,
    after_bucket_id: str,
    after_object_name: str,
) -> list[dict[str, str]]:
    result = _rpc(
        config,
        "list_fluxary_owned_storage_objects",
        {
            "p_user_id": user_id,
            "p_after_bucket_id": after_bucket_id,
            "p_after_object_name": after_object_name,
            "p_page_size": STORAGE_PAGE_SIZE,
        },
    )
    if not isinstance(result, list) or any(
        not isinstance(item, dict)
        or not isinstance(item.get("bucket_id"), str)
        or not isinstance(item.get("object_name"), str)
        for item in result
    ):
        raise AccountDeletionError(502, "Não foi possível localizar os arquivos da conta.", "storage_list")
    return result


def _remove_storage_objects(
    config: AccountDeletionConfig,
    bucket_id: str,
    object_names: list[str],
) -> None:
    encoded_bucket = quote(bucket_id, safe="")
    _request_json(
        f"{config.supabase_url}/storage/v1/object/{encoded_bucket}",
        "DELETE",
        _service_headers(config),
        {"prefixes": object_names},
        "storage_remove_objects",
    )


def remove_owned_storage_objects(config: AccountDeletionConfig, user_id: str) -> None:
    cursor_bucket = ""
    cursor_name = ""
    while True:
        page = _list_owned_storage_page(config, user_id, cursor_bucket, cursor_name)
        if not page:
            return
        grouped: dict[str, list[str]] = {}
        for item in page:
            grouped.setdefault(item["bucket_id"], []).append(item["object_name"])
        for bucket_id, object_names in grouped.items():
            for start in range(0, len(object_names), STORAGE_DELETE_BATCH_SIZE):
                _remove_storage_objects(
                    config,
                    bucket_id,
                    object_names[start : start + STORAGE_DELETE_BATCH_SIZE],
                )
        cursor_bucket = page[-1]["bucket_id"]
        cursor_name = page[-1]["object_name"]


def consume_token(config: AccountDeletionConfig, token: str) -> str:
    result = _rpc(config, "consume_fluxary_account_deletion_token", {"p_token_hash": hash_token(token)})
    if not isinstance(result, dict):
        raise AccountDeletionError(502, "Não foi possível confirmar este link.", "supabase_consume_token")
    if result.get("status") != "consumed" or not isinstance(result.get("user_id"), str):
        raise AccountDeletionError(409, "Este link não é mais válido. Solicite uma nova confirmação.", "token_consumption")
    return result["user_id"]


# Remoção administrativa final; o banco aplica os vínculos de exclusão em cascata.
def delete_auth_user(config: AccountDeletionConfig, user_id: str) -> None:
    _request_json(
        f"{config.supabase_url}/auth/v1/admin/users/{quote(user_id, safe='')}",
        "DELETE",
        _service_headers(config),
        stage="supabase_delete_auth_user",
    )


def confirm_account_deletion(config: AccountDeletionConfig, token: str) -> None:
    state = validate_token(config, token)
    if state.get("status") != "valid" or not isinstance(state.get("user_id"), str):
        raise AccountDeletionError(409, "Este link não é mais válido. Solicite uma nova confirmação.", "token_validation")
    expected_user_id = state["user_id"]
    consumed_user_id = consume_token(config, token)
    if not secrets.compare_digest(expected_user_id, consumed_user_id):
        logger.error("account_deletion_failure stage=token_owner_check error_type=OwnerMismatch")
        raise AccountDeletionError(409, "Este link não é mais válido.", "token_owner_check")
    remove_owned_storage_objects(config, consumed_user_id)
    delete_auth_user(config, consumed_user_id)
