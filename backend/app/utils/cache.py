from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass
class CacheEntry(Generic[T]):
    value: T
    expires_at: float


class TTLCache(Generic[T]):
    def __init__(self) -> None:
        self._items: dict[str, CacheEntry[T]] = {}

    def get(self, key: str) -> T | None:
        item = self._items.get(key)
        if not item:
            return None
        if item.expires_at < time.time():
            self._items.pop(key, None)
            return None
        return item.value

    def set(self, key: str, value: T, ttl_seconds: int) -> None:
        self._items[key] = CacheEntry(value=value, expires_at=time.time() + ttl_seconds)
