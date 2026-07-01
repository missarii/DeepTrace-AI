from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    chat_provider: str = 'mock'
    openai_api_key: str = ''
    openai_chat_model: str = 'gpt-4o-mini'
    anthropic_api_key: str = ''
    anthropic_chat_model: str = 'claude-3-5-sonnet-latest'
    ollama_base_url: str = 'http://localhost:11434'
    ollama_chat_model: str = 'llama3.1:8b'
    search_provider: str = 'mock'
    tavily_api_key: str = ''
    brave_api_key: str = ''
    internal_token: str = 'change-me-internal-token'
    max_iterations: int = 3
    max_search_calls: int = 24
    max_concurrent_fetch: int = 6
    max_content_chars: int = 600000
    max_run_seconds: int = 600
    allow_js_render: bool = False

    class Config:
        env_file = '.env'
        extra = 'ignore'

settings = Settings()
