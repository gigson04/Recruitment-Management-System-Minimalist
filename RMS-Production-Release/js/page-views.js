window.RMSPageViews = function (dependencies) {
    const { state, $, access, titles, esc, toast, renderPage, field, openDialog } = dependencies;
    function pageHead(title, desc, action = '') { return `<div class="page-head"><div><p class="micro">RECRUITMENT MANAGEMENT SYSTEM</p><h1 class="page-title">${esc(title)}</h1><p class="page-description">${esc(desc)}</p></div>${action}</div>`; }
    function empty(title, desc) { return `<div class="empty"><strong>${esc(title)}</strong>${esc(desc)}</div>`; }
    function stat(label, value) { return `<div class="stat"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div><div class="muted">${state.isDemo ? 'Local demo count' : 'Live database count'}</div></div>`; }
    const dataTables = { rms_job_postings: { table: 'job_postings', key: 'job_id' }, rms_applications: { table: 'applications', key: 'application_id' }, rms_screenings: { table: 'screenings', key: 'screening_id' }, rms_interviews: { table: 'interviews', key: 'interview_id' }, rms_hiring_decisions: { table: 'hiring', key: 'hiring_id' } };
    async function count(table, query) { const mapped = dataTables[table] || { table, key: 'id' }; let q = state.client.from(mapped.table).select(mapped.key, { count: 'exact', head: true }); if (query)
        q = query(q); const { count, error } = await q; if (error)
        throw error; return count || 0; }
    async function renderDashboard() {
        const role = state.profile.role;
        let cards = [];
        let charts = '';
        if (role === 'Applicant') {
            const today = localDate();
            const [open, mine] = await Promise.all([count('rms_job_postings', q => q.eq('status', 'Open').or(`closing_date.is.null,closing_date.gte.${today}`)), state.profile.applicant_id ? count('rms_applications', q => q.eq('applicant_id', state.profile.applicant_id)) : 0]);
            cards = [stat('Open positions', open), stat('Applications', mine)];
        }
        else {
            const [jobs, apps, interviews, hired] = await Promise.all([count('rms_job_postings'), count('rms_applications'), count('rms_interviews', q => q.gte('interview_date', localDate()).in('status', ['Scheduled', 'Rescheduled'])), count('rms_hiring_decisions', q => q.eq('status', 'Hired'))]);
            cards = [stat('Job postings', jobs), stat('Applications', apps), stat('Upcoming interviews', interviews), stat('Hired', hired)];
        }
        if (role !== 'Applicant' && role !== 'Interviewer') {
            const [jobRows, applicationRows, hireRows, screeningRows, interviewRows] = await Promise.all([
                state.client.from('job_postings').select('job_id,job_title,department,vacancies,status'),
                state.client.from('applications').select('job_id,status'),
                state.client.from('hiring').select('hiring_date,status').eq('status', 'Hired'),
                state.client.from('screenings').select('result'),
                state.client.from('interviews').select('result,status')
            ]);
            for (const result of [jobRows, applicationRows, hireRows, screeningRows, interviewRows]) if (result.error) throw result.error;
            const applicationsByJob = new Map(), pipelineCounts = new Map(), vacanciesByDepartment = new Map(), hiresByMonth = new Map(), screeningCounts = new Map(), interviewCounts = new Map();
            for (const application of applicationRows.data || []) {
                applicationsByJob.set(application.job_id, (applicationsByJob.get(application.job_id) || 0) + 1);
                pipelineCounts.set(application.status || 'Unknown', (pipelineCounts.get(application.status || 'Unknown') || 0) + 1);
            }
            for (const job of jobRows.data || []) if (job.status === 'Open') vacanciesByDepartment.set(job.department || 'Unassigned', (vacanciesByDepartment.get(job.department || 'Unassigned') || 0) + Math.max(0, Number(job.vacancies) || 0));
            for (const hire of hireRows.data || []) if (hire.hiring_date) { const month = String(hire.hiring_date).slice(0, 7); hiresByMonth.set(month, (hiresByMonth.get(month) || 0) + 1); }
            for (const screening of screeningRows.data || []) { const result = screening.result || 'Pending'; screeningCounts.set(result, (screeningCounts.get(result) || 0) + 1); }
            for (const interview of interviewRows.data || []) { const result = interview.status === 'Completed' ? (interview.result || 'Pending') : 'Pending'; interviewCounts.set(result, (interviewCounts.get(result) || 0) + 1); }
            const chart = (title, entries) => {
                const pairs = entries.filter(([, value]) => value > 0).slice(0, 6), max = Math.max(1, ...pairs.map(([, value]) => value));
                const content = pairs.length ? pairs.map(([label, value]) => { const width = Math.max(0, Math.min(100, Math.round(value / max * 100))); return `<div class="pipeline-row"><div class="pipeline-label"><span>${esc(label)}</span><strong>${value}</strong></div><div class="pipeline-track"><span class="pipeline-fill w-${width}"></span></div></div>`; }).join('') : empty('No chart data yet', 'Records will appear as the workflow is used.');
                return `<section class="panel panel-pad"><div class="section-head"><h2>${esc(title)}</h2><span class="micro">CURRENT RECORDS</span></div>${content}</section>`;
            };
            const jobsById = new Map((jobRows.data || []).map(job => [job.job_id, job.job_title]));
            const topJobs = [...applicationsByJob].map(([id, value]) => [jobsById.get(id) || 'Position', value]).sort((a, b) => b[1] - a[1]);
            charts = `<div class="report-grid dashboard-charts">${chart('Applicants per job', topJobs)}${chart('Applicants by status', [...pipelineCounts])}${chart('Recruitment pipeline', [...pipelineCounts])}${chart('Open vacancies by department', [...vacanciesByDepartment])}${chart('Hires by month', [...hiresByMonth].sort((a, b) => a[0].localeCompare(b[0])).slice(-6))}${chart('Screening results', [...screeningCounts])}${chart('Interview results', [...interviewCounts])}</div>`;
        }
        const applicantNotice = role === 'Applicant' && !state.profile.applicant_id ? '<div class="panel panel-pad applicant-notice"><strong>Applicant account needs linking</strong><p>Ask the recruitment administrator to link your existing applicant record by setting <code>applicants.auth_user_id</code> to your Supabase user ID. Applying and application tracking need that link.</p></div>' : charts;
        return `${pageHead('Dashboard', `Welcome, ${state.profile.full_name || state.user.email}. Your workspace is ready.`)}<div class="stats-grid">${cards.join('')}</div>${applicantNotice}<div class="section-head"><h2>Quick actions</h2><span class="micro">BASED ON YOUR ROLE</span></div><div class="panel panel-pad"><div class="toolbar">${(access[role] || []).filter(k => k !== 'dashboard').slice(0, 5).map(k => `<button class="button secondary" data-page="${k}">${esc(titles[k] || k)} ↗</button>`).join('')}</div><p class="muted">${state.isDemo ? 'These sample records are stored only in this browser and are never sent to Supabase.' : 'Click one.'}</p></div>`;
    }
    function localDate() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
    async function fetchJobs() { let q = state.client.from('job_postings').select('job_id,job_code,job_title,department,employment_type,description,qualifications,posting_date,closing_date,vacancies,status,created_at').order('created_at', { ascending: false }); if (state.profile.role === 'Applicant') {
        const today = localDate();
        q = q.eq('status', 'Open').or(`closing_date.is.null,closing_date.gte.${today}`);
    } const { data, error } = await q; if (error)
        throw error; state.jobs = (data || []).map(j => ({ ...j, id: j.job_id, title: j.job_title })); return state.jobs; }
    async function applicationContext(ids = []) { let q = state.client.from('applications').select('application_id,applicant_id,job_id,status'); if (ids.length)
        q = q.in('application_id', ids); const { data: apps, error } = await q; if (error)
        throw error; const rows = apps || [], jobIds = [...new Set(rows.map(a => a.job_id).filter(Boolean))], applicantIds = [...new Set(rows.map(a => a.applicant_id).filter(Boolean))]; const [jobsResult, peopleResult] = await Promise.all([jobIds.length ? state.client.from('job_postings').select('job_id,job_title,department').in('job_id', jobIds) : Promise.resolve({ data: [], error: null }), applicantIds.length ? state.client.from('applicants').select('applicant_id,first_name,last_name,email').in('applicant_id', applicantIds) : Promise.resolve({ data: [], error: null })]); if (jobsResult.error)
        throw jobsResult.error; if (peopleResult.error)
        throw peopleResult.error; const jobs = new Map((jobsResult.data || []).map(j => [j.job_id, j])), people = new Map((peopleResult.data || []).map(p => [p.applicant_id, p])); return rows.map(a => { const j = jobs.get(a.job_id) || {}, p = people.get(a.applicant_id) || {}; return { ...a, id: a.application_id, rms_job_postings: { title: j.job_title, department: j.department }, rms_profiles: { full_name: [p.first_name, p.last_name].filter(Boolean).join(' '), email: p.email } }; }); }
    function table(title, headers, rows, emptyTitle = 'No records yet', emptyDesc = 'Records will appear here when they are added.') { return `<div class="panel"><div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}">${empty(emptyTitle, emptyDesc)}</td></tr>`}</tbody></table></div></div>`; }
    function jobRows(jobs, applicant) { return jobs.map(j => `<tr><td><strong>${esc(j.title)}</strong><span class="subcell">${esc(j.department || 'No department')}</span><details class="job-details"><summary>View job details</summary><div class="job-detail-content"><p>${esc(j.description || 'No description provided.')}</p><p><strong>Qualifications:</strong> ${esc(j.qualifications || 'Not specified')}</p><p><strong>Vacancies:</strong> ${esc(j.vacancies ?? '—')}</p></div></details></td><td>${esc(j.employment_type || '—')}</td><td>${esc(j.closing_date || 'No deadline')}</td><td><span class="pill ${j.status === 'Open' ? 'strong' : ''}">${esc(j.status)}</span></td><td>${applicant ? (!state.profile.applicant_id ? '<button class="button secondary" disabled title="Ask an administrator to link this account to an applicant record">Account needs linking</button>' : `<button class="button secondary" data-action="apply" data-id="${j.id}">Apply</button>`) : `<button class="action-link" data-action="edit-job" data-id="${j.id}">Edit</button> <button class="action-link" data-action="toggle-job" data-id="${j.id}" data-status="${esc(j.status)}">${j.status === 'Open' ? 'Close' : 'Reopen'}</button>`}</td></tr>`); }
    async function renderJobs() { const jobs = await fetchJobs(); const applicant = state.profile.role === 'Applicant'; const action = applicant ? '' : `<button class="button primary" data-action="new-job">+ New posting</button>`; const rows = jobRows(jobs, applicant); const linkNotice = applicant && !state.profile.applicant_id ? '<div class="panel panel-pad applicant-notice"><strong>Applicant account needs linking</strong><p>Your sign-in works, but this account is not linked to an existing applicant record. Ask the recruitment administrator to set <code>applicants.auth_user_id</code> to your Supabase user ID. No database structure change is needed.</p></div>' : ''; const departments = [...new Set(jobs.map(job => job.department).filter(Boolean))].sort(); const types = [...new Set(jobs.map(job => job.employment_type).filter(Boolean))].sort(); const options = values => values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join(''); return `${pageHead('Job postings', applicant ? 'Browse open positions and submit an application.' : 'Create and maintain current vacancies.', action)}${linkNotice}<div class="toolbar"><input class="filter-input" id="jobSearch" placeholder="Search title, department, or requirements" aria-label="Search job postings"><select id="jobDepartmentFilter" aria-label="Filter by department"><option value="">All departments</option>${options(departments)}</select><select id="jobTypeFilter" aria-label="Filter by employment type"><option value="">All employment types</option>${options(types)}</select>${applicant ? '' : `<select id="jobStatusFilter" aria-label="Filter by status"><option value="">All statuses</option>${options(['Open', 'Closed'])}</select>`}<span class="micro">${jobs.length} RECORD(S)</span></div><div id="jobTable">${table('', ['POSITION', 'TYPE', 'DEADLINE', 'STATUS', 'ACTION'], rows, 'No open positions', 'There are currently no positions available.')}</div>`; }
    async function renderApplicants() {
        const { data, error } = await state.client.from('applicants').select('applicant_id,applicant_no,first_name,last_name,email,contact_no,address,education,experience,skills,resume_file,status,created_at').order('created_at', { ascending: false });
        if (error)
            throw error;
        const records = data || [];
        state.applicants = records;
        const rows = records.map(a => `<tr><td><strong>${esc([a.first_name, a.last_name].filter(Boolean).join(' ') || 'Applicant')}</strong><span class="subcell">${esc(a.applicant_no || 'No applicant number')}</span></td><td>${esc(a.email || '—')}<span class="subcell">${esc(a.contact_no || '')}</span></td><td>${esc(a.education || '—')}</td><td><span class="pill ${String(a.status || 'Active').toLowerCase() === 'active' ? 'strong' : ''}">${esc(a.status || 'Active')}</span></td><td><button class="action-link" data-action="edit-applicant" data-id="${esc(a.applicant_id)}">Edit profile</button></td></tr>`);
        return `${pageHead('Applicants', 'Maintain applicant profiles and recruitment information.', `<button class="button primary" data-action="new-applicant">+ Register applicant</button>`)}<div class="toolbar"><input class="filter-input" id="applicantSearch" placeholder="Search name, number, or email" aria-label="Search applicants"><span class="micro">${records.length} RECORD(S)</span></div><div id="applicantTable">${table('', ['APPLICANT', 'CONTACT', 'EDUCATION', 'STATUS', 'ACTION'], rows, 'No applicants registered', 'Register an applicant to start their recruitment record.')}</div>`;
    }
    async function openApplicant(id) {
        let a = null;
        if (id) {
            const { data, error } = await state.client.from('applicants').select('applicant_id,applicant_no,first_name,last_name,email,contact_no,address,education,experience,skills,resume_file,status').eq('applicant_id', id).single();
            if (error)
                throw error;
            a = data;
        }
        const fields = field('first_name', 'First name', 'text', true, a?.first_name || '') + field('last_name', 'Last name', 'text', true, a?.last_name || '') + field('email', 'Email', 'email', true, a?.email || '') + field('contact_no', 'Contact number', 'tel', false, a?.contact_no || '') + field('address', 'Address', 'textarea', false, a?.address || '') + field('education', 'Education', 'textarea', false, a?.education || '') + field('experience', 'Work experience', 'textarea', false, a?.experience || '') + field('skills', 'Skills', 'textarea', false, a?.skills || '') + field('resume_file', 'Resume URL/reference', 'url', false, a?.resume_file || '') + field('status', 'Status', 'select', true, a?.status || 'Active', ['Active', 'Inactive']);
        openDialog(id ? 'Edit applicant profile' : 'Applicant registration', fields, async (f) => { const d = new FormData(f), payload = { first_name: String(d.get('first_name') || '').trim(), last_name: String(d.get('last_name') || '').trim(), email: String(d.get('email') || '').trim(), contact_no: String(d.get('contact_no') || '').trim() || null, address: String(d.get('address') || '').trim() || null, education: String(d.get('education') || '').trim() || null, experience: String(d.get('experience') || '').trim() || null, skills: String(d.get('skills') || '').trim() || null, resume_file: String(d.get('resume_file') || '').trim() || null, status: d.get('status') || 'Active' }; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
            throw new Error('Enter a valid email address.'); if (payload.contact_no && !/^[+()\d\s.-]{7,25}$/.test(payload.contact_no))
            throw new Error('Enter a valid contact number.'); let result; if (id)
            result = await state.client.from('applicants').update(payload).eq('applicant_id', id);
        else
            result = await state.client.from('applicants').insert({ ...payload, applicant_no: `APP-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}` }); if (result.error)
            throw result.error; toast(id ? 'Applicant profile updated.' : 'Applicant registered.'); $('#recordDialog').close(); renderPage(); }, 'APPLICANT');
    }
    async function renderMyProfile() {
        if (state.profile.role !== 'Applicant') throw new Error('Applicant access is required.');
        if (!state.profile.applicant_id) {
            return `${pageHead('My profile', 'Complete your details before applying for a position.')}<div class="panel panel-pad"><strong>Your account is not linked to an applicant profile.</strong><p class="muted">Contact the recruitment administrator and ask them to check the applicant registration trigger and auth_user_id link.</p></div>`;
        }
        const { data: applicant, error } = await state.client.from('applicants').select('applicant_id,applicant_no,first_name,last_name,email,contact_no,address,education,experience,skills,resume_file,status').eq('applicant_id', state.profile.applicant_id).single();
        if (error) throw error;
        const detailsComplete = [applicant.contact_no, applicant.address, applicant.education, applicant.experience, applicant.skills].every(value => String(value || '').trim());
        return `${pageHead('My profile', 'Keep your contact information and qualifications current.')}<div class="panel panel-pad"><div class="section-head"><h2>Applicant information</h2><span class="pill ${detailsComplete ? 'strong' : ''}">${detailsComplete ? 'Ready to apply' : 'Complete required details'}</span></div><form id="applicantProfileForm" class="stack profile-form"><div class="form-grid">${field('first_name', 'First name', 'text', true, applicant.first_name)}${field('last_name', 'Last name', 'text', true, applicant.last_name)}${field('email', 'Email', 'email', true, applicant.email)}${field('contact_no', 'Contact number', 'tel', true, applicant.contact_no || '')}</div>${field('address', 'Address', 'textarea', true, applicant.address || '')}${field('education', 'Education', 'textarea', true, applicant.education || '')}${field('experience', 'Work experience', 'textarea', true, applicant.experience || '')}${field('skills', 'Skills relevant to the role', 'textarea', true, applicant.skills || '')}${field('resume_file', 'Resume URL/reference (optional)', 'url', false, applicant.resume_file || '')}<p class="muted">Required details are used by the application's applicant submission policy. Resume file upload is not enabled; this version accepts a URL/reference.</p><div class="toolbar"><button type="submit" class="button primary">Save profile</button></div><p id="profileSaveMessage" class="notice" role="status" aria-live="polite"></p></form></div>`;
    }
    async function saveMyProfile(form) {
        const d = new FormData(form);
        const payload = {
            first_name: String(d.get('first_name') || '').trim(),
            last_name: String(d.get('last_name') || '').trim(),
            email: String(d.get('email') || '').trim(),
            contact_no: String(d.get('contact_no') || '').trim(),
            address: String(d.get('address') || '').trim(),
            education: String(d.get('education') || '').trim(),
            experience: String(d.get('experience') || '').trim(),
            skills: String(d.get('skills') || '').trim(),
            resume_file: String(d.get('resume_file') || '').trim() || null
        };
        for (const key of ['first_name', 'last_name', 'contact_no', 'address', 'education', 'experience', 'skills']) {
            if (!payload[key]) throw new Error(`Please complete ${key.replaceAll('_', ' ')}.`);
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new Error('Enter a valid email address.');
        if (!/^[+()\d\s.-]{7,25}$/.test(payload.contact_no)) throw new Error('Enter a valid contact number.');
        const { error } = await state.client.from('applicants').update(payload).eq('applicant_id', state.profile.applicant_id);
        if (error) throw error;
        state.profile.full_name = `${payload.first_name} ${payload.last_name}`;
        state.profile.email = payload.email;
        $('#sidebarName').textContent = state.profile.full_name;
        toast('Applicant profile saved. You can now apply for open positions.');
        await renderPage();
    }
    async function renderApplications() { const applicant = state.profile.role === 'Applicant'; let q = state.client.from('applications').select('application_id,job_id,applicant_id,cover_letter,status,application_date,created_at').order('created_at', { ascending: false }); if (applicant) {
        if (!state.profile.applicant_id) {
            state.applications = [];
            return `${pageHead('My applications', 'No applicant record is linked to this login yet.')}<div class="panel panel-pad">Ask your administrator to link this account in applicants.auth_user_id.</div>`;
        }
        q = q.eq('applicant_id', state.profile.applicant_id);
    } const { data, error } = await q; if (error)
        throw error; const base = data || [], context = await applicationContext(base.map(a => a.application_id)), byId = new Map(context.map(a => [a.id, a])); state.applications = base.map(a => ({ ...a, id: a.application_id, created_at: a.created_at || a.application_date, ...byId.get(a.application_id) })); const rows = state.applications.map(a => `<tr><td><strong>${esc(a.rms_job_postings?.title || 'Position unavailable')}</strong><span class="subcell">${esc(a.rms_job_postings?.department || '')}</span></td>${applicant ? '' : `<td>${esc(a.rms_profiles?.full_name || 'Applicant')}<span class="subcell">${esc(a.rms_profiles?.email || '')}</span></td>`}<td>${new Date(a.created_at).toLocaleDateString()}</td><td><span class="pill ${a.status === 'Hired' ? 'strong' : ''}">${esc(a.status)}</span></td><td>${applicant ? '—' : state.profile.role === 'Hiring Manager' ? (a.status === 'Selected' ? '<span class="pill strong">Selected</span>' : a.status === 'Hired' ? '<span class="pill strong">Hired</span>' : ['Rejected', 'Withdrawn'].includes(a.status) ? '<span class="muted">Closed</span>' : `<button class="action-link" data-action="select-candidate" data-id="${a.id}">Select candidate</button>`) : ['Rejected', 'Withdrawn', 'Hired'].includes(a.status) ? '<span class="muted">Closed</span>' : `<button class="action-link" data-action="update-application" data-id="${a.id}" data-status="${esc(a.status)}">Update status</button>`}</td></tr>`); return `${pageHead(applicant ? 'My applications' : 'Applications', applicant ? 'Track the status of your submissions.' : 'Review applicant submissions and move them through the recruitment workflow.')} ${table('', applicant ? ['POSITION', 'APPLIED', 'STATUS', 'NEXT STEP'] : ['POSITION', 'APPLICANT', 'APPLIED', 'STATUS', 'ACTION'], rows, 'No applications yet', applicant ? 'Apply to an open position to see it here.' : 'Applications submitted by applicants will appear here.')}`; }
    async function renderScreening() {
        const { data, error } = await state.client
            .from('screenings')
            .select('screening_id,application_id,score,result,remarks,criteria_scores,created_at,screening_date')
            .order('created_at', { ascending: false });
        if (error) throw error;
        const records = data || [];
        const context = await applicationContext([...new Set(records.map(s => s.application_id))]);
        const byId = new Map(context.map(a => [a.id, a]));
        const rows = records.map(s => {
            const a = byId.get(s.application_id) || {};
            const rubric = Array.isArray(s.criteria_scores) ? s.criteria_scores : [];
            const breakdown = rubric.length
                ? rubric.map(item => `${esc(item.criterion_name || 'Criterion')} ${esc(item.score)} / ${esc(item.max_score)}`).join(' · ')
                : 'Legacy total only';
            return `<tr>
                <td>${esc(a.rms_profiles?.full_name || 'Applicant')}<span class="subcell">${esc(a.rms_job_postings?.title || 'Position')}</span></td>
                <td><strong>${esc(s.score ?? '—')} / 100</strong><span class="subcell">${breakdown}</span></td>
                <td><span class="pill">${esc(s.result || 'Pending')}</span></td>
                <td>${esc(s.remarks || '—')}</td>
                <td><button class="action-link" data-action="edit-screening" data-id="${esc(s.screening_id)}" data-application="${esc(s.application_id)}" data-score="${esc(s.score ?? '')}" data-result="${esc(s.result || 'Pending')}" data-remarks="${esc(s.remarks || '')}" data-rubric="${esc(JSON.stringify(rubric))}">Edit</button></td>
            </tr>`;
        });
        return `${pageHead('Screening', 'Evaluate candidates using the weighted 100-point screening rubric.', `<button class="button primary" data-action="new-screening">+ Add screening</button>`)}${table('', ['APPLICANT / POSITION', 'WEIGHTED SCORE', 'RESULT', 'REMARKS', 'ACTION'], rows, 'No screening records', 'Create a screening record from an application.')}`;
    }
    async function renderInterviews() { let interviewQuery = state.client.from('interviews').select('interview_id,application_id,interview_date,interview_time,interviewer,score,result,remarks,status,created_at').order('interview_date', { ascending: true }); if (state.profile.role === 'Interviewer') interviewQuery = interviewQuery.eq('interviewer', state.profile.full_name); const { data, error } = await interviewQuery; if (error)
        throw error; const records = data || [], context = await applicationContext([...new Set(records.map(i => i.application_id))]), byId = new Map(context.map(a => [a.id, a])); const rows = records.map(raw => { const i = { ...raw, id: raw.interview_id, scheduled_at: raw.interview_date ? `${raw.interview_date}T${raw.interview_time || '00:00:00'}` : null, interviewer_id: raw.interviewer }; const a = byId.get(i.application_id) || {}; return `<tr><td>${esc(a.rms_profiles?.full_name || 'Applicant')}<span class="subcell">${esc(a.rms_job_postings?.title || 'Position')}</span></td><td>${i.scheduled_at ? new Date(i.scheduled_at).toLocaleString() : 'Not scheduled'}</td><td><span class="pill">${esc(i.status)}</span></td><td>${esc(i.result || 'Pending')}</td><td><button class="action-link" data-action="edit-interview" data-id="${i.id}" data-application="${i.application_id}" data-scheduled="${i.scheduled_at || ''}" data-score="${i.score ?? ''}" data-result="${esc(i.result || 'Pending')}" data-status="${esc(i.status)}" data-remarks="${esc(i.remarks || '')}" data-interviewer="${esc(i.interviewer_id || '')}">Edit</button></td></tr>`; }); const canSchedule = ['Administrator', 'HR Staff', 'HR Officer', 'Recruiter'].includes(state.profile.role); return `${pageHead('Interviews', 'Schedule interviews and record evaluations.', canSchedule ? `<button class="button primary" data-action="new-interview">+ Schedule interview</button>` : '')}${table('', ['APPLICANT / POSITION', 'SCHEDULE', 'STATUS', 'RESULT', 'ACTION'], rows, 'No interviews scheduled', 'Interviews will appear here after they are scheduled.')}`; }
    async function renderHiring() { const { data, error } = await state.client.from('hiring').select('hiring_id,application_id,position,status,salary_offer,start_date,created_at').order('created_at', { ascending: false }); if (error)
        throw error; const records = data || [], context = await applicationContext([...new Set(records.map(h => h.application_id))]), byId = new Map(context.map(a => [a.id, a])); const rows = records.map(h => { const a = byId.get(h.application_id) || {}; return `<tr><td>${esc(a.rms_profiles?.full_name || 'Applicant')}<span class="subcell">${esc(h.position || a.rms_job_postings?.title || 'Position')}</span></td><td><span class="pill ${h.status === 'Hired' ? 'strong' : ''}">${esc(h.status)}</span></td><td>${h.salary_offer == null ? '—' : esc(new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(h.salary_offer))}</td><td>${esc(h.start_date || '—')}</td><td>—</td></tr>`; }); return `${pageHead('Hiring decisions', 'Record approved hiring outcomes and start dates.', `<button class="button primary" data-action="new-hiring">+ Record decision</button>`)}${table('', ['APPLICANT / POSITION', 'DECISION', 'OFFER', 'START DATE', 'NOTES'], rows, 'No hiring decisions', 'Approved or declined hiring decisions will appear here.')}`; }
    async function renderEmployees() {
        const { data, error } = await state.client.from('employees').select('employee_id,employee_number,applicant_id,application_id,first_name,last_name,email,position,start_date,employment_status,created_at').order('created_at', { ascending: false });
        if (error)
            throw error;
        const records = data || [], context = await applicationContext([...new Set(records.map(e => e.application_id).filter(Boolean))]), byId = new Map(context.map(a => [a.id, a]));
        const rows = records.map(e => { const a = byId.get(e.application_id) || {}; return `<tr><td><strong>${esc([e.first_name, e.last_name].filter(Boolean).join(' ') || a.rms_profiles?.full_name || 'Employee')}</strong><span class="subcell">${esc(e.employee_number || 'No employee number')}</span></td><td>${esc(e.position || a.rms_job_postings?.title || '—')}</td><td>${esc(e.start_date || '—')}</td><td><span class="pill strong">${esc(e.employment_status || 'Active')}</span></td></tr>`; });
        const canConvert = ['Administrator', 'HR Staff'].includes(state.profile.role);
        return `${pageHead('Employees', 'Employee records created from confirmed hiring decisions.', canConvert ? `<button class="button primary" data-action="convert-employee">+ Convert hired applicant</button>` : '')}${table('', ['EMPLOYEE', 'POSITION', 'START DATE', 'STATUS'], rows, 'No employee records', 'Convert a hired applicant to create the first employee record.')}<p class="muted">Conversion transfers the applicant and application references; it does not copy resume files or sensitive documents.</p>`;
    }
    async function convertEmployee() {
        const { data: hiring, error } = await state.client.from('hiring').select('hiring_id,application_id,position,start_date,status').eq('status', 'Hired').order('created_at', { ascending: false });
        if (error)
            throw error;
        if (!hiring?.length)
            throw new Error('There are no confirmed Hired decisions to convert.');
        const context = await applicationContext(hiring.map(h => h.application_id)), byId = new Map(context.map(a => [a.id, a]));
        const options = hiring.map(h => ({ value: h.application_id, label: `${byId.get(h.application_id)?.rms_profiles?.full_name || 'Applicant'} — ${h.position || byId.get(h.application_id)?.rms_job_postings?.title || 'Position'}` }));
        openDialog('Convert hired applicant to employee', field('application_id', 'Hired application', 'select', true, options[0].value, options) + field('employment_status', 'Employment status', 'select', true, 'Active', ['Active', 'Probation', 'Inactive']), async (f) => {
            const d = new FormData(f), applicationId = String(d.get('application_id') || ''), h = hiring.find(x => x.application_id === applicationId);
            const { data: existing, error: existingError } = await state.client.from('employees').select('employee_id').eq('application_id', applicationId).limit(1);
            if (existingError)
                throw existingError;
            if (existing?.length)
                throw new Error('This hired application already has an employee record.');
            const { data: app, error: appError } = await state.client.from('applications').select('applicant_id,job_id').eq('application_id', applicationId).single();
            if (appError)
                throw appError;
            const { data: applicant, error: applicantError } = await state.client
                .from('applicants')
                .select('applicant_id,first_name,last_name,email,contact_no,address')
                .eq('applicant_id', app.applicant_id)
                .single();
            if (applicantError) throw applicantError;

            const job = byId.get(applicationId)?.rms_job_postings || {};
            const payload = {
                employee_number: `EMP-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
                applicant_id: applicant.applicant_id,
                application_id: applicationId,
                first_name: applicant.first_name,
                last_name: applicant.last_name,
                email: applicant.email || null,
                contact_no: applicant.contact_no || null,
                address: applicant.address || null,
                position: h.position || job.title || 'Employee',
                department: job.department || null,
                start_date: h.start_date || localDate(),
                employment_status: d.get('employment_status') || 'Active'
            };
            const { error: insertError } = await state.client.from('employees').insert(payload);
            if (insertError)
                throw insertError;
            toast('Employee record created.');
            $('#recordDialog').close();
            renderPage();
        }, 'EMPLOYEE');
    }
    async function renderUsers() { if (state.profile.role !== 'Administrator')
        throw new Error('Administrator access is required.'); const { data, error } = await state.client.from('users').select('user_id,username,role,status,created_at').order('created_at', { ascending: false }); if (error)
        throw error; state.profiles = (data || []).map(p => ({ ...p, id: p.user_id, full_name: p.username, email: p.username })); const rows = state.profiles.map(p => `<tr><td><strong>${esc(p.full_name || 'Account')}</strong><span class="subcell">${esc(p.email)}</span></td><td><span class="pill">${esc(p.role)}</span></td><td><span class="pill ${String(p.status).toLowerCase() === 'active' ? 'strong' : ''}">${esc(p.status)}</span></td><td>${new Date(p.created_at).toLocaleDateString()}</td><td><button class="action-link" data-action="edit-user" data-id="${p.id}" data-role="${esc(p.role)}" data-status="${esc(p.status)}" data-name="${esc(p.full_name || '')}">Manage</button></td></tr>`); return `${pageHead('User management', 'Manage existing user roles and account status.')}${table('', ['USER', 'ROLE', 'STATUS', 'CREATED', 'ACTION'], rows, 'No user profiles', 'User records will appear here.')}`; }
    async function renderBasicReports() {
        const [jobs, apps, screenings, interviews, hired, appRows, screenRows, interviewRows] = await Promise.all([
            count('rms_job_postings'), count('rms_applications'), count('rms_screenings'), count('rms_interviews'), count('rms_hiring_decisions', q => q.eq('status', 'Hired')),
            state.client.from('applications').select('status'), state.client.from('screenings').select('result'), state.client.from('interviews').select('result,status')
        ]);
        for (const result of [appRows, screenRows, interviewRows])
            if (result.error)
                throw result.error;
        const statuses = appRows.data || [], screenResults = screenRows.data || [], interviewResults = interviewRows.data || [];
        const submitted = statuses.length, qualified = screenResults.filter(r => r.result === 'Qualified').length, completedInterviews = interviewResults.filter(r => r.status === 'Completed').length, passedInterviews = interviewResults.filter(r => r.status === 'Completed' && r.result === 'Passed').length, selected = statuses.filter(r => r.status === 'Selected').length;
        const pct = (n, d) => d ? `${Math.round(n / d * 100)}%` : '—';
        const pipeline = [['Applicants', submitted], ['Qualified screening', qualified], ['Completed interviews', completedInterviews], ['Selected', selected], ['Hired', hired]], max = Math.max(1, ...pipeline.map(x => x[1]));
        const bars = pipeline.map(([label, value]) => { const width = Math.max(0, Math.min(100, Math.round(value / max * 100))); return `<div class="pipeline-row"><div class="pipeline-label"><span>${esc(label)}</span><strong>${value}</strong></div><div class="pipeline-track"><span class="pipeline-fill w-${width}"></span></div></div>`; }).join('');
        return `${pageHead('Reports', 'Live recruitment totals, pipeline overview, and current pass rates.')}<div class="stats-grid">${[stat('Job postings', jobs), stat('Applications', apps), stat('Screenings', screenings), stat('Interviews', interviews), stat('Hired', hired)].join('')}</div><div class="report-grid"><section class="panel panel-pad"><div class="section-head"><h2>Recruitment pipeline</h2><span class="micro">CURRENT RECORDS</span></div>${bars}<p class="muted">Bars are scaled relative to the largest stage count. Applicants may appear in more than one screening/interview record.</p></section><section class="panel panel-pad"><div class="section-head"><h2>Performance indicators</h2><span class="micro">CURRENT SNAPSHOT</span></div><div class="metric-row"><span>Screening qualification rate</span><strong>${pct(qualified, screenResults.length)}</strong></div><div class="metric-row"><span>Interview pass rate</span><strong>${pct(passedInterviews, completedInterviews)}</strong></div><div class="metric-row"><span>Selection rate</span><strong>${pct(selected, submitted)}</strong></div><div class="metric-row"><span>Hiring rate</span><strong>${pct(hired, submitted)}</strong></div><p class="muted">These are snapshot ratios, not historical cohort metrics or time-to-hire. Use a dated reporting model for formal performance analysis.</p></section></div><div class="panel panel-pad"><span class="micro">EXPORT</span><p class="muted">CSV files can contain confidential applicant information. Export only when authorized and store the file securely.</p><button class="button secondary" data-action="export-applications">Export applications (CSV)</button></div>`;
    }
    async function renderReports() {
        const base = await renderBasicReports();
        const [jobResult, applicationResult, applicantResult, hiringResult, screeningResult] = await Promise.all([
            state.client.from('job_postings').select('job_id,job_code,job_title,department,vacancies,status'),
            state.client.from('applications').select('application_id,applicant_id,job_id,status,application_date,created_at'),
            state.client.from('applicants').select('applicant_id,first_name,last_name,status'),
            state.client.from('hiring').select('application_id,hiring_date,status').eq('status', 'Hired'),
            state.client.from('screenings').select('application_id,result,score,created_at').order('created_at', { ascending: false })
        ]);
        for (const result of [jobResult, applicationResult, applicantResult, hiringResult, screeningResult]) if (result.error) throw result.error;
        const jobs = jobResult.data || [], applications = applicationResult.data || [], applicants = applicantResult.data || [], hires = hiringResult.data || [];
        const applicationById = new Map(applications.map(row => [row.application_id, row]));
        const jobById = new Map(jobs.map(row => [row.job_id, row]));
        const applicantById = new Map(applicants.map(row => [row.applicant_id, row]));
        const latestScreeningByApplication = new Map();
        for (const screening of screeningResult.data || []) if (!latestScreeningByApplication.has(screening.application_id)) latestScreeningByApplication.set(screening.application_id, screening);
        const applicantCounts = new Map(), hiredCounts = new Map(), applicationStatusCounts = new Map();
        for (const application of applications) {
            applicantCounts.set(application.job_id, (applicantCounts.get(application.job_id) || 0) + 1);
            applicationStatusCounts.set(application.status || 'Unknown', (applicationStatusCounts.get(application.status || 'Unknown') || 0) + 1);
        }
        for (const hire of hires) { const application = applicationById.get(hire.application_id); if (application) hiredCounts.set(application.job_id, (hiredCounts.get(application.job_id) || 0) + 1); }
        const jobRows = jobs.map(job => {
            const vacancies = Math.max(0, Number(job.vacancies) || 0), hiredCount = hiredCounts.get(job.job_id) || 0;
            return `<tr><td><strong>${esc(job.job_title)}</strong><span class="subcell">${esc(job.job_code || job.department || '')}</span></td><td>${vacancies}</td><td>${applicantCounts.get(job.job_id) || 0}</td><td>${hiredCount}</td><td>${Math.max(vacancies - hiredCount, 0)}</td><td>${esc(job.status)}</td></tr>`;
        });
        const applicationStatusRows = [...applicationStatusCounts].sort((a, b) => a[0].localeCompare(b[0])).map(([status, total]) => `<tr><td>${esc(status)}</td><td>${total}</td></tr>`);
        const applicantName = id => { const person = applicantById.get(id); return person ? [person.first_name, person.last_name].filter(Boolean).join(' ') : 'Applicant'; };
        const positionRows = applications.map(application => `<tr><td>${esc(jobById.get(application.job_id)?.job_title || 'Position')}</td><td>${esc(applicantName(application.applicant_id))}</td><td>${esc(application.status || 'Unknown')}</td></tr>`);
        const qualifiedRows = [...latestScreeningByApplication.values()].filter(screen => screen.result === 'Qualified').map(screen => { const application = applicationById.get(screen.application_id); return application ? `<tr><td>${esc(applicantName(application.applicant_id))}</td><td>${esc(jobById.get(application.job_id)?.job_title || 'Position')}</td><td>${esc(screen.score ?? '-')}</td></tr>` : ''; });
        const rejectedRows = applications.filter(application => application.status === 'Rejected' || latestScreeningByApplication.get(application.application_id)?.result === 'Not Qualified').map(application => `<tr><td>${esc(applicantName(application.applicant_id))}</td><td>${esc(jobById.get(application.job_id)?.job_title || 'Position')}</td><td>${esc(latestScreeningByApplication.get(application.application_id)?.score ?? '-')}</td></tr>`);
        const hiredRows = hires.map(hire => { const application = applicationById.get(hire.application_id); return application ? `<tr><td>${esc(applicantName(application.applicant_id))}</td><td>${esc(jobById.get(application.job_id)?.job_title || 'Position')}</td><td>${esc(hire.hiring_date || '-')}</td></tr>` : ''; });
        const applicantStatusCounts = new Map();
        for (const applicant of applicants) { const status = applicant.status || 'Unknown'; applicantStatusCounts.set(status, (applicantStatusCounts.get(status) || 0) + 1); }
        const applicantStatusRows = [...applicantStatusCounts].sort((a, b) => a[0].localeCompare(b[0])).map(([status, total]) => `<tr><td>${esc(status)}</td><td>${total}</td></tr>`);
        const durations = hires.map(hire => {
            const application = applicationById.get(hire.application_id), start = application?.application_date || application?.created_at, end = hire.hiring_date;
            if (!start || !end) return null;
            const days = Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${String(start).slice(0, 10)}T00:00:00Z`)) / 86400000);
            return Number.isFinite(days) && days >= 0 ? days : null;
        }).filter(days => days != null);
        const averageDays = durations.length ? `${(durations.reduce((total, days) => total + days, 0) / durations.length).toFixed(1)} days` : 'Not available';
        const totalVacancies = jobs.reduce((total, job) => total + Math.max(0, Number(job.vacancies) || 0), 0);
        const percentage = (numerator, denominator) => denominator ? `${Math.round(numerator / denominator * 100)}%` : 'Not available';
        const vacancyMetrics = `<div class="metric-row"><span>Average time-to-hire</span><strong>${averageDays}</strong></div><div class="metric-row"><span>Vacancy fulfillment rate</span><strong>${percentage(hires.length, totalVacancies)}</strong></div><div class="metric-row"><span>Applicants per vacancy</span><strong>${totalVacancies ? (applications.length / totalVacancies).toFixed(1) : 'Not available'}</strong></div><p class="muted">Time-to-hire is measured from application date to hiring date. Recruitment source reporting is unavailable because the current schema does not collect source data.</p>`;
        return `${base}<div class="panel panel-pad"><div class="section-head"><h2>Job posting and vacancy report</h2><span class="micro">CURRENT RECORDS</span></div>${table('', ['POSITION', 'VACANCIES', 'APPLICANTS', 'HIRED', 'UNFILLED', 'STATUS'], jobRows, 'No job postings', 'Create a job posting to populate this report.')}</div><div class="report-grid"><section class="panel panel-pad"><div class="section-head"><h2>Applicant master status</h2></div>${table('', ['APPLICANT STATUS', 'APPLICANTS'], applicantStatusRows, 'No applicants', 'Applicant records will appear here.')}</section><section class="panel panel-pad"><div class="section-head"><h2>Application stage report</h2></div>${table('', ['APPLICATION STATUS', 'APPLICATIONS'], applicationStatusRows, 'No applications', 'Applications will appear here.')}</section></div><div class="report-grid"><section class="panel panel-pad"><div class="section-head"><h2>Applicants by position</h2></div>${table('', ['POSITION', 'APPLICANT', 'STATUS'], positionRows, 'No applications', 'Applications will appear here.')}</section><section class="panel panel-pad"><div class="section-head"><h2>Qualified applicants</h2></div>${table('', ['APPLICANT', 'POSITION', 'SCREENING SCORE'], qualifiedRows, 'No qualified applicants', 'Qualified screening results will appear here.')}</section></div><div class="report-grid"><section class="panel panel-pad"><div class="section-head"><h2>Rejected applicants</h2></div>${table('', ['APPLICANT', 'POSITION', 'SCREENING SCORE'], rejectedRows, 'No rejected applicants', 'Rejected applications will appear here.')}</section><section class="panel panel-pad"><div class="section-head"><h2>Hired applicants</h2></div>${table('', ['APPLICANT', 'POSITION', 'HIRING DATE'], hiredRows, 'No hired applicants', 'Hiring decisions will appear here.')}</section></div><section class="panel panel-pad"><div class="section-head"><h2>Additional recruitment performance</h2><span class="micro">CURRENT SNAPSHOT</span></div>${vacancyMetrics}</section>`;
    }
    function renderManuals() {
        const role = state.profile.role;
        const roleFiles = { 'Administrator': 'ADMIN-BOOTSTRAP.pdf', 'HR Staff': 'HR-STAFF.pdf', 'HR Officer': 'HR-STAFF.pdf', 'Recruiter': 'RECRUITER.pdf', 'Interviewer': 'INTERVIEWER.pdf', 'Hiring Manager': 'HIRING-MANAGER.pdf', 'Management': 'MANAGEMENT.pdf', 'Applicant': 'APPLICANT.pdf' };
        const guides = {
            'Applicant': {
                intro: 'Find a vacancy, submit one application, and follow its progress from your workspace.',
                steps: [['Complete your account', 'Create an applicant account and confirm your email if asked. If your account is not linked to an applicant profile, contact the recruitment administrator.'], ['Review open positions', 'Choose Job postings. Read the description, qualifications, employment type, and closing date before applying.'], ['Submit your application', 'Choose Apply, write a concise cover letter, and submit once. This version accepts a resume link; it does not upload files.'], ['Follow your progress', 'Open My applications to review each application and its current status. Use Forgot password? if you cannot sign in.']]
            },
            'Administrator': {
                intro: 'Set up access carefully, keep roles current, and protect applicant information.',
                steps: [['Verify the account', 'Confirm the person’s identity and locate the matching account in Supabase Authentication.'], ['Assign the least access needed', 'In User management, choose a role that matches the person’s duties. Public registration does not grant staff access.'], ['Review recruitment setup', 'Read the database setup guide and verify migrations in a staging project before applying them to production.'], ['Maintain and review', 'Deactivate access promptly when duties end. Review reports and access policies according to your organization’s procedures.']]
            },
            'HR Staff': {
                intro: 'Move each candidate through the recruitment workflow and keep every decision documented.',
                steps: [['Review the vacancy and application', 'Check the job requirements, applicant details, and submitted materials before changing an application status.'], ['Complete screening', 'Score the five criteria using the rubric shown in Screening. Review the total and automatic result, then add factual, job-related remarks.'], ['Schedule and complete interviews', 'Create an interview for a qualified application. After the interview, enter the rubric scores, result, completion status, and concise notes.'], ['Record the decision', 'Coordinate approval, record the hiring decision, and verify the resulting application status. Use Reports for current totals.']]
            },
            'HR Officer': {
                intro: 'Coordinate vacancy and candidate records through screening, interviews, and hiring.',
                steps: [['Review the vacancy and application', 'Check the approved job requirements and the submitted applicant information.'], ['Complete screening', 'Use the five criteria in Screening, confirm the calculated result, and record factual remarks.'], ['Coordinate interviews', 'Schedule interviews for qualified candidates and record scores, outcomes, and completion status promptly.'], ['Finalize the workflow', 'Record approved hiring decisions and use Reports to review current recruitment totals.']]
            },
            'Recruiter': {
                intro: 'Publish approved vacancies, keep candidates moving through the pipeline, and coordinate interviews.',
                steps: [['Create an approved vacancy', 'In Job postings, choose New posting. Enter the title, department, employment type, deadline, vacancies, description, and qualifications.'], ['Open or close the posting', 'Open postings appear to applicants. Close a posting when it is no longer accepting applications.'], ['Review and screen applications', 'Use Applications to review submissions and update statuses. In Screening, score each criterion and record job-related remarks.'], ['Coordinate interviews and outcomes', 'Schedule interviews for qualified candidates, record completed evaluations, and coordinate final decisions with HR or the Hiring Manager.']]
            },
            'Interviewer': {
                intro: 'Review your assigned interviews and submit a complete, job-related evaluation.',
                steps: [['Check your schedule', 'Open Interviews and confirm the candidate, position, date, time, and assigned interviewer. Contact HR if an assignment is incorrect.'], ['Complete the evaluation', 'Enter a score for each interview criterion. Review the calculated total and result before saving.'], ['Record factual notes', 'Use concise remarks tied to job requirements. Avoid sensitive personal details or unsupported judgments.'], ['Update the interview status', 'Mark the interview Completed when finished. If it is moved or cancelled, update the status and notify the recruitment contact.']]
            },
            'Hiring Manager': {
                intro: 'Review qualified candidates and record approved hiring decisions with HR.',
                steps: [['Review candidate readiness', 'Open Applications and confirm the latest screening is Qualified and a completed interview is Passed.'], ['Select a candidate', 'Choose Select candidate only after both checks are complete. The application moves to Selected.'], ['Record the approved decision', 'Open Hiring, choose the selected application, and record the approved decision and offer details.'], ['Confirm the result', 'Coordinate communication with HR and verify that the application status reflects the decision.']]
            },
            'Management': {
                intro: 'Use current recruitment totals to monitor activity and support authorized oversight.',
                steps: [['Review the dashboard', 'Open Dashboard for current job, application, interview, and hiring totals.'], ['Review reports', 'Open Reports for a snapshot of recruitment stages and current pass rates.'], ['Read results in context', 'Totals describe current records; they are not historical cohort or time-to-hire analytics.'], ['Request changes through HR', 'Contact HR or the Administrator to correct records or request access. Avoid exporting identifiable data unless approved.']]
            }
        };
        const guide = guides[role] || guides.Applicant;
        const file = roleFiles[role] || roleFiles.Applicant;
        const steps = guide.steps.map(([title, detail], index) => `<li class="manual-step"><span class="manual-step-number">${String(index + 1).padStart(2, '0')}</span><div><h3>${esc(title)}</h3><p>${esc(detail)}</p></div></li>`).join('');
        const rolePages = (access[role] || []).filter(page => page !== 'dashboard').map(page => `<span class="manual-page-tag">${esc(titles[page] || page)}</span>`).join('');
        return `${pageHead('User manual', 'A practical guide to the tasks available in your workspace.')}<div class="manual-page"><section class="manual-hero panel panel-pad"><div><p class="manual-eyebrow">RECRUITMENT MANAGEMENT SYSTEM · USER MANUAL</p><h2>${esc(role)} workflow</h2><p>${esc(guide.intro)}</p></div><div class="manual-hero-actions"><span class="manual-role-badge">Signed in as ${esc(role)}</span><a class="button secondary" href="manuals/${file}" target="_blank" rel="noopener noreferrer">Download role guide (PDF) ↗</a></div><div class="manual-pages"><span class="micro">YOUR WORKSPACE SECTIONS</span><div>${rolePages}</div></div></section><section class="manual-content panel panel-pad" aria-labelledby="manual-steps-title"><div class="section-head"><div><p class="manual-eyebrow">YOUR WORKFLOW</p><h2 id="manual-steps-title">Follow these steps</h2></div><span class="micro">${guide.steps.length} STEPS</span></div><ol class="manual-step-list">${steps}</ol></section><div class="manual-support-grid"><section class="manual-support panel panel-pad"><p class="manual-eyebrow">GOOD PRACTICE</p><h2>Keep records clear</h2><ul><li>Enter accurate information and update records promptly.</li><li>Keep comments factual and relevant to the recruitment decision.</li><li>Share applicant details only with authorized people.</li></ul></section><section class="manual-support manual-help panel panel-pad"><p class="manual-eyebrow">NEED HELP?</p><h2>Use your approved support channel</h2><p>If you cannot access a page or a record looks incorrect, contact your recruitment administrator. Do not try to work around role restrictions.</p><a href="manuals/LAB-37-DEMONSTRATION.md">Follow the required 17-step Lab 37 demonstration</a><br><a href="manuals/README.md" target="_blank" rel="noopener noreferrer">Read all role guides ↗</a></section></div></div>`;
    }
    return {
        pageHead, empty, stat, count, localDate, fetchJobs,
        applicationContext, table, jobRows,
        renderDashboard, renderJobs, renderApplicants, renderMyProfile,
        renderApplications, renderScreening, renderInterviews, renderHiring,
        renderEmployees, openApplicant, saveMyProfile, convertEmployee,
        renderUsers, renderReports, renderManuals
    };
};
