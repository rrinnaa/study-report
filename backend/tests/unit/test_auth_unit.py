import pytest
from jose import jwt

from backend.auth import (
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    create_access_token,
    validate_password_policy,
    verify_access_token,
)


@pytest.mark.unit
def test_validate_password_policy_accepts_valid_password():
    assert validate_password_policy("Valid12")


@pytest.mark.unit
def test_validate_password_policy_rejects_invalid_password():
    assert not validate_password_policy("short")
    assert not validate_password_policy("nouppercase1")
    assert not validate_password_policy("NoSymbol12!")


@pytest.mark.unit
def test_verify_access_token_rejects_wrong_type_token():
    wrong_type = jwt.encode(
        {"sub": "u@example.com", "user_id": 1, "type": "refresh"},
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )
    assert verify_access_token(wrong_type) is None


@pytest.mark.unit
def test_create_and_verify_access_token_roundtrip():
    token = create_access_token({"sub": "u@example.com", "user_id": 10})
    payload = verify_access_token(token)
    assert payload is not None
    assert payload["sub"] == "u@example.com"
    assert payload["user_id"] == 10
    assert payload["type"] == "access"
