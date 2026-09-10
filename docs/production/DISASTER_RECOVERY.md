# OTAKUVA — Disaster Recovery & Backup Guide

## 1. Objectives & Metrics
- **Recovery Point Objective (RPO)**: **1 Hour** (Maximum acceptable data loss window).
- **Recovery Time Objective (RTO)**: **15 Minutes** (Maximum allowable time to restore full service).

---

## 2. Backup Architecture
- **Snapshot Generator (`src/lib/production/backupManager.ts`)**:
  - Captures core entities: Users, Studios, Anime, Ratings, Reviews, Communities, News Articles, and Audit Logs.
  - Generates a cryptographically strong SHA-256 integrity checksum over the payload.
- **Storage**: Backups are persisted to encrypted object storage with multi-region redundancy.
- **Retention Schedule**:
  - Hourly snapshots: Retained for 48 hours
  - Daily snapshots: Retained for 30 days
  - Monthly archives: Retained for 1 year

---

## 3. Restoration Procedure

### Step 1: Checksum Verification
Validate that the snapshot has not suffered bit rot or tampering:
```ts
const integrity = BackupManager.verifyBackupIntegrity(backupPayload);
if (!integrity.isValid) {
  throw new Error(`Checksum mismatch! Expected ${integrity.expectedChecksum}`);
}
```

### Step 2: Non-Destructive Restore Simulation
Execute simulation to verify entity counts and relational graph sanity before database overwrite:
```ts
const simulation = BackupManager.simulateRestore(backupPayload);
console.log(`Verified ${simulation.totalEntitiesVerified} entities.`);
```

### Step 3: Database Restore
1. Put application into maintenance mode if necessary.
2. Load verified snapshot into database.
3. Verify relational consistency (Anime $\leftrightarrow$ Studios, Ratings $\leftrightarrow$ Users).
4. Run `/api/health/ready` to verify query readiness.
5. Exit maintenance mode and observe metrics.
