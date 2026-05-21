# NovaMart Database Guide

## Overview

NovaMart uses a polyglot persistence strategy — different services use different databases based on their access patterns and requirements.

## Database Inventory

| Service | Database | Version | Host | Why This DB? |
|---------|----------|---------|------|-------------|
| Order Service | PostgreSQL | 15 | order-db.novamart.internal:5432 | Transactional consistency for orders |
| Payment Service | PostgreSQL | 15 | payment-db.novamart.internal:5432 | ACID compliance for financial data |
| User Service | PostgreSQL | 15 | user-db.novamart.internal:5432 | Relational user data with complex queries |
| Inventory Service | Cassandra | 4.1 | cassandra.novamart.internal:9042 | High write throughput, multi-DC replication |
| Catalog Service | MongoDB | 7.0 | catalog-mongo.novamart.internal:27017 | Flexible product schemas, nested documents |
| Search Service | Elasticsearch | 8.11 | search-es.novamart.internal:9200 | Full-text search, faceted filtering |
| Notification Service | Redis + PostgreSQL | 7.2 / 15 | redis.novamart.internal:6379 | Redis for dedup/rate-limit, PG for templates |
| Shipping Service | PostgreSQL | 15 | shipping-db.novamart.internal:5432 | Transactional consistency for shipments |
| Analytics | BigQuery | - | GCP project: novamart-analytics | Large-scale analytical queries |

## Access Management

### Getting Database Access

1. Submit a request in the #db-access Slack channel with:
   - Your name and team
   - Which database you need access to
   - Read-only or read-write
   - Business justification
2. DBA team reviews and provisions access within 1 business day
3. Credentials are stored in AWS Secrets Manager
4. Each service has its own IAM role for database access — never share credentials between services

### Connection Strings

Connection strings are injected via Kubernetes secrets. Never hardcode them. Access them in your service via environment variables:

```
DATABASE_URL=postgresql://user:pass@order-db.novamart.internal:5432/orders
CASSANDRA_CONTACT_POINTS=cassandra.novamart.internal
MONGO_URI=mongodb://user:pass@catalog-mongo.novamart.internal:27017/catalog
```

## Backup Policy

| Database | Backup Frequency | Retention | RTO | RPO |
|----------|-----------------|-----------|-----|-----|
| PostgreSQL (all) | Continuous WAL + daily snapshot | 30 days | 1 hour | 5 minutes |
| Cassandra | Daily snapshot per node | 14 days | 2 hours | 1 hour |
| MongoDB | Continuous oplog + daily snapshot | 30 days | 1 hour | 10 minutes |
| Elasticsearch | Daily snapshot to S3 | 7 days | 4 hours | 24 hours |
| Redis | AOF persistence + hourly RDB | 7 days | 30 minutes | 1 minute |

RTO = Recovery Time Objective (how long to restore)
RPO = Recovery Point Objective (how much data loss is acceptable)

## BigQuery (Analytics)

All services publish events to Kafka. The analytics pipeline (managed by Data Engineering team) consumes these events and loads them into BigQuery for analysis.

### Key Datasets
- `novamart_analytics.orders` — All order events, partitioned by date
- `novamart_analytics.payments` — All payment events
- `novamart_analytics.user_activity` — User behavior events (page views, clicks)
- `novamart_analytics.inventory_snapshots` — Daily inventory snapshots

### Running Queries
1. Access BigQuery via GCP Console: console.cloud.google.com → project novamart-analytics
2. Or use the Metabase dashboard: metabase.novamart.internal
3. All analysts and engineers have read access by default
4. Be mindful of query costs — always use date partition filters

### Common Queries

```sql
-- Daily order volume for the last 30 days
SELECT DATE(created_at) as order_date, COUNT(*) as order_count
FROM novamart_analytics.orders
WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY order_date
ORDER BY order_date DESC;

-- Payment failure rate by error code
SELECT error_code, COUNT(*) as failures,
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as pct
FROM novamart_analytics.payments
WHERE status = 'FAILED' AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY error_code
ORDER BY failures DESC;
```

## Schema Changes

All database schema changes must follow this process:

1. Write a migration script (Flyway for PostgreSQL, CQL script for Cassandra)
2. Test the migration on staging environment
3. Get DBA review for any migration that: alters indexes, changes column types, or affects tables with > 1M rows
4. Schedule production migration during low-traffic window (2-4 AM ET)
5. Always write a rollback script alongside the migration
6. Never drop columns — mark them as deprecated and remove after 30 days with no reads
