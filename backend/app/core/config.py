"""Central application settings; all secrets are environment supplied."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://researchforge:researchforge@localhost:5432/researchforge"
    jwt_secret: str = "dev-only-change-me"
    access_token_minutes: int = 30
    refresh_token_days: int = 30
    frontend_origin: str = "http://localhost:5173"
    storage_dir: str = "./storage"
    llm_provider: str = "fake"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-haiku-latest"
    docs_enabled: bool = True
    request_id_header: str = "X-Request-ID"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def validate_production(self) -> None:
        """Fail closed for unsafe production defaults without blocking local development."""
        if self.app_env.lower() != "production":
            return
        problems: list[str] = []
        if len(self.jwt_secret) < 32 or self.jwt_secret == "dev-only-change-me":
            problems.append("JWT_SECRET must be a unique random value of at least 32 characters")
        if self.frontend_origin.strip() in {"", "*"}:
            problems.append("FRONTEND_ORIGIN must be an explicit trusted origin")
        if self.llm_provider not in {"fake", "openai", "anthropic"}:
            problems.append("LLM_PROVIDER must be fake, openai, or anthropic")
        if problems:
            raise ValueError("Unsafe production configuration: " + "; ".join(problems))


settings = Settings()
