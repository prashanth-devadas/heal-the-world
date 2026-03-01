from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379"
    database_url: str = ""
    acled_api_key: str = ""
    nasa_firms_api_key: str = ""
    prediction_confidence_threshold: float = 0.70
    poll_interval_seconds: int = 900  # 15 minutes
    campaign_api_url: str = "http://localhost:3001"

    class Config:
        env_file = ".env"


settings = Settings()
