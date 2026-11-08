# RMS Functional Release — Diagnostic Report

**Release target:** `RMS-Production-Release` single-page app  
**Design:** bryl-minimal monochrome interface  
**Date:** 18 October 2026

## Summary

The UI and recruitment actions have been exercised in Chromium with the app disconnected from Supabase and using its clearly labeled local demo adapter. All eight role workspaces rendered without JavaScript exceptions in the smoke test. CRUD/workflow interactions were exercised using fake records. This does **not** prove the real Supabase database, authentication, or RLS will work unchanged; those need a real test account and a database environment.

## Fixes made in this build

- Added a local interactive demo mode with seeded fake records, role switching, and reset. All demo changes stay in this browser's local storage and do not call Supabase.
- Local run instructions use Python's standard-library `http.server` bound to `127.0.0.1`; no project-specific server script is required.
- Added HR Officer to the role selector and removed a post-login mapping that silently changed HR Officer to HR Staff.
- Updated applicant signup metadata to send `account_type: Applicant`, matching the applicant-only Auth trigger in `sql/applicant-self-registration.sql`.
- Corrected the demo applicant-to-user link and moved demo storage to a new versioned key so old sample data cannot keep a stale link.
- Improved interview creation so the application picker identifies the applicant and job, rather than showing only an opaque UUID.
- Changed job-posting, hiring, and upcoming-interview date calculations to use the local date. The additive migration normalizes legacy `Selected for Hiring`/uppercase selection labels to `Selected` so those records appear in the hiring queue.
- Made demo dashboard counts label themselves as local demo counts rather than live database counts.
- Aligned interview scheduling visibility with the HR Officer role and employee read policy with the Hiring Manager workspace.
- Aligned job employment-type choices and workflow status values with the legacy schema plus the included additive extension migration.
- Added a weighted screening score form (Education 20, Experience 25, Technical Skills 30, Certifications 10, Resume Quality 15) and a live calculated total. Verified example: 18 + 22 + 27 + 8 + 13 = 88/100.
- Added UI-side workflow guards so staff cannot newly set `Selected` without the candidate-selection action or newly set `Hired` without a hiring decision. `Screening` and `Interview` statuses require corresponding records.
- Kept the existing-table migration as one transaction and aligned role-based employee read access to the displayed workspace.
- Allowed the CSP to connect to the configured Supabase project's host pattern, so moving to another Supabase project does not require hardcoding a new project hostname in the CSP. Replaced the report chart's inline style width with CSP-safe width classes.

## Checks performed

| Check | Result |
|---|---|
| `node --check js/app.js` | Pass |
| `node --check js/config.js` | Pass |
| HTML parse and local-reference scan | Pass; no missing local page/script/style/manual references found |
| Chromium JavaScript exception smoke test | No unhandled JavaScript exceptions observed during role/page render and tested actions; all 15 main workflow checks and 7 focused interaction checks passed |
| Role navigation | All eight roles render every page exposed in their navigation |
| Job actions | Create, edit, close and reopen tested; job search and no-results state tested |
| Applicant actions | Register/edit, search/no-results, applicant profile save, job details, application submit and application tracking tested |
| Application status | Basic status update tested; workflow-managed transitions now guarded in UI |
| Screening | Weighted rubric save tested; example score confirmed as 88/100 |
| Interview | Create and edit interview tested, including scheduling, Passed/Completed evaluation, and applicant/job labels in the picker; interviewers do not attempt an unauthorized application-status update |
| Selection | Candidate-selection action tested; success toast confirmed |
| Hiring | Hired decision with salary/start date tested |
| Employee conversion | Hired applicant converted to an employee in demo |
| User management | Admin role edit tested |
| CSV export | Browser download tested; `applications.csv` download observed |
| Theme / navigation | Theme control, mobile menu/overlay, sign-out from demo, auth-form navigation, and demo reset tested |
| SQL migration | Reviewed as text; not executed by a PostgreSQL server here |
| Real Supabase integration | Not live-tested from this environment |

## Remaining prerequisites for real use

1. **Database migration:** Back up the existing database and review `sql/README.md`. Test `sql/existing-project-extension.sql` and `sql/applicant-self-registration.sql` against a staging copy of the current schema first. The standalone alternate schema is not used and must not be run on the existing database.
2. **Live Auth:** Test signup, email confirmation, login, password reset, recovery redirects, inactive account handling, and sign-out in the actual Supabase project.
3. **RLS:** Sign in with separate accounts for all eight roles and test both allowed and disallowed operations. Browser navigation is not a security boundary; policies must protect each table.
4. **Workflow verification:** Test job → applicant → application → screening → interview → selection → hiring → employee conversion with actual records.
5. **Resume storage:** Uploading a file is not implemented; this version accepts a URL/reference only. Use private storage and signed links for real resumes.
6. **Backup/recovery:** Follow the manual and perform an actual restore drill before calling the app production-ready.

## Test boundary

The browser smoke test used the app source and a browser storage shim because this build environment could not reach the configured Supabase endpoint and its embedded browser runner blocked direct page navigation. Chromium verified the local UI/demo path, not live Supabase Auth, SQL execution, database writes, or RLS. A prior launcher was checked with HTTP requests and was subsequently removed; the current instructions use Python's standard-library server. A full live browser test still must be done with the configured project reachable. Do not treat this report as a production security certification.
