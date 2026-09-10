# OTAKUVA — Deployment & Rollback Guide

## 1. Deployment Strategies
OTAKUVA supports zero-downtime rolling deployments and instant canary rollbacks:

### Rolling Deployment
1. Build application artifacts with Next.js (`npm run build`).
2. Run database migrations using backward-compatible column expansions.
3. Deploy new instances behind CDN/Load Balancer.
4. Verify `/api/health/ready` probe on new instances.
5. Shift 100% traffic to new instances.

---

## 2. Instant Rollback Mechanism
- Handled programmatically by [`RollbackManager`](file:///c:/Users/Atul%20Swain/Documents/WebSite/TWO/src/lib/production/rollbackManager.ts).
- Restores previous stable release in $< 15$ seconds.
- Automatically clears stale in-memory cache keys.
- Resets circuit breaker state to avoid cascading lockouts.
- Records security audit log of the rollback event with reason and actor.
