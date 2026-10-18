# Security Review — Recruitment Management System

**Creator:** Gigson Aquino  
**Review type:** Static review of this release candidate and its supplied SQL/JavaScript.  
**Not performed:** live penetration test, authenticated test against the user's Supabase project, third-party dependency audit, or infrastructure scan.

## Controls included in this package

- The UI never accepts a role field during public signup; role assignment must be verified in the existing `users` table by an administrator.
- The UI hides pages and actions by role, but existing database RLS policies must be independently verified for all legacy tables.
- The app checks for duplicate applications and key workflow conditions in the client; equivalent database enforcement is still required for security and race-condition resistance.
- The UI prevents changing the current account's role/status, but the database must enforce administrator-only role changes.
- The browser config is designed for a publishable/anon key only. A service-role key is never needed in the browser.
- UI output escapes data before placing it in HTML; forms validate required fields and length/range constraints are also enforced by SQL.
- No demo people or fake records are seeded.
- Password reset uses Supabase Auth; password changes require a recovery session.

## Risks and remaining verification

| Area | State | Required action |
|---|---|---|
| Live Supabase project | Not tested | Apply schema to staging, configure Auth URLs, and test with separate accounts. |
| Existing RMS schema | Assumed from supplied project files/manual | Verify actual table columns and policies in staging before applying `sql/existing-project-extension.sql`. |
| Resume uploads | Not implemented | Configure private Storage bucket + signed URLs before enabling file upload. Current form stores a URL/reference; private storage is not implemented. |
| Interview assignment labels | Partial UX | The current form uses application IDs and interviewer IDs. Verify the assigned interviewer dropdown and record visibility with test accounts. |
| Login abuse protection | Supabase-dependent | Enable appropriate Auth rate limits, email confirmation, strong password policy, and CAPTCHA/bot protection if public signup is exposed. |
| Audit trail | Not implemented | Add an approved audit log before high-stakes or regulated use. |
| Historical reporting/backup | Not implemented here | Configure Supabase backups, point-in-time recovery if available, and perform a restore drill. |
| Browser/CDN supply chain | Supabase JS is pinned to `2.117.3`; Google Fonts are external | Review vendor releases, consider self-hosting fonts, and use a dependency update process. |
| Sensitive exports | Limited CSV | Treat CSV as confidential; add download authorization and retention rules if exporting expands. |
| Security headers | Host-dependent | Set CSP, HSTS, Referrer-Policy, X-Content-Type-Options, and frame restrictions in hosting configuration. |

## Role-based test matrix

Use one separate test account for each role. Never use real applicant records for this test.

1. **Anonymous:** cannot read or mutate protected legacy tables; verify via direct REST/API calls.
2. **Applicant A:** can see open/current jobs; can apply once per job; can see own applications only; cannot see another applicant's application, screening, interview, or hiring records.
3. **Applicant B:** cannot access Applicant A's records by changing IDs.
4. **Recruiter:** can create/edit/close job postings, view applications, manage screening, and schedule interviews; cannot change user roles or create hiring decisions.
5. **Interviewer:** can read/update assigned interviews only; cannot create or reassign interviews; cannot access unrelated applicants' records via direct REST calls.
6. **HR Staff:** can work with jobs, applications, screening, interviews, and hiring within the configured policies; cannot change roles.
7. **Hiring Manager:** can review permitted application data and record hiring decisions; cannot change roles or edit job postings.
8. **Management:** can view aggregate reports and authorized records; cannot change roles or business records.
9. **Administrator:** can manage users according to the existing RLS policy; test a second admin account for recovery.
10. **Inactive profile:** sign-in should be rejected by the app, and table operations should be denied by existing RLS policies.

For each test, verify both the UI and direct Supabase REST/API calls. Hiding a button is not a security control.
