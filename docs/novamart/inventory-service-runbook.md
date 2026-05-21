# Inventory Service Runbook

## Service Overview

The Inventory Service manages real-time stock levels across NovaMart's 3 fulfillment warehouses. It handles stock reservations during checkout and releases them on cancellation.

- **Repository:** github.com/novamart/inventory-service
- **Language:** Go 1.21
- **Database:** Apache Cassandra 4.1 (cassandra.novamart.internal:9042)
- **Owner:** Supply Chain Engineering (Slack: #team-supply-chain)
- **On-call rotation:** PagerDuty schedule "supply-chain-oncall"

## Why Cassandra?

The Inventory Service uses Cassandra instead of PostgreSQL because:
1. **Write-heavy workload:** Stock updates happen on every order, return, and warehouse receipt (~200K writes/day)
2. **High availability requirement:** Stock checks during checkout cannot fail, even during partial outages
3. **Multi-datacenter replication:** Stock data is replicated across all 3 warehouses for local reads
4. **No complex queries needed:** All access patterns are by product_id or warehouse_id

## Data Model

```cql
-- Stock levels per product per warehouse
CREATE TABLE stock_levels (
  product_id UUID,
  warehouse_id UUID,
  available_quantity INT,
  reserved_quantity INT,
  updated_at TIMESTAMP,
  PRIMARY KEY (product_id, warehouse_id)
);

-- Reservations (TTL of 30 minutes — auto-expire if not confirmed)
CREATE TABLE reservations (
  reservation_id UUID,
  order_id UUID,
  product_id UUID,
  warehouse_id UUID,
  quantity INT,
  status TEXT,  -- RESERVED, CONFIRMED, RELEASED
  created_at TIMESTAMP,
  PRIMARY KEY (reservation_id)
) WITH default_time_to_live = 1800;
```

## Reservation Flow

1. Order Service publishes `order-created` event
2. Inventory Service receives event, checks stock availability
3. If stock available: Creates reservation with TTL of 30 minutes, publishes `inventory-reserved`
4. If stock unavailable: Publishes `inventory-unavailable` with alternative warehouse suggestions
5. On payment completion: Reservation status set to CONFIRMED, TTL removed
6. On order cancellation: Reservation status set to RELEASED, stock returned to available pool

The 30-minute TTL is critical — if payment takes too long or the order is abandoned, the reserved stock automatically becomes available again. This prevents "ghost reservations" from locking up inventory.

## Warehouses

| Warehouse ID | Location | Coverage |
|-------------|----------|----------|
| WH-EAST | New Jersey | East Coast orders |
| WH-CENTRAL | Texas | Central US orders |
| WH-WEST | California | West Coast orders |

Warehouse selection is based on shipping address proximity. If the nearest warehouse is out of stock, the system checks other warehouses in order of distance.

## Common Issues & Troubleshooting

### Stock Count Mismatch
If the stock count in the system doesn't match the physical warehouse count:
1. Run the reconciliation job: `kubectl exec -it inventory-service-0 -- /app/reconcile --warehouse={WH_ID}`
2. The job compares Cassandra stock levels with the warehouse management system (WMS)
3. Discrepancies are logged to the `stock-reconciliation` Kafka topic
4. Review discrepancies in the Stock Reconciliation dashboard (grafana.novamart.internal/d/stock-recon)

### Reservation Timeout Issues
If reservations are expiring before payment completes:
1. Check average payment processing time — if > 25 minutes, increase TTL
2. Check for payment service latency issues (see Payment Service Runbook)
3. Current TTL can be adjusted via config: `RESERVATION_TTL_SECONDS` (default: 1800)
4. Never set TTL below 600 seconds (10 minutes) — Stripe can take up to 8 minutes for some payments

### Cassandra Node Down
1. Check Cassandra node status: `nodetool status` on any node
2. With replication factor 3, one node down is tolerable — reads and writes continue
3. If 2+ nodes are down in the same datacenter: Escalate to Platform Engineering immediately
4. Do NOT run `nodetool repair` during peak hours — it causes significant I/O load

## Monitoring

### Key Metrics
- **Reservation success rate:** Should be > 98%. Below this indicates widespread stock issues.
- **Reservation timeout rate:** Should be < 1%. High rates indicate payment processing delays.
- **Cassandra read latency (p99):** Should be < 10ms. Above this indicates cluster issues.
- **Stock reconciliation drift:** Should be < 0.1%. Above this indicates WMS sync issues.

### Dashboards
- Stock Levels: grafana.novamart.internal/d/inventory-stock
- Reservations: grafana.novamart.internal/d/inventory-reservations
- Cassandra Cluster: grafana.novamart.internal/d/cassandra-cluster
