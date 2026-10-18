# HR Staff Manual — Recruitment Management System

**Creator:** Gigson Aquino

## Purpose
HR Staff coordinate recruitment records from application review through screening, interviews, and hiring decisions. Access is limited by the role and database policies.

## Workflow
1. **Job postings:** create or edit an approved vacancy. Verify requirements, deadline, location, and number of openings before setting it to Open.
2. **Applications:** open Applications and review each submission. Use a consistent status and follow your organization's screening rules.
3. **Screening:** create a screening record using the application ID, enter the five weighted criteria (20/25/30/10/15), review the automatic total and result out of 100, and add concise job-related remarks. The default qualifying score is 70 and can be changed in `js/config.js` to match organization policy. Do not include sensitive personal commentary.
4. **Interviews:** schedule interviews, update completion status, and record evaluations promptly. Only authorized users should access interview notes. A new interview requires a Qualified screening result.
5. **Hiring:** record decisions only after approval. Check the decision, offer amount, and start date before saving.
6. **Reports:** use aggregate totals for authorized work. Keep exports private and delete local copies according to policy.

## Good practice
- Enter accurate information and correct errors promptly.
- Do not share resumes, contact details, scores, or interview notes through personal accounts.
- Do not change account roles; ask an Administrator.
- If access is denied, do not try to bypass it. Ask the Administrator to review your role.
