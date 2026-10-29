# 37-Laboratory Coverage Map

This map uses the supplied lab manual as the source of truth. “Implemented” means a corresponding feature exists in this release’s UI/code; it does not mean it has passed a live database test.

| Lab | Required activity | Current release status |
|---:|---|---|
| 1 | Project setup, navigation, dashboard | Implemented |
| 2 | Relational database | Existing legacy schema is assumed; additive extension supplied, but must be reviewed/applied in staging |
| 3 | Job posting management | Implemented; live duplicate-code constraint must be confirmed in DB |
| 4 | Job search/details/filtering | Search, job details, and department/employment type/status filters implemented |
| 5 | Applicant registration | Staff-managed registration/editing implemented |
| 6 | Applicant profile/resume | Profile fields and resume URL/reference implemented; private file upload is not implemented |
| 7 | Application module | Implemented |
| 8 | Application validation | Client checks plus database policy dependency; test deadlines, duplicates, and required fields live |
| 9 | Application tracking | Implemented |
| 10 | Applicant screening | Implemented |
| 11 | Screening evaluation | Automatic weighted total and result implemented (20+25+30+10+15); default pass score is 70 based on the lab examples and is configurable in `js/config.js` |
| 12 | Screening history | Implemented |
| 13 | Interview scheduling | Implemented; live interviewer-conflict checking still needs database/test verification |
| 14 | Interview evaluation | Automatic total and result implemented using the lab's 20+30+20+15+15 rubric; default pass score is 70 and configurable in `js/config.js`; criterion breakdown is not stored separately |
| 15 | Interview history | Interview records list implemented; multiple rounds supported by separate records only if existing schema permits |
| 16 | Applicant selection | Hiring Manager can mark a candidate Selected only after qualified screening and a passed completed interview; the selection is stored in application status |
| 17 | Hiring decision | Implemented; selected-application and passed-interview requirements are checked in the UI and additive database trigger |
| 18 | Applicant-to-employee conversion | Implemented; requires `employees` table from the additive SQL extension and a database trigger requiring the matching Hired application |
| 19 | Job posting reports | Per-job vacancies, applications, hires, unfilled positions, and status report implemented |
| 20 | Applicant reports | Applicant status, position, qualified, rejected, and hired reports implemented from current records |
| 21 | Recruitment pipeline report | Basic live pipeline counts and relative bars implemented; not a historical cohort report |
| 22 | Recruitment performance reports | Current screening/interview/selection/hiring rates, average time-to-hire, vacancy fulfillment, and applicants per vacancy implemented; historical trends and source analysis need additional data |
| 23 | Recruitment dashboard | Live count cards plus charts for applicants per job/status, pipeline, open vacancies by department, hires by month, screening results, and interview results implemented |
| 24 | User authentication | Supabase Auth flows implemented; live Auth testing required |
| 25 | Role-based access control | Role-aware UI implemented; actual access must be verified against database RLS |
| 26 | Complete integration | Main job-to-hiring-to-employee flow wired; live end-to-end testing required |
| 27 | System-wide validation | Client gates and database status/conversion triggers added; migration execution and direct API transition testing remain required |
| 28 | Unit testing | Test cases provided in `TEST-PLAN.md`; not automatically run against live Supabase |
| 29 | Integration testing | Test cases provided in `TEST-PLAN.md`; live integration tests remain required |
| 30 | Complete system testing | Test scenario provided; not run against live project |
| 31 | User acceptance testing | UAT template/checklist supplied in `TEST-PLAN.md`; user sessions remain to be conducted |
| 32 | Bug tracking/refinement | Build issues addressed in this release; use the supplied test plan to record remaining defects |
| 33 | Backup/recovery | Procedure checklist supplied; actual backup/restore must be run in Supabase |
| 34 | Deployment preparation | Checklist supplied |
| 35 | Deployment | Local run instructions supplied; public deployment not performed |
| 36 | User manual | Role-specific guides included; read `manuals/` |
| 37 | Final demonstration | Demo sequence supplied in `TEST-PLAN.md`; demonstration must be run by the student |

## Important

The project is a static release candidate, not a verified live production deployment. Do not claim a lab is fully passed until the corresponding test has been performed and recorded against the configured database.

## Workflow order

Use the Lab 37 sequence in `manuals/LAB-37-DEMONSTRATION.md` as the end-to-end acceptance path. Authentication and database setup are prerequisites even though their numbered labs appear later in the teaching sequence. The local demo can exercise the UI workflow, but its browser storage is not a database backup and cannot prove database restore or RLS behavior.
