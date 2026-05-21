# Incident Response Playbook

## Severity Levels

| Severity | Definition | Response Time | Examples |
|----------|-----------|---------------|----------|
| P1 (Critical) | Revenue-impacting, complete feature outage | 15 minutes | Checkout down, payments failing for all users |
| P2 (High) | Degraded experience, partial outage | 30 minutes | High latency, one payment provider down |
| P3 (Medium) | Non-critical issue, workaround exists | 2 hours | Dashboard errors, delayed notifications |
| P4 (Low) | Cosmetic, informational | Next business day | UI bugs, non-urgent log errors |

## Incident Response Steps

### 1. Detection
Incidents are detected via:
- PagerDuty alerts (automated)
- User reports via support team (Slack: #customer-support)
- Internal reports via Slack: #incidents

### 2. Acknowledgment
- The on-call engineer acknowledges the PagerDuty alert within the response time
- Create an incident channel: #inc-{YYYY-MM-DD}-{short-description}
- Post initial assessment in the channel

### 3. Triage
Determine:
- **Impact:** How many users are affected?
- **Scope:** Which services are involved?
- **Severity:** Assign P1-P4 based on the table above
- **Cause hypothesis:** What might have caused this?

### 4. Communication
- P1/P2: Post status update every 15 minutes in the incident channel
- Notify stakeholders: Engineering lead, product manager, customer support
- For P1: Notify VP of Engineering within 30 minutes
- Update the status page (status.novamart.com) for user-facing incidents

### 5. Mitigation
Priority is to restore service, not find root cause. Common mitigation strategies:
- **Rollback:** If incident started after a deployment, roll back immediately
- **Feature flag:** Disable the problematic feature via LaunchDarkly
- **Scale up:** If it's a capacity issue, increase replicas
- **Failover:** Switch to backup system (e.g., PayPal if Stripe is down)
- **Circuit breaker:** Enable circuit breaker to prevent cascade failures

### 6. Resolution
- Confirm the issue is fully resolved
- Monitor for 30 minutes to ensure stability
- Close the PagerDuty incident
- Post final update in the incident channel

### 7. Post-Mortem
Required for all P1 and P2 incidents. Must be completed within 3 business days.

Post-mortem template: confluence.novamart.internal/templates/post-mortem

Sections:
1. **Summary:** What happened, when, and how long
2. **Impact:** Users affected, revenue impact, SLA impact
3. **Timeline:** Minute-by-minute timeline of events
4. **Root Cause:** The actual underlying cause
5. **Contributing Factors:** What made the incident worse
6. **Action Items:** Concrete steps to prevent recurrence, with owners and due dates

## Rollback Procedures

### Application Rollback
All services use GitHub Actions with automated deployments. To rollback:

```bash
# Find the last good deployment
gh run list --workflow=deploy.yml --limit=10

# Re-run the last good deployment
gh run rerun {run-id}
```

Or via ArgoCD dashboard: argocd.novamart.internal → select service → click "Rollback"

### Database Rollback
1. PostgreSQL: Each Flyway migration has a corresponding rollback script in the `rollback/` directory
2. Run the rollback script on staging first
3. Get DBA approval for production rollback
4. Execute during low-traffic window if possible

### Feature Flag Rollback
The fastest rollback option — no deployment needed:
1. Go to LaunchDarkly dashboard: launchdarkly.com/novamart
2. Find the feature flag for the problematic feature
3. Toggle it off
4. Changes take effect within 30 seconds

## Escalation Paths

| Service | Primary | Secondary | Escalation |
|---------|---------|-----------|------------|
| Order Service | order-platform-oncall | @alex-chen | VP Engineering |
| Payment Service | payments-oncall | @sarah-jones | VP Engineering |
| Inventory Service | supply-chain-oncall | @mike-patel | VP Engineering |
| Kafka/Infrastructure | platform-oncall | @david-kim | CTO |
| Database | dba-oncall | @lisa-wang | VP Engineering |
