# API Gateway & Authentication Guide

## Overview

NovaMart uses Kong API Gateway as the single entry point for all external traffic. Kong handles routing, rate limiting, authentication verification, and request logging.

- **External URL:** api.novamart.com
- **Internal Dashboard:** kong-admin.novamart.internal
- **Owner:** Platform Engineering (Slack: #team-platform)

## Authentication

### User Authentication (External)
External API calls (from web/mobile apps) use JWT tokens:

1. User logs in via `POST /api/v1/auth/login` (handled by User Service)
2. User Service validates credentials and returns a JWT token
3. Client includes the token in subsequent requests: `Authorization: Bearer {token}`
4. Kong validates the JWT signature on every request before routing to the backend service
5. JWT token contains: `user_id`, `email`, `roles`, `exp` (expiration)

Token configuration:
- **Access token TTL:** 1 hour
- **Refresh token TTL:** 30 days
- **Signing algorithm:** RS256
- **Public key endpoint:** `GET /api/v1/auth/.well-known/jwks.json`

### Service-to-Service Authentication (Internal)
Internal service communication uses mutual TLS (mTLS) managed by Istio service mesh:
- Each service has its own TLS certificate, auto-rotated by cert-manager
- Services can only communicate with explicitly allowed services (defined in Istio AuthorizationPolicy)
- No API keys or tokens needed for internal calls — identity is verified at the network level

## Rate Limiting

### Default Limits
| Client Type | Rate Limit | Window |
|------------|------------|--------|
| Authenticated user | 1,000 requests/minute | Sliding window |
| Unauthenticated | 100 requests/minute | Sliding window |
| Internal service | No limit | - |

### Per-Endpoint Overrides
Some endpoints have stricter limits:

| Endpoint | Limit | Reason |
|----------|-------|--------|
| `POST /api/v1/auth/login` | 10/minute per IP | Brute force protection |
| `POST /api/v1/orders` | 5/minute per user | Prevent order spam |
| `POST /api/v1/payments` | 5/minute per user | Prevent payment fraud |
| `GET /api/v1/search` | 60/minute per user | Expensive query |

When rate limited, the API returns `429 Too Many Requests` with headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705312800
Retry-After: 30
```

## API Versioning

All external APIs are versioned: `/api/v1/`, `/api/v2/`, etc.

Rules:
- Breaking changes require a new version
- Old versions are supported for 6 months after a new version is released
- Deprecation notices are sent via `Deprecation` header and email to API consumers

## Routing

Kong routes requests to backend services based on URL prefix:

| Path Prefix | Backend Service | Notes |
|-------------|----------------|-------|
| `/api/v1/orders` | Order Service | |
| `/api/v1/payments` | Payment Service | |
| `/api/v1/products` | Catalog Service | |
| `/api/v1/inventory` | Inventory Service | Internal only |
| `/api/v1/search` | Search Service | |
| `/api/v1/auth` | User Service | |
| `/api/v1/users` | User Service | |
| `/api/v1/notifications` | Notification Service | |
| `/api/v1/shipments` | Shipping Service | |

## CORS Configuration

The API Gateway allows requests from:
- `https://www.novamart.com`
- `https://app.novamart.com`
- `https://admin.novamart.com`
- `http://localhost:*` (development only — disabled in production)

## Troubleshooting

### 401 Unauthorized
1. Check if the JWT token is expired: Decode at jwt.io
2. Check if the token was issued by the correct auth server
3. Check if the user's account is disabled in User Service

### 403 Forbidden
1. Check if the user has the required role for the endpoint
2. Some endpoints require specific roles: `admin`, `merchant`, `support`
3. Check the service's authorization middleware for role requirements

### 502 Bad Gateway
1. The backend service is probably down or unhealthy
2. Check pod status: `kubectl get pods -l app={service}`
3. Check if the service is passing health checks: `curl {service}.novamart.internal/health`
4. Check Kong upstream health: Kong admin dashboard → Upstreams

### 429 Rate Limited
1. Check `X-RateLimit-Remaining` header to see remaining quota
2. Implement exponential backoff in the client
3. If legitimate high-volume use case, request a rate limit increase via #team-platform
