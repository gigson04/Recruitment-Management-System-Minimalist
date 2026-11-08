# Lab 37: Required System Demonstration

Use one job and one applicant record throughout the demonstration. For a local demo, use only the seeded fake data. For a database demonstration, use a staging project and test identities. Do not use real applicant data.

## Required sequence

1. **Login** as authorized recruitment staff.
2. **Create Job Posting** and confirm it is open with a future deadline.
3. **Register Applicant** and link the applicant record to the Applicant Auth account.
4. **Applicant Applies** by signing in as that applicant and opening the application form for the job from step 2. Leave it open without submitting.
5. **Validate Application** by showing the complete profile, open job, valid deadline, and no duplicate in the form's validation confirmation. After showing the pass, submit the application.
6. **Screen Applicant** by opening the submitted application and completing the weighted rubric.
7. **Determine Screening Result** by showing the calculated score and result. Continue only if Qualified.
8. **Schedule Interview** for that same qualified application.
9. **Conduct Interview** at the scheduled time. This is the real-world interview activity between the two system actions.
10. **Record Interview Evaluation** by entering all five scores and saving the Passed result with status Completed.
11. **Select Applicant** after confirming the Qualified screening and Passed, Completed interview.
12. **Record Hiring Decision** and save the approved Hired outcome.
13. **Convert Applicant to Employee** and show the employee record linked to the hired application.
14. **Generate Recruitment Reports** and show the updated pipeline and hiring totals.
15. **Display Dashboard** and show the updated summary counts.
16. **Backup Database** with the approved database backup procedure, then record the backup and restore verification. The browser demo uses local storage and is not a database backup.
17. **Logout** and confirm the workspace is closed.

## Stop conditions

- Do not proceed from step 5 if validation fails.
- Do not schedule the interview unless screening is Qualified.
- Do not select or hire unless a Passed, Completed interview is recorded.
- Do not convert unless the hiring decision is Hired.
- Do not claim backup/recovery passed until a real backup has been restored and checked.

Record the date, test identity, environment, result, and evidence for every step in `status/TEST-PLAN.md`.
