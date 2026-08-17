# Data Recovery Plan: Point-in-Time Recovery (PITR) & Stakeholder Notification

## 1. Technical Data Recovery Plan
- **Data Source**: Continuous PostgreSQL Write-Ahead Log (WAL) archiving & daily snapshot (06:00 UTC).
- **Target Recovery Timestamp**: `2024-03-15 14:20:00 UTC` (pre-attack window).

### Step-by-Step Restoration Procedure
1. **Provision Ephemeral Recovery Target**:
   ```bash
   # Spin up temporary DB instance from WAL archive at target timestamp
   pg_restore --target-time="2024-03-15 14:20:00 UTC" -d ephemeral_recovery_db
   ```
2. **Extract Deleted Link Rows**:
   ```sql
   COPY (
     SELECT id, user_id, long_url, code, created_at, tags, expires_at 
     FROM links 
     WHERE id IN ('link_01', 'link_02', ... 'link_12')
   ) TO '/tmp/recovered_links.csv' WITH CSV HEADER;
   ```
3. **Re-insert into Production Database**:
   ```sql
   BEGIN;
   -- Re-insert with original IDs and creation timestamps; ON CONFLICT DO NOTHING for idempotency
   INSERT INTO links (id, user_id, long_url, code, created_at, tags, expires_at)
   VALUES (...)
   ON CONFLICT (id) DO UPDATE SET deleted_at = NULL;
   COMMIT;
   ```
4. **Automated Verification**:
   - HTTP probe testing `GET /:code` for all 12 recovered short codes -> all return 302/307 redirect with 100% fidelity.

---

## 2. Executive Follow-Up Message (VP & Leadership)
> **To**: VP of Product, VP of Engineering, Security Operations  
> **Message**:  
> "Follow-up update on the Admin API security incident:  
> During the 10-minute attack window prior to patch deployment, 12 short links across 8 user accounts were deleted by the attacker.  
> Using our continuous database Write-Ahead Log (WAL) Point-in-Time Recovery, we successfully extracted the exact pre-attack state from 14:20 UTC and restored all 12 links into production.  
> **Current Status**: All 12 links are verified healthy and redirecting. Zero permanent data loss occurred.  
> **Customer Comms**: We are sending a transparent notification to the 8 affected account owners informing them of the temporary outage and full restoration. A comprehensive blameless postmortem will be shared on Friday."

---

## 3. Direct Customer Notification Template (8 Affected Users)
> **Subject**: [Notice] Temporary Availability Issue on Your Short Links — Resolved  
> **Body**:  
> "Dear Customer,  
> Earlier today between 14:22 and 14:32 UTC, an unauthorized request caused temporary deletion of your short link(s).  
> Our security and engineering teams detected the issue, patched the underlying authorization vulnerability, and fully restored your link(s) using our backup recovery systems.  
> **Your Account Security**: No account passwords, API keys, or personal information were accessed or exposed. Your links are fully functional and routing traffic normally.  
> We sincerely apologize for this disruption. If you experience any ongoing issues, please reply directly to this message to reach our priority engineering on-call."
