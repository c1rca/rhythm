# Rhythm

A fast, local-first recurring-task scheduler with streaks, history, custom cron rhythms, and optional Gotify, email, and SMS notifications.

## Run with Docker Compose

```bash
cp .env.example .env
# Edit .env for notifications or set HOUSEHOLD_TIMEZONE (defaults to America/New_York).
docker compose up -d --build
```

Open `http://localhost:8091` (or the `HOST_PORT` you set).

SQLite data and backups live in named Docker volumes, outside Git. To stop the app without deleting data:

```bash
docker compose down
```

## Local development

```bash
npm ci
cp .env.example .env
npm run build
npm run start
```

Run the test suite with `npm test`.

## Notifications

All notification settings are optional. Put Gotify, SMTP, recipient, and SMS-gateway values only in your ignored `.env`; never commit them. The committed `.env.example` intentionally contains no credentials or personal contact details.
