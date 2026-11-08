# Database setup and compatibility

The app uses the original RMS table family: `users`, `job_postings`, `applicants`, `applications`, `screenings`, `interviews`, `hiring`, and `employees`.

## Existing RMS database

1. Make a fresh Supabase backup before changing the schema.
2. Confirm that the existing database has the original RMS tables listed above. This release does not include the original base-schema file; do not recreate or replace a database that contains your current data.
3. In the Supabase SQL Editor, review and run `existing-project-extension.sql`. It is the additive migration copied from the existing multi-page RMS and adjusted for the status values used by this application. It adds the applicant/Auth link, saved screening rubric, employee table, status history, and role-aware RLS policies.
   It also adds database triggers that reject out-of-order application stage changes and employee records without a matching Hired application.
4. Review and run `applicant-self-registration.sql` to create the Auth signup trigger and policies. The app marks self-service signups with `account_type: Applicant`, and the trigger only auto-creates/links records for those accounts; staff accounts are not downgraded to Applicant.
5. Test with fake accounts for each role before using real applicant data.

These SQL files target the original RMS schema. They have not been executed against your live Supabase database in this environment. Read the SQL before running it and test in a staging project where possible. Rerunning a migration can still fail if your existing database has unexpected constraint names or incompatible legacy values.

### Fix the missing screening rubric column

If the Screening page reports `column screenings.criteria_scores does not exist`, run `fix-screening-rubric-column.sql` in the Supabase SQL Editor. It adds the JSONB rubric column without changing existing scores; existing rows receive an empty rubric. The full existing-project extension also adds this column, so this focused patch is only needed if that migration was not run or the column is still missing.

## Do not run the alternate schema

`alternate-standalone-schema.sql` creates a separate `rms_*` table family and is not used by `js/app.js`. Do not run it on the existing RMS database.

## Interactive demo

Use **Open interactive demo** on the sign-in screen to test the UI without Supabase. Demo records are stored in this browser's local storage only and do not affect your real database. The role selector in Demo Mode can switch between example roles; the reset button restores the sample data.


The frontend workflow is smoke-tested only in the local demo. These SQL files have not been executed against your live database here; use a staging copy and review each policy before production.
