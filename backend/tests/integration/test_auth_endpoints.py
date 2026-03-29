import pytest


@pytest.mark.integration
def test_register_login_refresh_logout_flow(client):
    test_client, _ = client

    register_payload = {
        "first_name": "Flow",
        "last_name": "User",
        "email": "flow@example.com",
        "password": "Flow12",
    }
    register_res = test_client.post("/api/register", json=register_payload)
    assert register_res.status_code == 201
    body = register_res.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["user"]["email"] == "flow@example.com"

    login_res = test_client.post(
        "/api/login",
        json={"email": "flow@example.com", "password": "Flow12"},
    )
    assert login_res.status_code == 200
    login_body = login_res.json()
    assert login_body["token_type"] == "bearer"

    refresh_res = test_client.post(
        "/api/refresh",
        json={"refresh_token": login_body["refresh_token"]},
    )
    assert refresh_res.status_code == 200
    assert refresh_res.json()["user"]["email"] == "flow@example.com"

    profile_res = test_client.get(
        "/api/profile",
        headers={"Authorization": f"Bearer {login_body['access_token']}"},
    )
    assert profile_res.status_code == 200
    assert profile_res.json()["first_name"] == "Flow"

    logout_res = test_client.post(
        "/api/logout",
        headers={"Authorization": f"Bearer {login_body['access_token']}"},
    )
    assert logout_res.status_code == 200


@pytest.mark.integration
def test_register_validation_and_duplicate_email(client):
    test_client, _ = client
    bad_password = {
        "first_name": "Bad",
        "last_name": "Pwd",
        "email": "badpwd@example.com",
        "password": "bad",
    }
    bad_res = test_client.post("/api/register", json=bad_password)
    assert bad_res.status_code == 400
    assert "Пароль должен содержать" in bad_res.json()["detail"]

    ok_payload = {
        "first_name": "Dup",
        "last_name": "User",
        "email": "dup@example.com",
        "password": "Dup123",
    }
    assert test_client.post("/api/register", json=ok_payload).status_code == 201
    dup_res = test_client.post("/api/register", json=ok_payload)
    assert dup_res.status_code == 400
    assert "уже существует" in dup_res.json()["detail"]
