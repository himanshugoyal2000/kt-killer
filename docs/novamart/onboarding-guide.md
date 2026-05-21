# New Engineer Onboarding Guide

## Welcome to NovaMart!

This guide will help you get set up and productive in your first two weeks. If you get stuck on anything, reach out to your onboarding buddy or ask in #new-engineers on Slack.

## Day 1: Accounts & Access

### Required Accounts
Set up the following accounts on your first day. Your manager should have pre-approved access for all of these.

1. **GitHub:** Accept the invitation to the NovaMart GitHub organization
2. **Slack:** Join novamart.slack.com — your manager will add you to your team channels
3. **Google Workspace:** Your @novamart.com email is already provisioned
4. **AWS Console:** Request access via #infra-access Slack channel
5. **Confluent Cloud:** Request access via #team-platform for Kafka dashboard
6. **PagerDuty:** Your manager will add you to the team's on-call rotation (not in week 1)
7. **Jira:** Access is automatic with your Google Workspace account
8. **1Password:** Engineering team vault access — request from your manager

### Laptop Setup

```bash
# 1. Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Install core tools
brew install git java docker kubectl helm node go python3

# 3. Clone the service you'll be working on
git clone git@github.com:novamart/{your-service}.git

# 4. Install the internal CLI tool
brew tap novamart/tools
brew install novamart-cli

# 5. Configure kubectl for our clusters
novamart-cli configure-k8s

# 6. Verify setup
novamart-cli doctor  # This checks all required tools and access
```

## Day 2-3: Understand the Architecture

### Required Reading
1. Architecture Overview (this wiki — start here)
2. Your team's service runbook
3. Kafka Event Bus Guide (if your service uses Kafka)
4. Database Guide (for your service's database)
5. CI/CD Pipeline Guide

### Recommended Sessions
Your onboarding buddy should schedule these walkthroughs:
- **System architecture overview** (1 hour) — How services fit together
- **Your service deep dive** (2 hours) — Codebase walkthrough
- **Local development setup** (1 hour) — Running the service on your laptop
- **Deployment walkthrough** (30 min) — How code gets to production

## Day 4-5: First Contribution

### Starter Tasks
Your manager should assign you a starter task labeled `good-first-issue` in Jira. These are intentionally small and well-defined. Typical starter tasks:
- Add a new field to an API response
- Write a unit test for an existing function
- Fix a low-priority bug
- Update documentation

### Development Workflow
1. Create a branch: `git checkout -b {your-name}/{jira-ticket}`
2. Make changes and write tests
3. Push and create a PR: `gh pr create`
4. Get at least 1 approval from a team member
5. Merge via GitHub — CI/CD handles deployment to staging
6. Verify on staging, then merge to main for production deployment

## Week 2: Go Deeper

### Monitoring & On-Call
- Get familiar with Grafana dashboards for your service
- Shadow an on-call engineer for one day
- Read the Incident Response Playbook
- You won't be added to the on-call rotation until week 4 (and never alone — always paired with a senior engineer for the first month)

### Key Contacts

| Role | Person | Slack |
|------|--------|-------|
| VP Engineering | James Wilson | @james-wilson |
| Platform Engineering Lead | David Kim | @david-kim |
| DBA Lead | Lisa Wang | @lisa-wang |
| Security Lead | Rachel Green | @rachel-green |
| Your onboarding buddy | Assigned on Day 1 | Check with your manager |

## Frequently Asked Questions

**Q: How do I get VPN access?**
A: Submit a request via the IT Help Desk portal (helpdesk.novamart.internal). Approval takes 1 business day.

**Q: How do I access production databases?**
A: You don't — not directly. All production data access goes through read-only replicas or the internal API. For debugging, use Kibana logs or Grafana metrics. If you absolutely need prod DB access, request it via #db-access with your manager's approval.

**Q: How do I deploy to production?**
A: Merge your PR to the `main` branch. CI/CD handles the rest. See the CI/CD Pipeline Guide for details.

**Q: What if I break something in staging?**
A: That's what staging is for! Notify your team on Slack, and either fix it or rollback. Nobody gets in trouble for breaking staging.

**Q: How do I request a new tool or library?**
A: Open a PR adding it to the project's dependency file. The PR description should explain why it's needed and any security/license implications. The team lead approves.
