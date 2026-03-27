# Security Policy

This document outlines security practices and configuration for ForgeERP.

## Rate Limiting

- API endpoints under `/api/v1` are rate-limited to 100 requests per minute by default.
- The `/status/metrics` endpoint is exempt.
- In test environments (`NODE_ENV=test`) rate limiting is disabled.

Configure via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` environment variables if needed.

## Role-Based Access Control (RBAC)

Three roles exist:

- `viewer`: read-only access
- `operator`: can create/update/delete operational data (inventory, orders, manufacturing, etc.)
- `admin`: can manage users, API keys, webhooks, and factory settings

Authorization is enforced by middleware:

- `requireOperatorForMutations`: applied to most mutating routes; allows `operator` and `admin` and `superuser`.
- `requireAdminForMutations`: applied to sensitive routes (users, API keys, webhooks, factory); allows `admin` and `superuser`.

Superusers bypass all role checks.

## Webhook Signatures

Inbound webhooks (`POST /api/v1/webhooks/inbound`) must include an `X-Webhook-Signature` header containing a hex-encoded HMAC-SHA256 of the raw request body, computed with the `WEBHOOK_SECRET` environment variable. If the secret is not set, the endpoint returns 503.

## Structured Logging

- In production (`NODE_ENV=production`), API logs are JSON-structured using `pino-http`.
- In development, `morgan` dev format is used.
- Log level controlled by `LOG_LEVEL` env (default `info`).
- Each request gets a unique `X-Request-ID` (generated if missing) which is included in logs.

## Metrics

A Prometheus metrics endpoint is available at `GET /api/v1/status/metrics`. It exposes:

- `http_requests_total` (labels: method, route, status)
- `nodejs_memory_usage_bytes` (by memory type)
- `uptime_seconds`

Metrics are collected via `prom-client`. The endpoint is not rate-limited.

## Secrets and Environment

- `SECRET_KEY`: used to sign JWT tokens (minimum 32 characters). Keep secret and rotated periodically.
- `WEBHOOK_SECRET`: HMAC secret for verifying inbound webhooks.
- Database credentials (`DATABASE_URL`) should be secured.
- Do not commit `.env` files. Use `.env.example` as a template.

## Dependency Updates

We recommend enabling Dependabot on GitHub to receive automated PRs for security updates. See `.github/dependabot.yml`.

## Reporting Security Issues

Do not open GitHub issues for security vulnerabilities. Contact the maintainers privately.

## Additional Hardening (Future)

- Implement rate limiting per IP/user.
- Add field-level audit for sensitive changes.
- Enforce password policies and multi-factor authentication.
- Enable TLS everywhere (handled by deployment infra).
- Regular vulnerability scanning (e.g., `npm audit`, Snyk).
