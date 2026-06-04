import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone
from typing import Any


PASSWORD_ALGORITHM = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 310_000
LEGACY_SHA256_LENGTH = 64


class TokenError(ValueError):
    pass


def _base64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        PASSWORD_ITERATIONS,
    ).hex()
    return f"{PASSWORD_ALGORITHM}${PASSWORD_ITERATIONS}${salt}${digest}"


def _verify_pbkdf2_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_raw, salt, expected_digest = password_hash.split("$", 3)
        iterations = int(iterations_raw)
    except ValueError:
        return False

    if algorithm != PASSWORD_ALGORITHM:
        return False

    actual_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        iterations,
    ).hex()
    return hmac.compare_digest(actual_digest, expected_digest)


def verify_password(password: str, password_hash: str) -> bool:
    if password_hash.startswith(f"{PASSWORD_ALGORITHM}$"):
        return _verify_pbkdf2_password(password, password_hash)

    if len(password_hash) == LEGACY_SHA256_LENGTH:
        legacy_digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(legacy_digest, password_hash)

    return False


def needs_password_rehash(password_hash: str) -> bool:
    return not password_hash.startswith(f"{PASSWORD_ALGORITHM}$")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_signed_token(payload: dict[str, Any], secret_key: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_part = _base64url_encode(
        json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    payload_part = _base64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_part}.{payload_part}"
    signature = hmac.new(
        secret_key.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{signing_input}.{_base64url_encode(signature)}"


def decode_signed_token(
    token: str,
    secret_key: str,
    *,
    verify_exp: bool = True,
) -> dict[str, Any]:
    try:
        header_part, payload_part, signature_part = token.split(".", 2)
    except ValueError as exc:
        raise TokenError("Invalid token format") from exc

    signing_input = f"{header_part}.{payload_part}"
    expected_signature = hmac.new(
        secret_key.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()

    try:
        actual_signature = _base64url_decode(signature_part)
    except Exception as exc:
        raise TokenError("Invalid token signature") from exc

    if not hmac.compare_digest(actual_signature, expected_signature):
        raise TokenError("Invalid token signature")

    try:
        header = json.loads(_base64url_decode(header_part))
        payload = json.loads(_base64url_decode(payload_part))
    except Exception as exc:
        raise TokenError("Invalid token payload") from exc

    if header.get("alg") != "HS256" or header.get("typ") != "JWT":
        raise TokenError("Unsupported token header")

    if verify_exp:
        expires_at = payload.get("exp")
        if not isinstance(expires_at, int):
            raise TokenError("Missing token expiry")
        if datetime.now(timezone.utc).timestamp() >= expires_at:
            raise TokenError("Token expired")

    return payload
