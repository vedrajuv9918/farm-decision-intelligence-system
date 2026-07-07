from __future__ import annotations

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential


class ExternalServiceError(RuntimeError):
    pass


@retry(
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.TransportError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.4, min=0.4, max=3),
    reraise=True,
)
async def get_json(url: str, *, params: dict[str, object] | None = None, timeout: float = 8.0) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout, headers={"User-Agent": "FarmWise/1.0"}) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:240]
        raise ExternalServiceError(f"HTTP {exc.response.status_code} from external service: {detail}") from exc
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        raise ExternalServiceError(f"External service request failed: {exc}") from exc
    except ValueError as exc:
        raise ExternalServiceError("External service returned invalid JSON") from exc
