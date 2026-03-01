import unittest
from src.pipeline import score_events, should_create_campaign
from src.adapters.base import OracleEvent


def make_event(event_type: str, magnitude: float, confidence: float, region: str = "Test Region") -> OracleEvent:
    return OracleEvent(
        source="TEST",
        event_type=event_type,
        raw_data={},
        location={"lat": 0.0, "lng": 0.0},
        confidence=confidence,
        magnitude=magnitude,
        region=region,
    )


class TestPipeline(unittest.TestCase):
    def test_score_critical_earthquake(self):
        event = make_event("earthquake", 7.8, 0.9)
        scored = score_events([event])
        self.assertEqual(len(scored), 1)
        self.assertEqual(scored[0]["severity"], "critical")
        self.assertEqual(scored[0]["fundraising_target_usd"], 5_000_000)

    def test_score_medium_earthquake(self):
        event = make_event("earthquake", 5.8, 0.6)
        scored = score_events([event])
        self.assertEqual(scored[0]["severity"], "medium")
        self.assertEqual(scored[0]["fundraising_target_usd"], 800_000)

    def test_should_create_campaign_above_threshold(self):
        event = make_event("earthquake", 7.0, 0.85)
        proposals = should_create_campaign([event], threshold=0.70)
        self.assertEqual(len(proposals), 1)

    def test_should_not_create_campaign_below_threshold(self):
        event = make_event("earthquake", 5.5, 0.50)
        proposals = should_create_campaign([event], threshold=0.70)
        self.assertEqual(len(proposals), 0)

    def test_score_preserves_confidence(self):
        event = make_event("earthquake", 6.8, 0.75)
        scored = score_events([event])
        self.assertEqual(scored[0]["confidence"], 0.75)


if __name__ == "__main__":
    unittest.main()
