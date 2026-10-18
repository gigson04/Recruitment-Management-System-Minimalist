# 37-Laboratory Coverage Map

This map uses the supplied lab manual as the source of truth. “Implemented” means a corresponding feature exists in this release’s UI/code; it does not mean it has passed a live database test.

| Lab | Required activity | Current release status |
|---:|---|---|
| 1 | Project setup, navigation, dashboard | Implemented |
| 2 | Relational database | Existing legacy schema is assumed; additive extension supplied, but must be reviewed/applied in staging |
| 3 | Job posting management | Implemented; live duplicate-code constraint must be confirmed in DB |
| 4 | Job search/details/filtering | Search and details implemented; department/type/status filters are not separate controls yet |
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
| 17 | Hiring decision | Implemented; passed completed interview is checked in the UI for Hired decisions |
| 18 | Applicant-to-employee conversion | Implemented; requires `employees` table from the additive SQL extension |
| 19 | Job posting reports | Basic live counts; per-job vacancy-fill breakdown not implemented |
| 20 | Applicant reports | Applicant list exists; dedicated applicant status reports are limited |
| 21 | Recruitment pipeline report | Basic live pipeline counts and relative bars implemented; not a historical cohort report |
| 22 | Recruitment performance reports | Snapshot screening/interview/selection/hiring rates implemented; time-to-hire and historical trend analytics remain unimplemented |
| 23 | Recruitment dashboard | Live count cards implemented; full dashboard chart set from the manual remains unimplemented |
| 24 | User authentication | Supabase Auth flows implemented; live Auth testing required |
| 25 | Role-based access control | Role-aware UI implemented; actual access must be verified against database RLS |
| 26 | Complete integration | Main job-to-hiring-to-employee flow wired; live end-to-end testing required |
| 27 | System-wide validation | Client validations added; database enforcement and transition testing remain required |
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
