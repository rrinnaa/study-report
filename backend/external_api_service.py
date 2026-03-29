import asyncio
import logging
import time
from collections import defaultdict, deque
from typing import Deque

import httpx

from .config import (
    EXTERNAL_API_KEY,
    EXTERNAL_API_MAX_RETRIES,
    EXTERNAL_API_RATE_LIMIT_PER_MINUTE,
    EXTERNAL_API_TIMEOUT_SECONDS,
    EXTERNAL_API_URL,
)

logger = logging.getLogger('external_api')


class SimpleRateLimiter:
    def __init__(self, max_requests_per_minute: int):
        self.max_requests_per_minute = max_requests_per_minute
        self._requests: dict[str, Deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.time()
        one_minute_ago = now - 60
        bucket = self._requests[key]

        while bucket and bucket[0] < one_minute_ago:
            bucket.popleft()

        if len(bucket) >= self.max_requests_per_minute:
            return False

        bucket.append(now)
        return True


class ExternalStudyTipService:
    def __init__(self):
        self.rate_limiter = SimpleRateLimiter(EXTERNAL_API_RATE_LIMIT_PER_MINUTE)

    async def get_study_tip(self, client_id: str) -> dict:
        if not self.rate_limiter.allow(client_id):
            return {
                'tip': 'Слишком много запросов. Повторите попытку чуть позже.',
                'source': 'rate-limit-fallback',
                'is_fallback': True,
            }

        headers = {}
        if EXTERNAL_API_KEY:
            headers['X-Api-Key'] = EXTERNAL_API_KEY

        for attempt in range(1, EXTERNAL_API_MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=EXTERNAL_API_TIMEOUT_SECONDS) as client:
                    response = await client.get(EXTERNAL_API_URL, headers=headers)
                    response.raise_for_status()
                    payload = response.json()
                    return self._normalize_response(payload)
            except (httpx.TimeoutException, httpx.HTTPError, ValueError) as exc:
                logger.warning('External API attempt %s failed: %s', attempt, exc)
                if attempt < EXTERNAL_API_MAX_RETRIES:
                    await asyncio.sleep(0.4 * attempt)

        return {
            'tip': 'Начните отчёт с краткого введения и цели работы: это упростит проверку структуры.',
            'source': 'server-fallback',
            'is_fallback': True,
        }

    def _normalize_response(self, payload: object) -> dict:
        if isinstance(payload, list) and payload:
            first_item = payload[0]
            if isinstance(first_item, dict):
                tip = str(first_item.get('quote') or first_item.get('tip') or '').strip()
                source = str(first_item.get('author') or 'api-ninjas').strip()
                if tip:
                    return {'tip': tip, 'source': source, 'is_fallback': False}

        if isinstance(payload, dict):
            tip = str(payload.get('tip') or payload.get('quote') or '').strip()
            source = str(payload.get('source') or payload.get('author') or 'external-api').strip()
            if tip:
                return {'tip': tip, 'source': source, 'is_fallback': False}

        return {
            'tip': 'Проверьте, что каждый раздел отчёта начинается с собственного заголовка.',
            'source': 'normalize-fallback',
            'is_fallback': True,
        }


external_study_tip_service = ExternalStudyTipService()
