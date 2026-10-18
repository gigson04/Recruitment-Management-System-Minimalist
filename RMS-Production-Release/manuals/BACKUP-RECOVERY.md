# Database Backup and Recovery Procedure (Lab 33)

Use a staging project first. Backups contain personal applicant information and must be stored securely.

## Before backup

1. Tell users the maintenance window if the system is already in use.
2. Confirm the correct Supabase project and environment.
3. Never paste a database password, connection string, or service-role key into source code or chat.
4. Record the date, project/environment, operator, and backup destination in the lab log.

## Option A — Supabase-managed backups

1. Sign in to the Supabase Dashboard and open the correct project.
2. Open **Database → Backups** (menu labels and availability may vary by plan).
3. Review the latest successful backup and retention period.
4. If the plan provides manual backup/download, create or download the backup using the Dashboard workflow.
5. Store the backup in an access-controlled location. Do not place it in a public repository.
6. Record the backup timestamp and verify the download/backup operation completed.

## Option B — PostgreSQL command-line backup

Use this only if your project provides a database connection string and you have PostgreSQL command-line tools installed. Obtain the connection string from the Supabase Dashboard; keep it private.

```sh
pg_dump "YOUR_PRIVATE_DATABASE_CONNECTION_STRING" --format=custom --file="rms-backup.dump"
```

Do not commit `rms-backup.dump` or a connection string to Git. Confirm that the output file exists and has a plausible non-zero size.

## Restore drill (staging only)

1. Create or select a separate staging database/project. Do not test recovery by overwriting production.
2. Confirm the destination database is the intended restore target.
3. Use the Supabase-supported restore workflow for the backup type you created, or use `pg_restore` only when the destination connection and backup format are compatible.

```sh
pg_restore --clean --if-exists --no-owner --dbname="YOUR_PRIVATE_STAGING_DATABASE_CONNECTION_STRING" "rms-backup.dump"
```

4. Verify that the expected tables exist: `users`, `job_postings`, `applicants`, `applications`, `screenings`, `interviews`, `hiring`, and `employees` (if the extension has been applied).
5. Compare record counts and sample non-sensitive test records with the pre-backup log.
6. Sign in with a staging account and verify job browsing, application tracking, screening, interview, hiring, employee conversion, and reports.
7. Record the restore duration, errors, checks performed, and whether the recovery objective was met.

## Recovery notes

- Restoring a database may not restore uploaded objects in Storage or external email delivery settings. Back those up using their own supported procedures.
- After recovery, verify Auth redirect URLs, Row Level Security policies, grants, extensions, and environment configuration.
- If restore verification fails, stop and investigate in staging. Do not switch production traffic to an unverified restore.

## Lab evidence to attach

- Backup timestamp and method (do not include passwords or private connection strings).
- Screenshot of backup success or secure file metadata.
- Staging restore result and table/record verification.
- Short reflection: what failed, how it was fixed, and the verified recovery time.
