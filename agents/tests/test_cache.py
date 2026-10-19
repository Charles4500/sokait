import asyncio

from pitchpulse_agents.cache import TTLCache
from pitchpulse_agents.models import Insight, NarrationOut
from pitchpulse_agents.offline import OfflineChatClient
from pitchpulse_agents.workflow import InsightsEngine

from .conftest import make_moment


async def test_concurrent_misses_share_one_call():
    cache: TTLCache[int] = TTLCache()
    calls = 0

    async def slow():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.05)
        return 7

    results = await asyncio.gather(*(cache.get_or_run("k", slow) for _ in range(5)))
    assert calls == 1
    assert [v for v, _ in results] == [7] * 5
    assert sorted(hit for _, hit in results) == [False, True, True, True, True]


async def test_rejected_results_are_shared_but_not_stored():
    cache: TTLCache[str] = TTLCache()
    calls = 0

    async def bad():
        nonlocal calls
        calls += 1
        return "failed"

    await cache.get_or_run("k", bad, keep=lambda v: v != "failed")
    await cache.get_or_run("k", bad, keep=lambda v: v != "failed")
    assert calls == 2  # retried, not served from cache


async def test_entries_expire():
    cache: TTLCache[int] = TTLCache(ttl_s=0)
    cache.put("k", 1)
    await asyncio.sleep(0.001)
    assert cache.get("k") is None


async def test_lru_is_bounded():
    cache: TTLCache[int] = TTLCache(max_items=2)
    for i in range(3):
        cache.put(str(i), i)
    assert cache.get("0") is None and cache.get("2") == 2


async def test_waiter_survives_a_cancelled_leader():
    cache: TTLCache[int] = TTLCache()
    started = asyncio.Event()

    async def hang():
        started.set()
        await asyncio.sleep(10)
        return 1

    async def quick():
        return 2

    leader = asyncio.create_task(cache.get_or_run("k", hang))
    await started.wait()
    waiter = asyncio.create_task(cache.get_or_run("k", quick))
    await asyncio.sleep(0)
    leader.cancel()
    assert await waiter == (2, False)  # ran the call itself instead of failing


class Counting(OfflineChatClient):
    def __init__(self):
        super().__init__()
        self.analyst_calls = 0
        self.narrator_calls = 0

    async def _respond(self, messages, options):
        if options.get("response_format") is Insight:
            self.analyst_calls += 1
            await asyncio.sleep(0.02)  # long enough for requests to overlap
        elif options.get("response_format") is NarrationOut:
            self.narrator_calls += 1
        return await super()._respond(messages, options)


async def test_many_viewers_of_one_moment_cost_one_analysis():
    client = Counting()
    engine = InsightsEngine(client, budget_s=5)
    casual = [{"persona": "casual", "language": "English"}]
    spanish = [{"persona": "casual", "language": "Spanish"}]
    overlays = await asyncio.gather(
        *(engine.process(make_moment(segments=casual)) for _ in range(10)),
        engine.process(make_moment(segments=spanish)),
    )
    assert client.analyst_calls == 1
    assert all(not o.fallback for o in overlays)
    # Later viewers in an already-narrated segment reuse the verified text.
    before = client.narrator_calls
    again = await engine.process(make_moment(segments=casual))
    assert client.narrator_calls == before
    assert "shared" in again.trace[1].note and "shared" in again.trace[2].note


async def test_failed_analysis_is_retried_for_the_next_viewer():
    class FlakyOnce(OfflineChatClient):
        failed = False

        async def _respond(self, messages, options):
            if options.get("response_format") is Insight and not self.failed:
                self.failed = True
                raise ConnectionError("blip")
            return await super()._respond(messages, options)

    engine = InsightsEngine(FlakyOnce(), budget_s=5)
    first = await engine.process(make_moment())
    second = await engine.process(make_moment())
    assert first.fallback and not second.fallback


async def test_moment_is_remembered_once_however_many_viewers():
    engine = InsightsEngine(OfflineChatClient(), budget_s=5)
    for lang in ("English", "French", "Arabic"):
        seg = [{"persona": "analyst", "language": lang}]
        await engine.process(make_moment(segments=seg))
    assert len(engine.memory.get("main", "1:57").aired) == 1
