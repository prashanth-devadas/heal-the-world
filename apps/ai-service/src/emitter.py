import json
import redis
from .config import settings
from .adapters.base import OracleEvent
from typing import Any

_redis_client: redis.Redis | None = None


def _get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


def emit_campaign_proposal(scored: dict[str, Any]) -> None:
    event: OracleEvent = scored["event"]
    lng, lat = event.location["lng"], event.location["lat"]
    payload = {
        "type": event.event_type,
        "region": event.region,
        "bbox": [lng - 2, lat - 2, lng + 2, lat + 2],
        "confidence": scored["confidence"],
        "severity": scored["severity"],
        "estimated_affected_population": 100_000,
        "fundraising_target_usd": scored["fundraising_target_usd"],
        "oracle_sources": [event.source],
        "campaign_deadline_days": 21,
        "oracle_confirmed": True,
        "prediction_window": {"start": "", "end": ""},
    }
    try:
        _get_redis().publish("campaign:proposals", json.dumps(payload))
    except Exception as e:
        print(f"Redis publish error: {e}")
