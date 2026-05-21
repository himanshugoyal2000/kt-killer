# Payment Service Runbook

## Service Overview

The Payment Service handles all financial transactions for NovaMart. It processes credit card payments via Stripe (primary) and PayPal (secondary), handles refunds, and manages stored payment methods.

- **Repository:** github.com/novamart/payment-service
- **Language:** Java 17, Spring Boot 3.2
- **Database:** PostgreSQL 15 (payment-db.novamart.internal:5432)
- **Owner:** Payments team (Slack: #team-payments)
- **On-call rotation:** PagerDuty schedule "payments-oncall"

## Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/payments` | POST | Initiate a new payment |
| `/api/v1/payments/{id}` | GET | Get payment status |
| `/api/v1/payments/{id}/refund` | POST | Initiate a refund |
| `/api/v1/payment-methods` | GET | List user's saved payment methods |
| `/api/v1/payment-methods` | POST | Add a new payment method |

## Retry Policy

Failed payment attempts are retried automatically with the following configuration:

- **Max retries:** 3
- **Backoff strategy:** Exponential with jitter
- **Initial delay:** 1 second
- **Max delay:** 30 seconds
- **Retryable errors:** Network timeouts, 5xx from Stripe, rate limit errors
- **Non-retryable errors:** Card declined, insufficient funds, invalid card number

After all retries are exhausted, the payment is marked as `FAILED` and a `payment-failed` event is published to Kafka. The failed payment is also written to the `payments-dlq` (dead letter queue) Kafka topic for manual review.

## Dead Letter Queue (DLQ)

The `payments-dlq` topic receives all permanently failed payments. A scheduled job runs every 15 minutes to process the DLQ:

1. Reads failed payments from `payments-dlq`
2. Attempts to classify the failure reason
3. Auto-retryable failures (e.g., temporary Stripe outage) are re-queued
4. Permanent failures (e.g., card declined) are marked for manual review
5. Alert sent to #team-payments Slack channel if DLQ depth exceeds 100

## Monitoring & Alerts

### Key Dashboards
- **Payment Metrics:** grafana.novamart.internal/d/payments-overview
- **Stripe Integration:** grafana.novamart.internal/d/payments-stripe

### Alert Thresholds

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High Error Rate | Payment failure rate > 5% for 5 min | P1 (Critical) | Page on-call immediately |
| Elevated Error Rate | Payment failure rate > 2% for 10 min | P2 (High) | Notify #team-payments Slack |
| High Latency | p99 latency > 2 seconds for 5 min | P2 (High) | Check Stripe status page |
| DLQ Depth | DLQ messages > 100 | P3 (Medium) | Review DLQ dashboard |
| Stripe Webhook Lag | Webhook processing > 30 seconds behind | P3 (Medium) | Check consumer lag |

## Common Issues & Troubleshooting

### Payment Stuck in PENDING
1. Check if the Stripe webhook was received: `SELECT * FROM payment_events WHERE payment_id = ? ORDER BY created_at DESC`
2. If no webhook: Check Stripe dashboard for the payment status
3. If webhook received but not processed: Check the webhook consumer logs in Kibana
4. Manual fix: Call `POST /api/v1/payments/{id}/sync` to re-sync with Stripe

### Spike in Payment Failures
1. Check Stripe status page: status.stripe.com
2. Check if failures are concentrated on a specific card type or region
3. Check the error distribution: `SELECT error_code, COUNT(*) FROM payments WHERE status = 'FAILED' AND created_at > now() - interval '1 hour' GROUP BY error_code`
4. If it's a Stripe outage: Enable PayPal fallback via LaunchDarkly flag `payments.paypal-fallback`

### Refund Not Processing
1. Verify the original payment was in `COMPLETED` status
2. Check if refund was created in Stripe dashboard
3. Refund processing can take 5-10 business days depending on the bank
4. For urgent refunds, escalate to finance team via #team-finance Slack channel

## Configuration

Key configuration values in `application.yml`:

```yaml
payment:
  stripe:
    api-key: ${STRIPE_API_KEY}
    webhook-secret: ${STRIPE_WEBHOOK_SECRET}
    timeout-ms: 5000
  retry:
    max-attempts: 3
    initial-delay-ms: 1000
    max-delay-ms: 30000
    multiplier: 2.0
  paypal:
    enabled: false  # Enable via LaunchDarkly
    client-id: ${PAYPAL_CLIENT_ID}
    client-secret: ${PAYPAL_CLIENT_SECRET}
```
