FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi uvicorn pydantic pydantic-settings httpx langgraph langchain-core trafilatura beautifulsoup4 lxml
COPY apps/agent/src ./src
COPY apps/agent/pyproject.toml ./
ENV PYTHONPATH=/app/src
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
