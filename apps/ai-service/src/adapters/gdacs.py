import httpx
import xml.etree.ElementTree as ET
from .base import OracleAdapter, OracleEvent

GDACS_URL = "https://www.gdacs.org/xml/rss.xml"


class GDACSAdapter(OracleAdapter):
    async def _fetch_raw(self) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(GDACS_URL)
            r.raise_for_status()
            return {"content": r.text}

    async def fetch(self) -> list[OracleEvent]:
        raw = await self._fetch_raw()
        try:
            root = ET.fromstring(raw["content"])
        except ET.ParseError:
            return []
        ns = {
            "geo": "http://www.w3.org/2003/01/geo/wgs84_pos#",
            "gdacs": "http://www.gdacs.org",
        }
        events = []
        for item in root.findall(".//item"):
            title = item.findtext("title") or ""
            lat_el = item.find("geo:lat", ns)
            lng_el = item.find("geo:long", ns)
            if lat_el is None or lng_el is None:
                continue
            alert = item.findtext("{http://www.gdacs.org}alertlevel") or "green"
            confidence = {"red": 0.9, "orange": 0.7, "green": 0.4}.get(alert.lower(), 0.3)
            events.append(OracleEvent(
                source="GDACS",
                event_type="multi_hazard",
                raw_data={"title": title, "alert": alert},
                location={"lat": float(lat_el.text or 0), "lng": float(lng_el.text or 0)},
                confidence=confidence,
                region=title,
            ))
        return events
