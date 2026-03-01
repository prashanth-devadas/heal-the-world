from .adapters.base import OracleEvent
from typing import Any

SEVERITY_THRESHOLDS: dict[str, list[tuple[float, str]]] = {
    "earthquake": [(7.5, "critical"), (6.5, "high"), (5.5, "medium"), (0.0, "low")],
    "hurricane":  [(4.0, "critical"), (3.0, "high"), (2.0, "medium"), (0.0, "low")],
    "default":    [(0.9, "critical"), (0.75, "high"), (0.55, "medium"), (0.0, "low")],
}

COST_ESTIMATES: dict[tuple[str, str], int] = {
    ("earthquake", "critical"): 5_000_000,
    ("earthquake", "high"):     2_000_000,
    ("earthquake", "medium"):     800_000,
    ("earthquake", "low"):        200_000,
    ("hurricane",  "critical"): 8_000_000,
    ("hurricane",  "high"):     3_000_000,
    ("hurricane",  "medium"):   1_000_000,
    ("hurricane",  "low"):        300_000,
}


def _get_severity(event_type: str, magnitude: float) -> str:
    thresholds = SEVERITY_THRESHOLDS.get(event_type, SEVERITY_THRESHOLDS["default"])
    for threshold, label in thresholds:
        if magnitude >= threshold:
            return label
    return "low"


def score_events(events: list[OracleEvent]) -> list[dict[str, Any]]:
    scored = []
    for e in events:
        severity = _get_severity(e.event_type, e.magnitude)
        target = COST_ESTIMATES.get((e.event_type, severity), 500_000)
        scored.append({
            "event": e,
            "severity": severity,
            "fundraising_target_usd": target,
            "confidence": e.confidence,
        })
    return scored


def should_create_campaign(
    events: list[OracleEvent],
    threshold: float = 0.70,
) -> list[dict[str, Any]]:
    scored = score_events(events)
    return [s for s in scored if s["confidence"] >= threshold]
