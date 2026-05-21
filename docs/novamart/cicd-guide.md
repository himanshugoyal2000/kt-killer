# CI/CD Pipeline Guide

## Overview

NovaMart uses GitHub Actions for CI/CD with trunk-based development. The philosophy is: small, frequent merges to `main` with feature flags for controlling rollout.

## Branching Strategy

We follow **trunk-based development:**
- `main` is the only long-lived branch
- Feature branches are short-lived (ideally < 2 days)
- Branch naming: `{author}/{jira-ticket}-{short-description}` (e.g., `himanshu/PAY-123-retry-config`)
- All PRs target `main`
- No release branches — `main` is always deployable

## Pipeline Stages

Every push to a PR or merge to `main` triggers the following pipeline:

### 1. Build & Test (2-4 minutes)
- Compile the service
- Run unit tests
- Run integration tests (using Testcontainers for databases, embedded Kafka)
- Fail fast: if any test fails, the pipeline stops here

### 2. Static Analysis (1-2 minutes)
- SonarQube code quality scan
- Dependency vulnerability scan (Snyk)
- Docker image vulnerability scan (Trivy)
- Code coverage must be ≥ 80% for new code

### 3. Build Docker Image (1-2 minutes)
- Multi-stage Docker build
- Image tagged with: `{service}:{git-sha}` and `{service}:latest`
- Pushed to Amazon ECR (our container registry)

### 4. Deploy to Staging (2-3 minutes)
- Automatic on every push to `main`
- Kubernetes rolling update — zero downtime
- Runs smoke tests against staging environment
- Staging URL: `{service}-staging.novamart.internal`

### 5. Deploy to Production (2-3 minutes)
- Triggered automatically after staging smoke tests pass
- Canary deployment: 10% traffic for 5 minutes, then full rollout
- If error rate spikes during canary, automatic rollback
- Production URL: `{service}.novamart.internal`

Total pipeline time: **8-14 minutes** from merge to production.

## Feature Flags

We use LaunchDarkly for feature flags. This lets us:
- Deploy code to production without enabling the feature
- Gradually roll out to a percentage of users
- Instantly disable a feature without redeploying

### Creating a Feature Flag
1. Create the flag in LaunchDarkly dashboard
2. Flag naming: `{service}.{feature-name}` (e.g., `payments.paypal-fallback`)
3. Default to `false` in production
4. Use the LaunchDarkly SDK in your service to check the flag:

```java
boolean enabled = ldClient.boolVariation("payments.paypal-fallback", user, false);
if (enabled) {
  // new feature code
} else {
  // existing behavior
}
```

## Rollback

### Automatic Rollback
The canary deployment automatically rolls back if:
- Error rate increases by > 2% compared to pre-deployment baseline
- p99 latency increases by > 50% compared to pre-deployment baseline
- Any health check fails for 3 consecutive checks

### Manual Rollback
```bash
# Option 1: Re-deploy the previous version via GitHub Actions
gh run rerun {previous-successful-run-id}

# Option 2: Rollback via ArgoCD
# Go to argocd.novamart.internal → select service → History → Rollback

# Option 3: kubectl (emergency only)
kubectl rollout undo deployment/{service-name} -n {namespace}
```

## Environment Configuration

| Environment | Purpose | Auto-deploy | URL Pattern |
|-------------|---------|-------------|-------------|
| Development | Local development | No | localhost:8080 |
| Staging | Pre-production testing | On merge to main | {service}-staging.novamart.internal |
| Production | Live traffic | After staging smoke tests | {service}.novamart.internal |

## Secrets Management

- All secrets stored in AWS Secrets Manager
- Kubernetes ExternalSecrets operator syncs secrets to K8s
- Never commit secrets to git — use environment variables
- Rotate secrets quarterly (automated reminder via Jira)

## Common Issues

### Pipeline Failing on Tests
1. Check if it's a flaky test: Re-run the pipeline once
2. If it fails consistently: Check your test logs in the GitHub Actions output
3. Integration tests failing: Ensure Testcontainers has enough Docker resources
4. Coverage below 80%: Add tests for new code paths

### Deploy Stuck in Progress
1. Check ArgoCD: argocd.novamart.internal for sync status
2. Check if pods are crashing: `kubectl get pods -l app={service}` — look for CrashLoopBackOff
3. Check pod logs: `kubectl logs -l app={service} --tail=100`
4. Common cause: Missing environment variable or secret
