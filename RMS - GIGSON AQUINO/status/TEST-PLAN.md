# RMS Test Plan and UAT Record

Use a staging database and fake test identities. Do not use real applicant data for testing.

## Unit / validation tests

| ID | Test | Expected result | Result/date/notes |
|---|---|---|---|
| UT-01 | Create job with empty title | Blocked with validation message | Pending live test |
| UT-02 | Create open job with past deadline | Blocked | Pending live test |
| UT-03 | Set vacancies to zero or negative | Blocked | Pending live test |
| UT-04 | Register applicant with malformed email | Blocked | Pending live test |
| UT-05 | Register applicant with invalid phone characters | Blocked | Pending live test |
| UT-06 | Apply twice to the same job | Second application blocked | Pending live test |
| UT-07 | Apply to closed/expired job | Rejected by database policy | Pending live test |
| UT-08 | Screening rubric 18, 22, 27, 8, 13 | Total displays 88/100 | Pending browser test |
| UT-09 | Education score over 20 or other criterion over max | Blocked | Pending browser/database test |
| UT-10 | Schedule interview without qualified screening | Blocked | Pending live test |
| UT-11 | Hire without a passed completed interview | Blocked | Pending live test |
| UT-12 | Convert same hired application twice | Duplicate conversion blocked | Pending live test |
| UT-13 | Set salary offer below zero | Blocked | Pending live test |

## Integration tests

| ID | Scenario | Expected result | Result/date/notes |
|---|---|---|---|
| IT-01 | Job posting → application | Application references the correct job/applicant | Pending live test |
| IT-02 | Application → screening | Screening history shows correct applicant and position | Pending live test |
| IT-03 | Qualified screening → interview | Interview can be scheduled and evaluated | Pending live test |
| IT-04 | Passed completed interview → hiring | Hiring decision saves and application status updates | Pending live test |
| IT-05 | Hired decision → employee conversion | Employee number, applicant, position, and start date are transferred | Pending live test |
| IT-06 | Create/update records → dashboard/reports | Counts reflect the changes | Pending live test |
| IT-07 | Close or expire job → applicant tries to apply | Database rejects the submission | Pending live test |

## Workflow stage assertions

For integration checks, verify the application status sequence after each successful action:

`Submitted` -> `Qualified` or `Rejected` -> `For Interview` -> `Interviewed` or `Rejected` -> `Selected` -> `Hired` or `Rejected`.

The UI must not permit an operator to set a later stage directly. Selection requires a Qualified screening plus a Passed, Completed interview; hiring requires a selected application; employee conversion requires a Hired decision. Mark these cases as passed only after exercising them in the demo and staging database.

The additive SQL migration now adds database triggers for application stage order, hiring decisions, and employee conversion. In staging, also attempt direct REST updates that skip each gate; they must fail with a constraint error. Do not call this check passed from a source review alone.

## Role-based security tests

Create separate accounts for Administrator, HR Staff, Recruiter, Interviewer, Hiring Manager, Management, Applicant A, and Applicant B.

- Applicant A must not read/update Applicant B's profile or application by changing IDs.
- Interviewer must not edit job postings, user roles, or hiring decisions and should see only assigned interview records.
- Recruiter must not manage user roles or make hiring decisions unless the organization's approved role matrix explicitly allows it.
- Hiring Manager must not edit job postings or user roles.
- Management should have read-only reporting access.
- Inactive accounts must be denied access.
- Repeat each critical test through direct Supabase REST/API requests, not just the UI.

## UAT form

- Tester/role:
- Date:
- Browser/device:
- Functionality rating (1–5):
- Accuracy rating (1–5):
- Usability rating (1–5):
- Reliability rating (1–5):
- Security rating (1–5):
- Performance rating (1–5):
- Report accuracy rating (1–5):
- Comments:
- Defects found / severity:
- Recommended improvements:
- Acceptance decision: Accept / Accept with changes / Reject

## Final demonstration sequence (manual Lab 37)

Run the demonstration in this order, using one linked applicant and one job throughout. Use a staging database or the clearly labeled local demo with fake data. The applicant must have a separate Applicant login for step 4.

1. **Login** as authorized recruitment staff.
2. **Create Job Posting** and confirm the job is Open with a future closing date.
3. **Register Applicant** and link the applicant record to the Applicant Auth account.
4. **Applicant Applies** by signing in as that applicant and opening the application form for the job from step 2. Leave it open without submitting.
5. **Validate Application** by showing the complete profile, open job, valid deadline, and no duplicate in the form's validation confirmation. After showing the pass, submit the application.
6. **Screen Applicant** by opening the submitted application and entering the screening rubric.
7. **Determine Screening Result** by showing the calculated total and Qualified/Not Qualified outcome. Continue only when Qualified.
8. **Schedule Interview** for that qualified application.
9. **Conduct Interview** with the applicant at the scheduled time (explain this real-world action; it is not a separate database transaction).
10. **Record Interview Evaluation** by entering all rubric scores, saving the Passed result, and marking the interview Completed.
11. **Select Applicant** only after the qualified screening and passed completed interview are visible.
12. **Record Hiring Decision** for the selected application and save the approved Hired decision.
13. **Convert Applicant to Employee** and show the employee record linked to the hired application.
14. **Generate Recruitment Reports** and show the updated pipeline and hiring totals.
15. **Display Dashboard** and show the updated summary counts.
16. **Backup Database** using the approved backup procedure; record the backup and restore verification result. A local demo uses browser storage and is not a database backup.
17. **Logout** and confirm the signed-in workspace is closed.

Record screenshots and actual results for the lab submission. Do not mark tests as passed before running them. Keep the order above; do not skip a gate when the earlier result is missing or failed.
