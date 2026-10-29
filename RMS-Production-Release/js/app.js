(() => {
    'use strict';
    const $ = (s, root = document) => root.querySelector(s);
    const $$ = (s, root = document) => [...root.querySelectorAll(s)];
    const state = { client: null, realClient: null, user: null, profile: null, pendingSignup: false, isDemo: false, page: document.body.dataset.page || 'dashboard', jobs: [], applications: [], profiles: [], applicants: [], currentRows: [], theme: 'system' };
    let profileLoad = null;
    const SCREENING_PASS_SCORE = Number(window.RMS_CONFIG?.SCREENING_PASS_SCORE ?? 70);
    const INTERVIEW_PASS_SCORE = Number(window.RMS_CONFIG?.INTERVIEW_PASS_SCORE ?? 70);
    const automaticResult = (score, threshold, pass, fail) => Number.isFinite(Number(score)) && score !== '' && score != null ? (Number(score) >= threshold ? pass : fail) : 'Pending';
    const roles = ['Administrator', 'HR Staff', 'HR Officer', 'Recruiter', 'Interviewer', 'Hiring Manager', 'Management', 'Applicant'];
    const access = {
        Administrator: ['dashboard', 'jobs', 'applicants', 'applications', 'screening', 'interviews', 'hiring', 'employees', 'users', 'reports', 'manuals'],
        'HR Staff': ['dashboard', 'jobs', 'applicants', 'applications', 'screening', 'interviews', 'hiring', 'employees', 'reports', 'manuals'],
        'HR Officer': ['dashboard', 'jobs', 'applicants', 'applications', 'screening', 'interviews', 'hiring', 'employees', 'reports', 'manuals'],
        Recruiter: ['dashboard', 'jobs', 'applicants', 'applications', 'screening', 'interviews', 'reports', 'manuals'],
        Interviewer: ['dashboard', 'interviews', 'manuals'],
        'Hiring Manager': ['dashboard', 'applications', 'hiring', 'employees', 'reports', 'manuals'],
        Management: ['dashboard', 'employees', 'reports', 'manuals'],
        Applicant: ['dashboard', 'jobs', 'my-profile', 'my-applications', 'manuals']
    };
    const titles = { dashboard: 'Dashboard', jobs: 'Job postings', applicants: 'Applicants', applications: 'Applications', screening: 'Screening', interviews: 'Interviews', hiring: 'Hiring decisions', employees: 'Employees', users: 'User management', reports: 'Reports', 'my-profile': 'My profile', 'my-applications': 'My applications', manuals: 'User guide' };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const friendly = e => {
        const m = String(e?.message || 'Something went wrong. Please try again.');
        if (e?.name === 'TimeoutError' || /timed out/i.test(m))
            return 'Supabase sign-in timed out. Check that this page can reach the configured Supabase project, then retry.';
        if (/row-level security|permission denied|not allowed/i.test(m))
            return 'You do not have permission to do that. If you believe this is an error, contact the system administrator.';
        if (/network|fetch/i.test(m))
            return 'Cannot reach Supabase. Check your internet connection and project configuration. You can still test the interface using Open interactive demo.';
        if (/duplicate key|already exists/i.test(m))
            return 'This record already exists.';
        return m.slice(0, 240);
    };
    // The page, demo, and record-action modules load before this controller.
    function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 3800); }
    function message(el, msg, isError = false) { el.textContent = msg; el.classList.toggle('error', isError); }
    function authFetch(input, init = {}) { const controller = new AbortController(), upstream = init.signal; let timedOut = false; const abort = () => controller.abort(upstream?.reason); if (upstream?.aborted)
        abort();
    else
        upstream?.addEventListener('abort', abort, { once: true }); const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 12000); return fetch(input, { ...init, signal: controller.signal }).catch(error => { if (timedOut) {
        const timeout = new Error('Supabase Auth request timed out.');
        timeout.name = 'TimeoutError';
        throw timeout;
    } throw error; }).finally(() => { clearTimeout(timer); upstream?.removeEventListener('abort', abort); }); }
    function configured() { return window.RMS_CONFIG && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(window.RMS_CONFIG.SUPABASE_URL) && window.RMS_CONFIG.SUPABASE_ANON_KEY && !window.RMS_CONFIG.SUPABASE_ANON_KEY.includes('YOUR_'); }
    function showAuth(mode = 'login', msg = '') { $('#startupScreen').classList.add('hidden'); $('#authScreen').classList.remove('hidden'); $('#appShell').classList.add('hidden'); $('#demoTools').classList.add('hidden'); $('#demoTools').hidden = true; $('#demoBanner').classList.add('hidden'); $('#demoBanner').hidden = true; $('#loginForm').classList.toggle('hidden', mode !== 'login'); $('#registerForm').classList.toggle('hidden', mode !== 'register'); $('#resetForm').classList.toggle('hidden', mode !== 'reset'); $('#updatePasswordForm').classList.toggle('hidden', mode !== 'update'); $('#authTitle').textContent = mode === 'register' ? 'Create account' : mode === 'reset' ? 'Reset password' : mode === 'update' ? 'Choose a new password' : 'Sign in'; $('#authSubtitle').textContent = mode === 'register' ? 'Create an applicant account to apply for open positions.' : mode === 'reset' ? 'We will email you a secure password reset link.' : mode === 'update' ? 'Choose a new password for your account.' : 'Sign in to continue to your workspace.'; $('#backToLogin').classList.toggle('hidden', mode === 'login'); $$('[data-auth-mode="register"],[data-auth-mode="reset"]').forEach(b => b.classList.toggle('hidden', mode !== 'login')); message($('#authMessage'), msg); }
    function nav() { const list = (access[state.profile.role] || []); $('#navigation').innerHTML = list.map(key => `<a class="nav-button ${state.page === key ? 'active' : ''}" href="#${esc(key)}" data-page="${esc(key)}">${esc(titles[key] || key)}</a>`).join(''); }
    function showApp() { $('#startupScreen').classList.add('hidden'); $('#authScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden'); $('#demoTools').classList.toggle('hidden', !state.isDemo); $('#demoTools').hidden = !state.isDemo; $('#demoBanner').classList.toggle('hidden', !state.isDemo); $('#demoBanner').hidden = !state.isDemo; if (state.isDemo) $('#demoRoleSelect').value = state.profile.role; $('#sidebarName').textContent = state.profile.full_name || state.user.email; $('#sidebarRole').textContent = state.profile.role; $('#userChip').textContent = state.profile.role; nav(); renderPage(); }
    async function loadProfile(user, session) { const headers = { apikey: window.RMS_CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' }; async function readRows(path) { const response = await authFetch(`${window.RMS_CONFIG.SUPABASE_URL}/rest/v1/${path}`, { headers }); let body; try {
        body = await response.json();
    }
    catch {
        body = null;
    } if (!response.ok)
        throw new Error(body?.message || body?.hint || `Profile lookup failed (HTTP ${response.status}).`); return Array.isArray(body) ? body : []; } const id = encodeURIComponent(user.id); const users = await readRows(`users?select=user_id,username,role,status,created_at&user_id=eq.${id}`); const applicantRows = await readRows(`applicants?select=applicant_id,first_name,last_name,email,status,created_at&auth_user_id=eq.${id}`); const applicant = applicantRows[0]; let data = users[0]; if (data)
        data = { id: data.user_id, applicant_id: applicant?.applicant_id, full_name: applicant ? [applicant.first_name, applicant.last_name].filter(Boolean).join(' ') : data.username, email: applicant?.email || user.email, role: data.role, status: data.status, created_at: data.created_at };
    else if (applicant)
        data = { id: user.id, applicant_id: applicant.applicant_id, full_name: [applicant.first_name, applicant.last_name].filter(Boolean).join(' '), email: applicant.email || user.email, role: 'Applicant', status: 'Active', created_at: applicant.created_at }; if (!data)
        throw new Error('Your Supabase sign-in succeeded, but no matching public.users or public.applicants account row exists. An administrator must link this account before it can use the applicant workspace.'); if (String(data.status || '').toLowerCase() !== 'active')
        throw new Error('This account is inactive. Contact the system administrator.'); if (!roles.includes(data.role))
        throw new Error(`Unrecognized account role: ${data.role}. Contact the system administrator.`); return data; }
    async function establishSession(session) { if (state.isDemo || !session?.user)
        return; const userId = session.user.id; try {
        message($('#authMessage'), 'Signed in. Loading your account…');
        state.user = session.user;
        const pending = profileLoad?.id === userId ? profileLoad.promise : (profileLoad = { id: userId, promise: loadProfile(session.user, session) }).promise;
        try {
            state.profile = await pending;
        }
        finally {
            if (profileLoad?.promise === pending)
                profileLoad = null;
        }
        if (state.user?.id !== userId)
            return;
        const allowed = access[state.profile.role] || [];
        const requested = location.hash.slice(1) || document.body.dataset.page || 'dashboard';
        if (allowed.includes(requested))
            state.page = requested;
        else if (!allowed.includes(state.page))
            state.page = allowed[0] || 'dashboard';
        showApp();
    }
    catch (e) {
        const sameUser = state.user?.id === userId;
        if (sameUser) {
            await state.client.auth.signOut({ scope: 'local' });
            state.user = null;
            state.profile = null;
        }
        if (sameUser || !state.user)
            showAuth('login', friendly(e));
    } }
    const pageViews = window.RMSPageViews({ state, $, access, titles, esc, toast, renderPage, field, openDialog });
    const { pageHead, count, localDate, fetchJobs, applicationContext, table, jobRows,
        renderDashboard, renderJobs, renderApplicants, openApplicant, renderMyProfile,
        saveMyProfile, renderApplications, renderScreening, renderInterviews,
        renderHiring, renderEmployees, convertEmployee, renderUsers,
        renderReports, renderManuals } = pageViews;
    const demoTools = window.RMSDemoTools({ state, roles, access, localDate, showApp, toast });
    const DEMO_SESSION_KEY = demoTools.sessionKey;
    const { enterDemo, resetDemo } = demoTools;
    let pageRenderId = 0;
    async function renderPage() {
        nav();
        const root = $('#pageRoot');
        const renderId = ++pageRenderId;
        const requestedPage = state.page;
        // Keep the current screen visible while the next section loads.
        // Show the loading message only on the first render.
        if (!root.innerHTML.trim()) root.innerHTML = '<div class="panel panel-pad muted">Loading live data…</div>';
        root.setAttribute('aria-busy', 'true');
        try {
        let html;
        switch (requestedPage) {
            case 'dashboard':
                html = await renderDashboard();
                break;
            case 'jobs':
                html = await renderJobs();
                break;
            case 'applicants':
                html = await renderApplicants();
                break;
            case 'my-profile':
                html = await renderMyProfile();
                break;
            case 'applications':
            case 'my-applications':
                html = await renderApplications();
                break;
            case 'screening':
                html = await renderScreening();
                break;
            case 'interviews':
                html = await renderInterviews();
                break;
            case 'hiring':
                html = await renderHiring();
                break;
            case 'employees':
                html = await renderEmployees();
                break;
            case 'users':
                html = await renderUsers();
                break;
            case 'reports':
                html = await renderReports();
                break;
            case 'manuals':
                html = renderManuals();
                break;
            default: html = await renderDashboard();
        }
        // Ignore a slower request if the user has already opened another section.
        if (renderId === pageRenderId && requestedPage === state.page) root.innerHTML = html;
    }
    catch (e) {
        if (renderId === pageRenderId && requestedPage === state.page) root.innerHTML = `${pageHead(titles[requestedPage] || 'Workspace', 'Unable to load this page.')}<div class="panel panel-pad"><strong>Data could not be loaded.</strong><p class="muted">${esc(friendly(e))}</p><button class="button secondary" data-action="retry">Try again</button></div>`;
        console.error('RMS page load error:', e);
    } finally {
        if (renderId === pageRenderId) root.removeAttribute('aria-busy');
    } }
    function field(name, label, type = 'text', required = true, value = '', options = []) { let input; if (type === 'select')
        input = `<select name="${name}" ${required ? 'required' : ''}>${options.map(o => { const ov = typeof o === 'object' ? o.value : o; const ol = typeof o === 'object' ? o.label : o; return `<option value="${esc(ov)}" ${String(value) === String(ov) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
    else if (type === 'textarea')
        input = `<textarea name="${name}" rows="4" maxlength="5000" ${required ? 'required' : ''}>${esc(value)}</textarea>`;
    else
        input = `<input name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${type === 'number' ? 'min="0" max="100000000"' : ''} ${type === 'date' ? '' : ''} maxlength="5000">`; return `<label>${esc(label)}${input}</label>`; }
    function openDialog(title, fields, save, eyebrow = 'RECORD') { const d = $('#recordDialog'); $('#dialogTitle').textContent = title; $('#dialogEyebrow').textContent = eyebrow; $('#dialogFields').innerHTML = fields; message($('#dialogMessage'), ''); d.showModal(); state.dialogSave = save; }
    const recordActions = window.RMSRecordActions({
        state, $, esc, roles, field, openDialog, toast, localDate, fetchJobs,
        applicationContext, renderPage, SCREENING_PASS_SCORE, INTERVIEW_PASS_SCORE,
        automaticResult
    });
    const { openJob, applyJob, updateApplication, openScreening, openInterview,
        selectCandidate, openHiring, openUser } = recordActions;
    async function handleAction(btn) { const a = btn.dataset.action, id = btn.dataset.id; try {
        if (a === 'new-job' || a === 'edit-job') {
            if (!state.jobs.length)
                await fetchJobs();
            return openJob(a === 'edit-job' ? id : null);
        }
        if (a === 'new-applicant' || a === 'edit-applicant')
            return openApplicant(a === 'edit-applicant' ? id : null);
        if (a === 'apply')
            return applyJob(id);
        if (a === 'toggle-job') {
            const next = btn.dataset.status === 'Open' ? 'Closed' : 'Open';
            const job = state.jobs.find(item => item.id === id);
            if (next === 'Open' && job?.closing_date && job.closing_date < localDate()) {
                throw new Error('This posting has passed its closing date. Edit the posting and choose a future closing date before reopening it.');
            }
            const { error } = await state.client.from('job_postings').update({ status: next, updated_at: new Date().toISOString() }).eq('job_id', id);
            if (error)
                throw error;
            toast(`Position ${next.toLowerCase()}.`);
            return renderPage();
        }
        if (a === 'update-application')
            return updateApplication(id, btn.dataset.status);
        if (a === 'select-candidate')
            return selectCandidate(id);
        if (a === 'new-screening')
            return openScreening();
        if (a === 'edit-screening') {
            let rubric = [];
            try { rubric = JSON.parse(btn.dataset.rubric || '[]'); } catch { rubric = []; }
            return openScreening(id, btn.dataset.application, btn.dataset.score, btn.dataset.result, btn.dataset.remarks, rubric);
        }
        if (a === 'new-interview')
            return openInterview();
        if (a === 'edit-interview')
            return openInterview(id, btn.dataset.application, btn.dataset.scheduled, btn.dataset.score, btn.dataset.result, btn.dataset.status, btn.dataset.remarks, btn.dataset.interviewer);
        if (a === 'new-hiring')
            return openHiring();
        if (a === 'convert-employee')
            return convertEmployee();
        if (a === 'edit-user')
            return openUser(id, btn.dataset.role, btn.dataset.status, btn.dataset.name);
        if (a === 'retry')
            return renderPage();
        if (a === 'export-applications')
            return exportApplications();
    }
    catch (e) {
        console.error(e);
        if ($('#recordDialog').open)
            message($('#dialogMessage'), friendly(e), true);
        else
            toast(friendly(e));
    } }
    async function exportApplications() {
        const { data, error } = await state.client
            .from('applications')
            .select('application_id,job_id,applicant_id,status,created_at,application_date');
        if (error) throw error;

        const rows = [
            ['application_id', 'job_id', 'applicant_id', 'status', 'created_at'],
            ...(data || []).map(row => [
                row.application_id,
                row.job_id,
                row.applicant_id,
                row.status,
                row.created_at || row.application_date
            ])
        ];
        const csv = rows.map(row => row.map(value => {
            let text = String(value ?? '');
            if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
            return `"${text.replace(/"/g, '""')}"`;
        }).join(',')).join('\r\n');

        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'applications.csv';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('CSV export created. Handle applicant data securely.');
    }
    document.addEventListener('click', async (e) => { const navLink = e.target.closest('[data-page]'); if (navLink) {
        e.preventDefault();
        const next = navLink.dataset.page;
        if (!(access[state.profile?.role] || []).includes(next))
            return toast('Your role cannot access that page.');
        $('#sidebar').classList.remove('open');
        $('#mobileOverlay').classList.remove('show');
        $('#menuButton').setAttribute('aria-expanded', 'false');
        // Clicking the section already open should not query and redraw it again.
        if (next === state.page) return;
        state.page = next;
        history.replaceState(null, '', `#${next}`);
        return renderPage();
    } const action = e.target.closest('[data-action]'); if (action)
        return handleAction(action); const auth = e.target.closest('[data-auth-mode]'); if (auth)
        return showAuth(auth.dataset.authMode); });
    document.addEventListener('submit', async (e) => {
        if (e.target.id !== 'applicantProfileForm') return;
        e.preventDefault();
        const form = e.target;
        const button = form.querySelector('button[type="submit"]');
        const output = $('#profileSaveMessage', form);
        button.disabled = true;
        message(output, 'Saving profile…');
        try { await saveMyProfile(form); }
        catch (error) { message(output, friendly(error), true); }
        finally { button.disabled = false; }
    });
    function filterJobList() {
        const term = ($('#jobSearch')?.value || '').trim().toLowerCase();
        const department = $('#jobDepartmentFilter')?.value || '';
        const type = $('#jobTypeFilter')?.value || '';
        const status = $('#jobStatusFilter')?.value || '';
        const jobs = state.jobs.filter(job =>
            `${job.title} ${job.department || ''} ${job.employment_type || ''} ${job.description || ''} ${job.qualifications || ''}`.toLowerCase().includes(term) &&
            (!department || job.department === department) &&
            (!type || job.employment_type === type) &&
            (!status || job.status === status)
        );
        const root = $('#jobTable');
        if (root) root.innerHTML = table('', ['POSITION', 'TYPE', 'DEADLINE', 'STATUS', 'ACTION'], jobRows(jobs, state.profile.role === 'Applicant'), 'No matching positions', 'Try different search or filter options.');
    }
    document.addEventListener('change', e => {
        if (['jobDepartmentFilter', 'jobTypeFilter', 'jobStatusFilter'].includes(e.target.id)) filterJobList();
    });
    document.addEventListener('input', e => {
        if (e.target.matches('[data-screening-score]')) {
            const inputs = $$('#dialogFields [data-screening-score]');
            const values = inputs.map(input => input.value.trim());
            const entered = values.filter(value => value !== '').length;
            const total = inputs.reduce((sum, input) => sum + (input.value.trim() === '' ? 0 : Number(input.value)), 0);
            const totalElement = $('#screeningTotal strong');
            if (totalElement) totalElement.textContent = entered === inputs.length ? `${total.toFixed(2).replace(/\.00$/, '')} / 100` : entered ? `${total.toFixed(2).replace(/\.00$/, '')} / 100 (partial)` : '— / 100';
            const resultElement = $('#screeningResult');
            if (resultElement) resultElement.value = entered === inputs.length ? automaticResult(total, SCREENING_PASS_SCORE, 'Qualified', 'Not Qualified') : 'Pending';
        }
        if (e.target.matches('[data-interview-score]')) {
            const inputs = $$('#dialogFields [data-interview-score]');
            const values = inputs.map(input => input.value.trim());
            const entered = values.filter(value => value !== '').length;
            const total = inputs.reduce((sum, input) => sum + (input.value.trim() === '' ? 0 : Number(input.value)), 0);
            const totalElement = $('#interviewTotal strong');
            if (totalElement) totalElement.textContent = entered === inputs.length ? `${total.toFixed(2).replace(/\.00$/, '')} / 100` : entered ? `${total.toFixed(2).replace(/\.00$/, '')} / 100 (partial)` : '— / 100';
            const resultElement = $('#interviewResult');
            if (resultElement) resultElement.value = entered === inputs.length ? automaticResult(total, INTERVIEW_PASS_SCORE, 'Passed', 'Failed') : 'Pending';
        }
        if (e.target.id === 'applicantSearch') {
        const term = e.target.value.toLowerCase();
        const records = state.applicants.filter(a => `${a.applicant_no || ''} ${a.first_name || ''} ${a.last_name || ''} ${a.email || ''}`.toLowerCase().includes(term));
        const rows = records.map(a => `<tr><td><strong>${esc([a.first_name, a.last_name].filter(Boolean).join(' ') || 'Applicant')}</strong><span class="subcell">${esc(a.applicant_no || 'No applicant number')}</span></td><td>${esc(a.email || '—')}<span class="subcell">${esc(a.contact_no || '')}</span></td><td>${esc(a.education || '—')}</td><td><span class="pill">${esc(a.status || 'Active')}</span></td><td><button class="action-link" data-action="edit-applicant" data-id="${esc(a.applicant_id)}">Edit profile</button></td></tr>`);
        $('#applicantTable').innerHTML = table('', ['APPLICANT', 'CONTACT', 'EDUCATION', 'STATUS', 'ACTION'], rows, 'No matching applicants', 'Try a different search.');
    } if (e.target.id === 'jobSearch') filterJobList(); });
    $('#loginForm').addEventListener('submit', async (e) => { e.preventDefault(); if (state.isDemo) { state.isDemo = false; state.client = state.realClient; state.user = null; state.profile = null; } const auth = state.client?.auth; if (typeof auth?.signInWithPassword !== 'function') { message($('#authMessage'), 'The sign-in service is unavailable. Reload the page and try again.', true); return; } const form = e.currentTarget, b = $('button[type="submit"]', form), originalButton = b.innerHTML; b.disabled = true; form.setAttribute('aria-busy', 'true'); b.textContent = 'Signing in…'; message($('#authMessage'), 'Signing in…'); let timer; try {
        const result = await Promise.race([state.client.auth.signInWithPassword({ email: $('#loginEmail').value.trim(), password: $('#loginPassword').value }), new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error('Supabase Auth request timed out.'); error.name = 'TimeoutError'; reject(error); }, 12000); })]);
        if (result.error)
            throw result.error;
        await establishSession(result.data.session);
    }
    catch (err) {
        message($('#authMessage'), friendly(err), true);
    }
    finally {
        clearTimeout(timer);
        form.removeAttribute('aria-busy');
        b.innerHTML = originalButton;
        b.disabled = false;
    } });
    $('#registerForm').addEventListener('submit', async (e) => { e.preventDefault(); const name = $('#registerName').value.trim(), email = $('#registerEmail').value.trim(), password = $('#registerPassword').value; if (name.length < 2)
        return message($('#authMessage'), 'Please enter your full name.', true); if (password.length < 10)
        return message($('#authMessage'), 'Use a password with at least 10 characters.', true); const b = $('button[type="submit"]', e.currentTarget); b.disabled = true; state.pendingSignup = true; try {
        const { data, error } = await state.client.auth.signUp({ email, password, options: { data: { account_type: 'Applicant', full_name: name, first_name: name.split(/\s+/)[0] || 'Applicant', last_name: name.split(/\s+/).slice(1).join(' ') || 'User' } } });
        if (error)
            throw error;
        if (data.session)
            await state.client.auth.signOut({ scope: 'local' });
        state.pendingSignup = false;
        showAuth('login', 'Account created. Confirm your email if required. Your applicant profile is created and linked automatically when the applicant self-registration SQL setup is installed. Sign in after email confirmation and complete your profile before applying.');
    }
    catch (err) {
        state.pendingSignup = false;
        message($('#authMessage'), friendly(err), true);
    }
    finally {
        b.disabled = false;
    } });
    $('#resetForm').addEventListener('submit', async (e) => { e.preventDefault(); try {
        const email = $('#resetEmail').value.trim();
        const { error } = await state.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '?mode=reset' });
        if (error)
            throw error;
        message($('#authMessage'), 'If this email is registered, a password reset link will be sent. Check your inbox.');
    }
    catch (err) {
        message($('#authMessage'), friendly(err), true);
    } });
    $('#updatePasswordForm').addEventListener('submit', async (e) => { e.preventDefault(); const password = $('#newPassword').value, confirm = $('#confirmNewPassword').value; if (password.length < 10)
        return message($('#authMessage'), 'Use at least 10 characters.', true); if (password !== confirm)
        return message($('#authMessage'), 'Passwords do not match.', true); try {
        const { error } = await state.client.auth.updateUser({ password });
        if (error)
            throw error;
        $('#updatePasswordForm').reset();
        showAuth('login', 'Password updated. Sign in using your new password.');
    }
    catch (err) {
        message($('#authMessage'), friendly(err), true);
    } });
    $('#signOutButton').addEventListener('click', async () => { if (state.isDemo) { localStorage.removeItem(DEMO_SESSION_KEY); state.isDemo = false; state.client = state.realClient; state.user = null; state.profile = null; state.page = 'dashboard'; showAuth('login', 'You exited the interactive demo. Sign in with a configured account or reopen the demo.'); return; } const { error } = await state.client.auth.signOut(); if (error)
        toast(friendly(error));
    else {
        state.user = null;
        state.profile = null;
        showAuth('login', 'You have signed out.');
    } });
    $('#menuButton').addEventListener('click', () => { const open = $('#sidebar').classList.toggle('open'); $('#mobileOverlay').classList.toggle('show', open); $('#menuButton').setAttribute('aria-expanded', String(open)); });
    $('#mobileOverlay').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#mobileOverlay').classList.remove('show'); $('#menuButton').setAttribute('aria-expanded', 'false'); });
    $('#themeButton').addEventListener('click', () => { const root = document.documentElement; const current = root.dataset.theme; const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light'; root.dataset.theme = next; localStorage.setItem('rms-theme', next); toast(`Theme: ${next}`); });
    $('#demoModeButton').addEventListener('click', () => { try { enterDemo('Administrator'); } catch (error) { console.error('Interactive demo could not start:', error); state.isDemo = false; state.client = state.realClient; state.user = null; state.profile = null; showAuth('login', `Interactive demo could not start: ${friendly(error)}`); } });
    $('#demoRoleSelect').addEventListener('change', (e) => enterDemo(e.target.value));
    $('#resetDemoButton').addEventListener('click', resetDemo);
    $('#recordDialog').addEventListener('click', (e) => { if (e.target.closest('[data-dialog-close]')) {
        state.dialogSave = null;
        $('#recordDialog').close();
    } });
    $('#recordDialog').addEventListener('close', () => { state.dialogSave = null; });
    $('#recordForm').addEventListener('submit', async (e) => { e.preventDefault(); if (!state.dialogSave)
        return; const b = $('#dialogSave'); b.disabled = true; message($('#dialogMessage'), 'Saving…'); try {
        await state.dialogSave(e.currentTarget);
    }
    catch (err) {
        console.error(err);
        message($('#dialogMessage'), friendly(err), true);
    }
    finally {
        b.disabled = false;
    } });
    async function boot() { const saved = localStorage.getItem('rms-theme'); if (['light', 'dark', 'system'].includes(saved))
        document.documentElement.dataset.theme = saved;
    else
        document.documentElement.dataset.theme = 'system';
    // Older builds persisted demo mode and could hide the real sign-in screen on reload.
    try { localStorage.removeItem(DEMO_SESSION_KEY); } catch { /* Login can still continue if storage is blocked. */ }
    if (!configured()) {
        showAuth('login', 'Setup required: edit js/config.js and add your Supabase project URL and publishable/anon key.');
        document.querySelectorAll('#authScreen input,#loginForm button,#registerForm button,#resetForm button,#updatePasswordForm button,.auth-links button').forEach(x => x.disabled = true);
        return;
    } if (!window.supabase?.createClient) {
        showAuth('login', 'Supabase client failed to load. Check your connection and reload.');
        return;
    } state.client = window.supabase.createClient(window.RMS_CONFIG.SUPABASE_URL, window.RMS_CONFIG.SUPABASE_ANON_KEY, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }, global: { fetch: authFetch } }); state.realClient = state.client; const hash = location.hash.slice(1); if (new URLSearchParams(location.search).get('mode') === 'reset' || hash.includes('type=recovery')) {
        showAuth('update', 'Enter a new password for your account.');
    }
    else if (access[state.profile?.role]?.includes(document.body.dataset.page || hash))
        state.page = document.body.dataset.page || hash; state.client.auth.onAuthStateChange((event, session) => { if ((new URLSearchParams(location.search).get('mode') === 'reset' || location.hash.includes('type=recovery')) && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
        showAuth('update', 'Enter a new password for your account.');
        return;
    } if (session?.user && !state.pendingSignup)
        setTimeout(() => establishSession(session), 0); }); const { data, error } = await state.client.auth.getSession(); if (state.isDemo) return; if (error)
        showAuth('login', friendly(error));
    else if (new URLSearchParams(location.search).get('mode') === 'reset' || location.hash.includes('type=recovery'))
        showAuth('update', 'Enter a new password for your account.');
    else if (data.session)
        await establishSession(data.session);
    else
        showAuth('login'); }
    boot().catch(e => { if (state.isDemo) return; console.error(e); showAuth('login', friendly(e)); });
})();
