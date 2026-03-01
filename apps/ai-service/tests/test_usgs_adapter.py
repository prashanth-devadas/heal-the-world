import sys
import unittest
from unittest.mock import AsyncMock, patch, MagicMock

# Stub httpx before importing usgs (which imports httpx at top-level)
sys.modules.setdefault("httpx", MagicMock())

from src.adapters.usgs import USGSAdapter


class TestUSGSAdapter(unittest.IsolatedAsyncioTestCase):
    async def test_usgs_fetch_returns_events(self):
        adapter = USGSAdapter()
        mock_response = {
            "features": [
                {
                    "properties": {
                        "mag": 6.8, "place": "Philippines",
                        "time": 1709000000000, "alert": "orange",
                        "tsunami": 0, "sig": 800
                    },
                    "geometry": {"coordinates": [121.0, 15.0, 10.0]}
                }
            ]
        }
        with patch.object(adapter, "_fetch_raw", new=AsyncMock(return_value=mock_response)):
            events = await adapter.fetch()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].source, "USGS")
        self.assertEqual(events[0].event_type, "earthquake")
        self.assertGreater(events[0].confidence, 0)
        self.assertEqual(events[0].location["lat"], 15.0)
        self.assertEqual(events[0].location["lng"], 121.0)

    async def test_usgs_filters_low_magnitude(self):
        adapter = USGSAdapter(min_magnitude=5.0)
        mock_response = {
            "features": [
                {
                    "properties": {
                        "mag": 3.2, "place": "Remote Ocean",
                        "time": 1709000000000, "alert": None,
                        "tsunami": 0, "sig": 100
                    },
                    "geometry": {"coordinates": [150.0, -40.0, 20.0]}
                }
            ]
        }
        with patch.object(adapter, "_fetch_raw", new=AsyncMock(return_value=mock_response)):
            events = await adapter.fetch()
        self.assertEqual(len(events), 0)


if __name__ == "__main__":
    unittest.main()
