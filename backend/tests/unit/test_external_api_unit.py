import pytest

from backend.external_api_service import ExternalStudyTipService, SimpleRateLimiter


@pytest.mark.unit
def test_rate_limiter_blocks_after_limit():
    limiter = SimpleRateLimiter(max_requests_per_minute=1)
    assert limiter.allow("client-1") is True
    assert limiter.allow("client-1") is False


@pytest.mark.unit
def test_normalize_response_for_list_payload():
    service = ExternalStudyTipService()
    payload = [{"quote": "Study daily", "author": "Mentor"}]
    result = service._normalize_response(payload)
    assert result["tip"] == "Study daily"
    assert result["source"] == "Mentor"
    assert result["is_fallback"] is False


@pytest.mark.unit
def test_normalize_response_for_invalid_payload_fallback():
    service = ExternalStudyTipService()
    result = service._normalize_response({"invalid": "payload"})
    assert result["is_fallback"] is True
    assert result["source"] == "normalize-fallback"
