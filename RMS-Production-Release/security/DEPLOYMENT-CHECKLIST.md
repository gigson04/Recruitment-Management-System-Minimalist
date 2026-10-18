# Production Deployment Checklist

## Secrets and repository
- [ ] Only the Supabase project URL and publishable/anon key appear in browser config.
- [ ] No service-role key, database password, SMTP password, or private token exists in files or Git history.
- [ ] Git repository visibility and collaborators have been reviewed.

## Supabase
- [ ] Confirm the app URL/key point to the existing RMS project.
- [ ] Confirm `users.user_id` links staff Auth accounts and `applicants.auth_user_id` links the verified applicant Auth account.
- [ ] Back up first, review `sql/README.md`, and test `sql/existing-project-extension.sql` in staging. Do not run `sql/alternate-standalone-schema.sql` against the existing legacy database.
- [ ] Configure Site URL, exact Redirect URLs, email confirmation, password rules, and rate limits.
- [ ] Test registration, confirmation, login, password reset, password update, sign-out, and inactive accounts.
- [ ] Promote the first Administrator only using `manuals/ADMIN-BOOTSTRAP.md`.
- [ ] Test access with separate accounts for every role.
- [ ] Confirm backup schedule and complete a recovery test.

## Web hosting
- [ ] Deploy over HTTPS.
- [ ] Verify root contains `index.html`, `css/app.css`, `js/config.js`, and `js/app.js`.
- [ ] Configure security headers (CSP compatible with the selected CDN, HSTS, Referrer-Policy, X-Content-Type-Options, frame restrictions).
- [ ] Check mobile layout, keyboard navigation, contrast, reduced-motion behavior, and screen-reader status messages.
- [ ] Check browser console and network tab for errors and unexpected data exposure.
- [ ] Configure a custom domain and redirect HTTP to HTTPS if used.

## Functional and security acceptance
- [ ] No fake people or demo application records exist in the database.
- [ ] A public signup can never create an Administrator or staff role.
- [ ] Applicant A cannot view or update Applicant B's application.
- [ ] Interviewers cannot read other interview assignments.
- [ ] Unauthorized direct API requests fail with RLS errors.
- [ ] Closing/expiry blocks new applications.
- [ ] A second Administrator can restore access if the first admin is unavailable.
- [ ] CSV export and logs do not expose unnecessary personal information.
- [ ] Record known limitations and obtain organizational approval before real applicant data is processed.
