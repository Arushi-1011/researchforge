FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

# Install system dependencies required by WeasyPrint (Pango, Cairo, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e . \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app app

COPY --chown=app:app . .
COPY --chown=app:app entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && mkdir -p /app/storage \
    && chown -R app:app /app

USER app
EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
