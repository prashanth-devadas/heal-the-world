import asyncio
import logging
from .adapters.usgs import USGSAdapter
from .adapters.gdacs import GDACSAdapter
from .pipeline import should_create_campaign
from .emitter import emit_campaign_proposal
from .config import settings

log = logging.getLogger(__name__)
ADAPTERS = [USGSAdapter(min_magnitude=5.0), GDACSAdapter()]


async def run_once() -> None:
    all_events = []
    for adapter in ADAPTERS:
        try:
            events = await adapter.fetch()
            all_events.extend(events)
            log.info(f"{adapter.__class__.__name__}: {len(events)} events")
        except Exception as e:
            log.error(f"{adapter.__class__.__name__} failed: {e}")

    proposals = should_create_campaign(all_events, settings.prediction_confidence_threshold)
    for proposal in proposals:
        emit_campaign_proposal(proposal)
        log.info(f"Emitted proposal: {proposal['event'].region}")


async def run_loop() -> None:
    while True:
        await run_once()
        await asyncio.sleep(settings.poll_interval_seconds)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_loop())
