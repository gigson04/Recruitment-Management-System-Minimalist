# Administrator Manual — Recruitment Management System

**Creator:** Gigson Aquino

## Initial setup for the existing RMS database

1. Confirm that the Supabase project URL and publishable key in `js/config.js` point to the intended project. Never use a service-role key in browser code.
2. Back up the database and read `sql/README.md`. Review and test `sql/existing-project-extension.sql` in staging before applying it to the live project.
3. Register an account using the sign-in screen and confirm the email if confirmation is enabled.
4. Create or locate the matching `public.users` row and verify the person's identity before assigning staff access. The user UUID must match the Supabase Auth UUID (`users.user_id`). Public registration must not grant a staff role.
5. To promote the first verified administrator, run the SELECT below with the exact verified email, inspect the returned row, and only then run the UPDATE. Replace the placeholder with the actual email; never update all rows.

```sql
select user_id, username, role, status
from public.users
where lower(username) = lower('VERIFIED_ADMIN_EMAIL');

-- Only after confirming the exact intended row and its user_id:
update public.users
set role = 'Administrator', status = 'Active'
where user_id = 'VERIFIED_AUTH_USER_UUID';
```

If `username` is not the email column in your existing schema, adapt the SELECT using the real column name. Verify the affected row count before continuing. Sign out and back in after a role change.

## Link an applicant login

1. Confirm the applicant's identity using the organization's approved process.
2. Locate the exact Auth user UUID in Supabase Authentication → Users.
3. Locate the corresponding applicant row by its applicant number and verified contact details.
4. Link only that row to the exact Auth UUID:

```sql
update public.applicants
set auth_user_id = 'VERIFIED_AUTH_USER_UUID'
where applicant_id = 'VERIFIED_APPLICANT_UUID';
```

Check the affected row count is exactly one. Never link an account based on email alone without identity verification.

## Daily administration

- **Users:** give each staff account the least-privileged role needed; deactivate access promptly when no longer required.
- **Jobs:** verify approved title, department, description, qualifications, deadline, vacancies, and status before opening a vacancy.
- **Applicant profiles:** correct records only after verifying the request. Resume links and contact information are confidential.
- **Workflow:** review screening and interview records; require documented decisions before selection and hiring.
- **Employees:** confirm the hiring decision and start date before converting an applicant.
- **Reports/exports:** share only with authorized recipients and delete local copies according to policy.

## Security and recovery

- Review RLS policies for all legacy tables and test direct API access with separate role accounts.
- Never share credentials, database connection strings, or service-role keys.
- Keep a second verified administrator account for recovery where policy permits.
- Follow `manuals/BACKUP-RECOVERY.md` and perform a staging restore drill.
- Do not disable RLS as a shortcut for permission errors.
