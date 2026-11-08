# Start Here — Recruitment Management System

This folder contains the remodeled, minimalist RMS and a local interactive demo. The demo lets you exercise the interface and recruitment workflow without touching your Supabase data.

## 1. Start the app on Windows

1. Extract the ZIP completely.
2. Open the `RMS-Production-Release` folder.
3. From the project root, run **`py -3 -m http.server 8000 --bind 127.0.0.1`** in a terminal.
4. Open `http://127.0.0.1:8000/index.html` in your browser. Keep the terminal open and press **Ctrl+C** when finished.
5. On the sign-in screen, select **Open interactive demo** to test all local sample workflows. Use the role selector at the top to switch between Administrator, HR Staff, HR Officer, Recruiter, Interviewer, Hiring Manager, Management, and Applicant.

If Windows says Python is not installed, install Python 3 and enable the installer option that adds Python to PATH. On macOS/Linux, run `python3 -m http.server 8000 --bind 127.0.0.1` instead.

## 2. Demo mode vs real Supabase

- **Interactive demo:** stores only fake sample records in this browser's local storage. Creating and editing demo records does not change your actual database.
- **Real sign-in:** requires internet access, the configured Supabase project, valid user accounts, and compatible database/RLS setup. Demo mode is not a replacement for authentication or production data.

The local server makes browser routing and Supabase authentication behave more reliably than opening `index.html` directly. If you use password-reset emails, add `http://127.0.0.1:8000/index.html` to Supabase's allowed redirect URLs.

## 3. Important files

- `js/labs/lab-03-09-jobs-applications.js` — job and application actions
- `js/labs/lab-10-15-screening-interviews.js` — screening and interview actions
- `js/labs/lab-16-18-hiring-employees.js` — selection, hiring, and user actions
- `js/record-actions.js` — shared registry for the lab-group modules

- `index.html` — screen structure, account forms, and app shell
- `css/app.css` — responsive monochrome interface and theme styles
- `js/app.js` — app logic, navigation, local demo adapter, and Supabase workflows
- `js/config.js` — Supabase project URL and public/publishable browser key
- `sql/README.md` — database setup and migration warnings
- `sql/existing-project-extension.sql` — migration for the existing RMS tables
- `sql/applicant-self-registration.sql` — applicant signup/link trigger and related policies
- `sql/alternate-standalone-schema.sql` — **not used**; do not run against the existing RMS database
- `manuals/` — role guides and backup/recovery instructions
- `security/` — role matrix, security review, and deployment checklist
- `TEST-PLAN.md`, `LAB-COVERAGE.md` — manual test checklist and lab coverage notes
- `RMS-DIAGNOSTIC-REPORT.md` — the checks performed and remaining live-backend requirements

## 4. Before using real applicant data

Back up your Supabase project first. Read `sql/README.md`, check the current table/column/constraint names, and test the SQL in a staging project. Then test sign-in, signup/email confirmation, permissions for every role, application workflow, exports, and backup/restore using fake accounts. This environment could exercise the local demo, but it could not execute the SQL against or verify the live Supabase backend.

Resume upload is not implemented in this build; the interface stores a URL/reference only. Configure private Supabase Storage and signed URLs before using real resumes.
