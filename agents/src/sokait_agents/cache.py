"""Shared results so many viewers of the same moment cost one model call, not one each."""

from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable


class TTLCache[T]:
    """Bounded LRU with expiry, plus single-flight: concurrent misses for the same key
    share one in-flight call. Failed or `None` results are not cached, so a later
    request can try again. In-process; swap for Redis to share across replicas."""

    def __init__(self, max_items: int = 512, ttl_s: float = 900.0) -> None:
        self.max_items = max_items
        self.ttl_s = ttl_s
        self._items: OrderedDict[str, tuple[float, T]] = OrderedDict()
        self._inflight: dict[str, asyncio.Future[T | None]] = {}
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> T | None:
        item = self._items.get(key)
        if item is None:
            return None
        stored_at, value = item
        if time.monotonic() - stored_at > self.ttl_s:
            del self._items[key]
            return None
        self._items.move_to_end(key)
        return value

    def put(self, key: str, value: T) -> None:
        self._items[key] = (time.monotonic(), value)
        self._items.move_to_end(key)
        while len(self._items) > self.max_items:
            self._items.popitem(last=False)

    async def get_or_run(
        self,
        key: str,
        run: Callable[[], Awaitable[T | None]],
        keep: Callable[[T], bool] = lambda _: True,
    ) -> tuple[T | None, bool]:
        """Returns (value, from_cache). Requests already waiting always share the
        result; it is stored for later requests only if `keep(value)`. Exceptions
        from `run` reach every waiter."""
        cached = self.get(key)
        if cached is not None:
            self.hits += 1
            return cached, True
        pending = self._inflight.get(key)
        if pending is not None:
            try:
                value = await asyncio.shield(pending)
            except asyncio.CancelledError:
                # The leader was cancelled (e.g. its time budget ran out), not us:
                # run the call ourselves instead of failing.
                if not pending.cancelled():
                    raise
            else:
                self.hits += 1
                return value, True
        self.misses += 1
        future: asyncio.Future[T | None] = asyncio.get_running_loop().create_future()
        self._inflight[key] = future
        try:
            value = await run()
        except asyncio.CancelledError:
            future.cancel()
            raise
        except BaseException as e:
            future.set_exception(e)
            future.exception()  # mark retrieved: there may be no waiters
            raise
        else:
            future.set_result(value)
            if value is not None and keep(value):
                self.put(key, value)
            return value, False
        finally:
            if self._inflight.get(key) is future:
                del self._inflight[key]

    def stats(self) -> dict[str, int]:
        return {"items": len(self._items), "hits": self.hits, "misses": self.misses}
