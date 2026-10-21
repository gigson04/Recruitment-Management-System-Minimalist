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

1. Sign in as authorized staff.
2. Create an open job posting.
3. Register an applicant and create/link the applicant's Auth account.
4. Sign in as that applicant and submit an application.
5. Show application tracking.
6. Screen the applicant; demonstrate rubric total calculation.
7. Schedule and evaluate the interview.
8. Record the hiring decision.
9. Convert the hired applicant into an employee.
10. Show reports and dashboard changes.
11. Demonstrate the backup and restore procedure.
12. Sign out.

Record screenshots and actual results for the lab submission. Do not mark tests as passed before running them.
