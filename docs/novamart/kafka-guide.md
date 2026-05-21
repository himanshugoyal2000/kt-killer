# Kafka Event Bus Guide

## Overview

NovaMart uses Apache Kafka (managed via Confluent Cloud) as the central event bus for inter-service communication. All asynchronous communication between microservices happens through Kafka.

- **Cluster:** Confluent Cloud, us-east-1
- **Version:** Kafka 3.6 (Confluent Platform 7.5)
- **Confluent Console:** confluent.novamart.internal
- **Owner:** Platform Engineering (Slack: #team-platform)

## Topic Naming Convention

All topics follow the pattern: `{domain}.{entity}.{event}`

Examples:
- `orders.order.created`
- `payments.payment.completed`
- `inventory.stock.updated`

Legacy topics (pre-convention) use flat names like `order-created`. These are being migrated — do not create new topics with the old naming.

## Topic Registry

| Topic | Producer | Consumers | Partitions | Retention |
|-------|----------|-----------|------------|-----------|
| `order-created` | Order Service | Payment, Inventory, Notification | 12 | 7 days |
| `order-updated` | Order Service | Notification, Analytics | 12 | 7 days |
| `order-cancelled` | Order Service | Inventory, Payment, Notification | 6 | 7 days |
| `payment-completed` | Payment Service | Order, Notification | 12 | 7 days |
| `payment-failed` | Payment Service | Order, Notification | 6 | 7 days |
| `payments-dlq` | Payment Service | Payment DLQ Processor | 3 | 30 days |
| `inventory-reserved` | Inventory Service | Order | 12 | 7 days |
| `inventory-released` | Inventory Service | Analytics | 6 | 7 days |
| `stock-updated` | Inventory Service | Catalog, Search | 12 | 3 days |
| `product-updated` | Catalog Service | Search, Analytics | 6 | 7 days |
| `shipment-created` | Shipping Service | Order, Notification | 6 | 7 days |
| `shipment-delivered` | Shipping Service | Order, Notification | 6 | 7 days |

## Consumer Group Conventions

Consumer groups are named: `{consuming-service}-{topic-name}`

Example: `order-service-payment-completed`

This makes it easy to identify which service owns which consumer group when debugging lag issues.

## Message Schema

All messages use Avro schemas registered in the Confluent Schema Registry. Key rules:

1. All messages must include: `event_id` (UUID), `timestamp` (ISO-8601), `version` (schema version)
2. Schema evolution must be backward-compatible (add optional fields only)
3. Breaking changes require creating a new topic version (e.g., `orders.order.created.v2`)
4. All messages are keyed by entity ID (e.g., order messages keyed by `order_id`) to ensure ordering within an entity

## Common Operations

### Checking Consumer Lag
```bash
# Using Confluent CLI
confluent kafka consumer-group describe order-service-payment-completed

# Via Grafana dashboard
grafana.novamart.internal/d/kafka-consumer-lag
```

Consumer lag > 1000 messages for more than 5 minutes triggers a P3 alert.

### Resetting a Consumer Group
If a consumer group needs to be reset (e.g., after a bug fix that requires reprocessing):

```bash
# Reset to latest (skip all unprocessed messages)
confluent kafka consumer-group reset order-service-payment-completed --to-latest

# Reset to a specific timestamp (reprocess from that point)
confluent kafka consumer-group reset order-service-payment-completed --to-datetime 2024-01-15T10:00:00Z

# Reset to earliest (reprocess everything within retention)
confluent kafka consumer-group reset order-service-payment-completed --to-earliest
```

**Warning:** Resetting to earliest on a high-throughput topic can cause a message storm. Always coordinate with the consuming service team first.

### Creating a New Topic
1. Define the topic in the topic registry (Confluence page: "Kafka Topic Registry")
2. Create the Avro schema and register it in Schema Registry
3. Create the topic via Terraform in the `infra-kafka` repository
4. PR requires approval from Platform Engineering team

### Dead Letter Queues
Every consumer should have a DLQ for messages that fail processing after max retries. DLQ topics follow the naming: `{original-topic}-dlq`

DLQ messages include the original message plus error metadata:
```json
{
  "original_message": { ... },
  "error": "NullPointerException at PaymentProcessor.java:142",
  "retry_count": 3,
  "first_failure_at": "2024-01-15T10:30:00Z",
  "last_failure_at": "2024-01-15T10:32:00Z"
}
```

## Troubleshooting

### Messages Not Being Consumed
1. Check if the consumer group is active: `confluent kafka consumer-group describe {group}`
2. Check if the consuming service is running: `kubectl get pods -l app={service}`
3. Check service logs for deserialization errors (common after schema changes)
4. Check if the consumer group was accidentally deleted (rare, but happens)

### High Consumer Lag
1. Check consuming service CPU/memory — may need to scale up
2. Check if processing time per message has increased (slow downstream dependency?)
3. Consider increasing partitions if the consumer group has fewer members than partitions
4. Temporary fix: Scale up consumer replicas to match partition count
