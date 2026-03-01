import httpx
from .base import OracleAdapter, OracleEvent

USGS_URL = (
    "https://earthquake.usgs.gov/fdsnws/event/1/query"
    "?format=geojson&orderby=time&limit=100&minmagnitude={min_mag}"
    "&starttime=now-1day"
)


class USGSAdapter(OracleAdapter):
    def __init__(self, min_magnitude: float = 5.0):
        self.min_magnitude = min_magnitude

    async def _fetch_raw(self) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(USGS_URL.format(min_mag=self.min_magnitude))
            r.raise_for_status()
            return r.json()

    async def fetch(self) -> list[OracleEvent]:
        data = await self._fetch_raw()
        events = []
        for feature in data.get("features", []):
            props = feature["properties"]
            mag = props.get("mag", 0) or 0
            if mag < self.min_magnitude:
                continue
            coords = feature["geometry"]["coordinates"]
            sig = props.get("sig", 0) or 0
            confidence = min(sig / 1000.0, 1.0)
            events.append(OracleEvent(
                source="USGS",
                event_type="earthquake",
                raw_data=props,
                location={"lat": coords[1], "lng": coords[0]},
                confidence=confidence,
                magnitude=mag,
                region=props.get("place", "Unknown"),
            ))
        return events
