from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class OracleEvent:
    source: str
    event_type: str
    raw_data: dict[str, Any]
    location: dict[str, float]  # {"lat": ..., "lng": ...}
    confidence: float  # 0.0 - 1.0
    magnitude: float = 0.0
    region: str = ""


class OracleAdapter(ABC):
    @abstractmethod
    async def fetch(self) -> list[OracleEvent]:
        """Fetch and normalize events from this oracle source."""
        ...

    @abstractmethod
    async def _fetch_raw(self) -> dict:
        """Fetch raw data from the external API."""
        ...
