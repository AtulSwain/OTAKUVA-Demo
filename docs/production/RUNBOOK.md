# OTAKUVA — Production Operations Runbook

## 1. Quick Reference & System Health

| Check | Endpoint / Command | Expected Output |
| :--- | :--- | :--- |
| **Liveness** | `GET /api/health` | `{"status": "UP", ...}` (HTTP 200) |
| **Readiness** | `GET /api/health/ready` | `{"status": "HEALTHY", ...}` (HTTP 200) |
| **Launch Status** | `GET /api/production/status` | `{"decision": "GO", ...}` (HTTP 200) |
| **Alerts** | `GET /api/production/alerts?unresolved=true` | `{"success": true, "alerts": [...]}` |
| **Metrics** | `GET /api/admin/performance/metrics` | `{"performance": { "p95Ms": ... }}` |

---

## 2. Standard Operating Procedures (SOP)

### SOP-01: Deploying a New Release
1. Ensure all CI tests pass: `npm run typecheck && npx tsx src/lib/test_phase12_production_readiness_master.ts`.
2. Generate pre-deployment backup: `POST /api/production/backup`.
3. Register new release: `RollbackManager.registerDeployment(version, commitHash)`.
4. Deploy container / application.
5. Verify `/api/health/ready` returns `HEALTHY`.
6. Run smoke tests across homepage, anime detail, search, and user auth.

### SOP-02: Executing an Emergency Rollback
1. Trigger instant rollback:
   ```ts
   await RollbackManager.executeRollback("Critical regression reason", "OnCall_Engineer");
   ```
2. Rollback manager will:
   - Restore previous active release version
   - Flush in-memory cache
   - Reset circuit breakers
   - Record security audit log event
3. Verify `/api/health/ready` and monitor error rates.

### SOP-03: Secret Rotation
1. Generate new 256-bit cryptographically secure secret:
   ```ts
   const newSecret = EnvValidator.generateSecureSecret();
   ```
2. Update secret in production environment / secret manager (`AUTH_SECRET`).
3. Trigger rolling restart of application instances.

### SOP-04: Responding to High Error Rate Alerts
1. Inspect active alerts: `GET /api/production/alerts`.
2. Check database query health in `/api/health/ready`.
3. Check latency and 5xx logs in `/api/admin/performance/metrics`.
4. If an external service is causing cascading failures, verify circuit breaker is in `OPEN` state.
5. If regression originated from new release, execute **SOP-02: Emergency Rollback**.
