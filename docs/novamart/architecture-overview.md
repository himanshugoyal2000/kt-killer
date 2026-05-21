# NovaMart Architecture Overview

## System Overview

NovaMart is a mid-size e-commerce platform serving 2 million monthly active users across web and mobile. The platform processes an average of 85,000 orders per day with peak loads during flash sales reaching 300,000 orders per day.

The system follows a microservices architecture with 14 core services communicating primarily through Apache Kafka for asynchronous events and gRPC for synchronous calls.

## Core Services

### Order Service
- **Language:** Java 17, Spring Boot 3.2
- **Database:** PostgreSQL 15
- **Responsibilities:** Order creation, order lifecycle management, order status tracking
- **Kafka Topics:** `order-created`, `order-updated`, `order-cancelled`
- **Team:** Order Platform (Slack: #team-order-platform)

### Payment Service
- **Language:** Java 17, Spring Boot 3.2
- **Database:** PostgreSQL 15
- **Responsibilities:** Payment processing, refund handling, payment method management
- **External Integrations:** Stripe (primary), PayPal (secondary)
- **Kafka Topics:** `payment-initiated`, `payment-completed`, `payment-failed`, `refund-processed`
- **Team:** Payments (Slack: #team-payments)

### Inventory Service
- **Language:** Go 1.21
- **Database:** Apache Cassandra 4.1
- **Responsibilities:** Stock tracking, reservation management, warehouse allocation
- **Kafka Topics:** `inventory-reserved`, `inventory-released`, `stock-updated`
- **Team:** Supply Chain Engineering (Slack: #team-supply-chain)

### Catalog Service
- **Language:** Node.js 20, NestJS
- **Database:** MongoDB 7.0
- **Responsibilities:** Product listings, categories, search indexing, pricing
- **Kafka Topics:** `product-updated`, `price-changed`
- **Team:** Catalog (Slack: #team-catalog)

### User Service
- **Language:** Java 17, Spring Boot 3.2
- **Database:** PostgreSQL 15
- **Responsibilities:** User accounts, authentication, profiles, preferences
- **Team:** Identity (Slack: #team-identity)

### Notification Service
- **Language:** Python 3.11, FastAPI
- **Database:** Redis (for deduplication), PostgreSQL (for templates)
- **Responsibilities:** Email, SMS, push notifications, in-app notifications
- **Kafka Topics:** Consumes from all `*-completed`, `*-failed` topics
- **Team:** Communications (Slack: #team-comms)

### Search Service
- **Language:** Java 17, Spring Boot 3.2
- **Database:** Elasticsearch 8.11
- **Responsibilities:** Product search, autocomplete, faceted filtering
- **Team:** Search & Discovery (Slack: #team-search)

### Shipping Service
- **Language:** Go 1.21
- **Database:** PostgreSQL 15
- **Responsibilities:** Carrier integration, tracking, delivery estimation
- **External Integrations:** FedEx, UPS, USPS APIs
- **Kafka Topics:** `shipment-created`, `shipment-delivered`
- **Team:** Logistics (Slack: #team-logistics)

## Infrastructure

### Kubernetes
All services run on Amazon EKS (Kubernetes 1.28) across 3 availability zones in us-east-1. Each service has a minimum of 3 replicas for high availability.

### Message Bus
Apache Kafka 3.6 managed via Confluent Cloud. 47 topics, average throughput of 15,000 messages/second across all topics.

### API Gateway
Kong API Gateway handles all external traffic. Rate limiting is set at 1,000 requests/minute per user. Authentication uses JWT tokens issued by the User Service.

### Monitoring Stack
- **Metrics:** Prometheus + Grafana (grafana.novamart.internal)
- **Logs:** ELK Stack (kibana.novamart.internal)
- **Traces:** Jaeger (jaeger.novamart.internal)
- **Alerting:** PagerDuty integrated with Grafana alerts

### CI/CD
GitHub Actions for all services. Trunk-based development with feature flags via LaunchDarkly. Deployments happen automatically on merge to main after tests pass.

## Data Flow: Order Lifecycle

1. User places order → **Order Service** creates order (status: `PENDING`)
2. Order Service publishes `order-created` event to Kafka
3. **Inventory Service** consumes event → reserves stock → publishes `inventory-reserved`
4. **Payment Service** consumes event → charges payment → publishes `payment-completed` or `payment-failed`
5. If payment succeeds: Order status updated to `CONFIRMED`, **Shipping Service** creates shipment
6. If payment fails: **Inventory Service** releases reserved stock, order marked `CANCELLED`
7. **Notification Service** sends confirmation email/push at each status change
