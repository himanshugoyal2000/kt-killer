# Search Service Runbook

## Service Overview

The Search Service powers all product search functionality on NovaMart — search bar, autocomplete, category browsing, and faceted filtering. It uses Elasticsearch as the search engine.

- **Repository:** github.com/novamart/search-service
- **Language:** Java 17, Spring Boot 3.2
- **Database:** Elasticsearch 8.11 (search-es.novamart.internal:9200)
- **Owner:** Search & Discovery team (Slack: #team-search)
- **On-call rotation:** PagerDuty schedule "search-oncall"

## Elasticsearch Cluster

- **Nodes:** 6 (3 master-eligible, 3 data)
- **Shards per index:** 6 primary + 1 replica = 12 total
- **Index size:** ~2.5 million products, ~4GB per shard
- **Refresh interval:** 1 second (near real-time search)

## Indexing Pipeline

Products are indexed in Elasticsearch via the following pipeline:

1. Catalog Service publishes `product-updated` event to Kafka
2. Search Service consumes the event
3. Transforms the product data into a search-optimized document
4. Upserts the document in the `products` Elasticsearch index

The search document includes:
```json
{
  "product_id": "uuid",
  "title": "Wireless Bluetooth Headphones",
  "description": "High-quality noise-cancelling...",
  "category": ["Electronics", "Audio", "Headphones"],
  "brand": "SoundMax",
  "price": 79.99,
  "sale_price": 59.99,
  "in_stock": true,
  "rating": 4.5,
  "review_count": 1247,
  "tags": ["wireless", "bluetooth", "noise-cancelling"],
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-20T14:30:00Z"
}
```

## Search Features

### Full-Text Search
Supports multi-field search across title, description, category, brand, and tags. Uses Elasticsearch's `multi_match` query with `best_fields` type.

### Autocomplete
Uses an `edge_ngram` analyzer on the title field. Returns suggestions after 2+ characters typed. Response time target: < 50ms.

### Faceted Filtering
Available facets:
- Category (hierarchical)
- Brand
- Price range
- Rating (minimum)
- In-stock only
- On sale

### Sorting Options
- Relevance (default — Elasticsearch `_score`)
- Price: low to high
- Price: high to low
- Newest first
- Rating: highest first
- Most reviewed

## Reindexing

Occasionally, the entire product catalog needs to be reindexed (e.g., after a mapping change or data migration).

### Full Reindex Procedure
1. Create a new index with updated mappings: `products_v{N+1}`
2. Run the reindex job: `kubectl exec search-service-0 -- /app/reindex --source=catalog-api --target=products_v{N+1}`
3. Verify document count matches the catalog: `GET /products_v{N+1}/_count`
4. Switch the alias: `POST /_aliases` — point `products` alias to `products_v{N+1}`
5. Delete the old index after confirming search works correctly

**Important:** Always use the index alias (`products`) in queries, never the versioned index name. This allows zero-downtime reindexing.

Reindex time for full catalog (~2.5M products): approximately 45 minutes.

## Common Issues & Troubleshooting

### Search Returning No Results
1. Check if Elasticsearch cluster is healthy: `GET /_cluster/health`
2. Check if the product exists in the index: `GET /products/_doc/{product_id}`
3. If the product is missing: Check the Kafka consumer lag for the search service
4. If the product is present but not matching: Debug the query using `GET /products/_explain`

### Slow Search Queries
1. Check Elasticsearch slow log: `GET /_cat/thread_pool/search`
2. Common cause: Missing or inefficient query (e.g., leading wildcard `*phone*`)
3. Check if cluster is under memory pressure: `GET /_cat/nodes?v&h=name,heap.percent`
4. If heap > 85%: May need to scale the cluster or optimize queries

### Elasticsearch Cluster Yellow
Yellow means some replica shards are unassigned:
1. Check which shards are unassigned: `GET /_cat/shards?v&h=index,shard,prirep,state,unassigned.reason`
2. Common cause: A data node restarted and replicas haven't finished recovering
3. Wait 10-15 minutes — replicas usually recover automatically
4. If still yellow after 30 minutes: Check disk space on data nodes (`GET /_cat/allocation?v`)

## Monitoring

### Key Metrics
- **Search latency (p99):** Target < 200ms. Alert if > 500ms for 5 minutes.
- **Indexing lag:** Time between Kafka event and document being searchable. Target < 5 seconds.
- **Zero-result rate:** Percentage of searches returning no results. Target < 10%.
- **Cluster health:** Must be GREEN. YELLOW requires investigation within 1 hour.

### Dashboards
- Search Performance: grafana.novamart.internal/d/search-performance
- Elasticsearch Cluster: grafana.novamart.internal/d/es-cluster
- Popular Searches: metabase.novamart.internal/dashboard/search-trends
