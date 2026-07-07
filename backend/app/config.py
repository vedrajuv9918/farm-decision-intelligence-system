from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FarmWise"
    openweather_api_key: str = Field(default="", alias="OPENWEATHER_API_KEY")
    data_gov_api_key_current: str = Field(default="", alias="DATA_GOV_API_KEY_CURRENT")
    data_gov_resource_id_current: str = Field(
        default="35985678-0d79-46b4-9ed6-6f13308a1d24",
        alias="DATA_GOV_RESOURCE_ID_CURRENT",
    )
    data_gov_api_key_historical: str = Field(default="", alias="DATA_GOV_API_KEY_HISTORICAL")
    data_gov_resource_id_historical: str = Field(
        default="9ef84268-d588-465a-a308-a864a43d0070",
        alias="DATA_GOV_RESOURCE_ID_HISTORICAL",
    )
    database_url: str = Field(
        default="",
        alias="DATABASE_URL",
    )
    frontend_origin: str = Field(default="http://localhost:5173", alias="FRONTEND_ORIGIN")
    http_timeout_seconds: float = 8.0
    weather_cache_seconds: int = 900
    mandi_cache_seconds: int = 21600
    location_cache_seconds: int = 86400

    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
