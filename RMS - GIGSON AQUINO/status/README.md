# Recruitment Management System

**Creator:** Gigson Aquino  
**Stack:** HTML, CSS, JavaScript, Supabase Auth, Supabase PostgreSQL

## Run on this computer

From the project root, start Python's built-in local server with `py -3 -m http.server 8000 --bind 127.0.0.1` on Windows or `python3 -m http.server 8000 --bind 127.0.0.1` on macOS/Linux. Open `http://127.0.0.1:8000/index.html` in your browser. Keep the terminal open while using RMS; press Ctrl+C to stop the server.

Opening `index.html` directly as a `file://` URL is not reliable for Supabase authentication.

## Supabase connection

The app uses the Supabase project configured in `js/config.js` and the existing tables `users`, `job_postings`, `applicants`, `applications`, `screenings`, `interviews`, `hiring`, plus `employees` for applicant-to-employee conversion. Review `sql/README.md` before running any SQL. Back up your database first and test the extension in staging. The UI is not a replacement for Row Level Security; verify every role with separate accounts.

For password reset links or other auth redirects, add `http://127.0.0.1:8000/index.html` to the Supabase project's allowed redirect URLs. Never put a service-role key or database password in browser code. With both SQL setup scripts installed, the applicant-only signup trigger creates or links an applicant record to `applicants.auth_user_id`; verify the setup in staging before using it. See `manuals/ADMIN-BOOTSTRAP.md` and `sql/README.md`.

This local server is available only on this computer. It does not publish the app to the internet or make the database public.

## Interactive demo

Select **Open interactive demo** on the sign-in screen to exercise the local fake-data workflow without connecting to Supabase. Demo changes are stored in this browser only and never reach the real database. See `RMS-DIAGNOSTIC-REPORT.md` for checked flows and items that still need live-backend verification.

## Modules in this release

- Sign in, applicant account signup, password reset, password update, sign out
- Role-based navigation for Administrator, HR Staff/Officer, Recruiter, Interviewer, Hiring Manager, Management, and Applicant
- Job posting create/edit/close/reopen and applicant job search
- Applicant profile registration/editing and resume URL/reference field
- Application submission and tracking, screening history, interview scheduling/evaluation, hiring decisions
- Employee conversion from a confirmed hiring decision
- Live dashboard/report counts, CSV application export, user management, role-specific manuals, theme toggle, responsive navigation
- Lab 37 sequence guide at `manuals/LAB-37-DEMONSTRATION.md`; it distinguishes system actions from the live interview and database backup steps

## Backup and recovery

Follow [`manuals/BACKUP-RECOVERY.md`](manuals/BACKUP-RECOVERY.md) for the backup/restore drill required by Lab 33. Keep backup files and database connection strings private.

## Important limits before real-world use

- No live Supabase connection or end-to-end browser test has been performed from this build environment.
- Applicant-to-Auth account linking requires the existing database extension and an administrator to verify/link the correct user.
- Resume uploads are not implemented; only a URL/reference field is provided. Use private object storage and signed URLs for sensitive resumes.
- The interface checks workflow rules, but critical rules must also be enforced in database constraints/policies/triggers. Review the SQL and security checklist before using real applicant data.

Run the local structural checks with `powershell -ExecutionPolicy Bypass -File status/verify_release.ps1`. The checks do not replace live Supabase, browser workflow, RLS, or backup/restore testing.
