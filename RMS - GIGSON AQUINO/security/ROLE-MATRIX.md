# Intended Role Matrix

| Capability | Admin | HR Staff | Recruiter | Interviewer | Hiring Manager | Management | Applicant |
|---|---:|---:|---:|---:|---:|---:|---:|
| Dashboard totals | Yes | Yes | Yes | Yes | Yes | Yes | Own activity/open jobs |
| Manage job postings | Yes | Yes | Yes | No | No | No | Browse open only |
| View applications | Yes | Yes | Yes | Assigned interview context | Yes | Authorized view | Own only |
| Create screening | Yes | Yes | Yes | No | No | View | No |
| Schedule interviews | Yes | Yes | Yes | No | No | View | No |
| Update assigned interview | Yes | Yes | Yes | Assigned only | No | View | No |
| Hiring decisions | Yes | Yes | No | No | Yes | View | Own status only |
| Manage user roles/status | Yes | No | No | No | No | No | No |
| Reports | Yes | Yes | Yes | No | Yes | Yes | No |

This matrix must be reviewed and adjusted to your organization's actual HR policy before production use. This is the intended UI access matrix, not proof that the existing database policies enforce it. Verify current Row Level Security (RLS) policies for every table and direct API request. `sql/README.md` explains the compatible database extension.
