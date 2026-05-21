# Order Service Runbook

## Service Overview

The Order Service is the central orchestrator of NovaMart's e-commerce flow. It manages the entire order lifecycle from creation to fulfillment.

- **Repository:** github.com/novamart/order-service
- **Language:** Java 17, Spring Boot 3.2
- **Database:** PostgreSQL 15 (order-db.novamart.internal:5432)
- **Owner:** Order Platform team (Slack: #team-order-platform)
- **On-call rotation:** PagerDuty schedule "order-platform-oncall"

## Order States

```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
   ↓          ↓           ↓
CANCELLED  CANCELLED   CANCELLED (with refund)
```

- **PENDING:** Order created, waiting for payment confirmation
- **CONFIRMED:** Payment successful, inventory reserved
- **PROCESSING:** Being prepared for shipment at warehouse
- **SHIPPED:** Handed off to carrier, tracking number assigned
- **DELIVERED:** Carrier confirmed delivery
- **CANCELLED:** Order cancelled (can happen at any state before DELIVERED)

## Kafka Topics

### Published Events
- `order-created` — When a new order is placed
- `order-updated` — When order status changes
- `order-cancelled` — When an order is cancelled

### Consumed Events
- `payment-completed` — Moves order from PENDING to CONFIRMED
- `payment-failed` — Moves order to CANCELLED
- `inventory-reserved` — Confirms stock is available
- `inventory-unavailable` — Triggers partial order or cancellation
- `shipment-created` — Moves order to SHIPPED, stores tracking number
- `shipment-delivered` — Moves order to DELIVERED

## Database Schema

Key tables in the order database:

```sql
orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  shipping_address_id UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  product_id UUID NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL
)

order_events (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  event_type VARCHAR(50) NOT NULL,
  payload JSONB,
  created_at TIMESTAMP DEFAULT now()
)
```

## Common Issues & Troubleshooting

### Order Stuck in PENDING
An order stuck in PENDING means payment hasn't been confirmed. Steps:
1. Check the payment status: Query the Payment Service API `GET /api/v1/payments?order_id={id}`
2. If payment is COMPLETED but order is still PENDING: The `payment-completed` Kafka event may not have been consumed. Check consumer group lag for `order-service-payments` consumer group.
3. Manual fix: `POST /internal/orders/{id}/force-status?status=CONFIRMED` (requires admin token)

### Duplicate Orders
Occasionally users double-click the "Place Order" button. We have idempotency built in:
- Each order request includes a client-generated `idempotency_key`
- The Order Service checks for existing orders with the same key within 5 minutes
- If found, returns the existing order instead of creating a new one

If duplicates still appear, check if the frontend is sending different idempotency keys. Coordinate with the Frontend team (#team-frontend).

### Order Cancellation Failing
Orders can only be cancelled before DELIVERED status. Common failure reasons:
1. Order already DELIVERED — cannot cancel, redirect user to return/refund flow
2. Shipment already in transit — can attempt cancellation with carrier, but not guaranteed
3. Inventory release failing — check Inventory Service health, may need manual stock adjustment

## Scaling

The Order Service is the highest-throughput service at NovaMart:
- Average: 85,000 orders/day (~1 order/second)
- Peak (flash sales): 300,000 orders/day (~3.5 orders/second)
- Black Friday peak: 500,000 orders/day (~5.8 orders/second)

Current configuration: 5 replicas, 2 CPU / 4GB RAM each. Auto-scales to 12 replicas during flash sales (triggered by CPU > 70% or request queue depth > 100).

Connection pool: HikariCP with max 20 connections per replica, for a total of 100 database connections at base load.
