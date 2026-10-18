(() => {
    'use strict';
    const $ = (s, root = document) => root.querySelector(s);
    const $$ = (s, root = document) => [...root.querySelectorAll(s)];
    const state = { client: null, realClient: null, user: null, profile: null, pendingSignup: false, isDemo: false, page: 'dashboard', jobs: [], applications: [], profiles: [], applicants: [], currentRows: [], theme: 'system' };
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
    /* -------------------------------------------------------------
       LOCAL INTERACTIVE DEMO
       This adapter lets every screen/action be exercised without a
       Supabase connection. Demo rows stay in this browser only.
       It is deliberately separate from the real Supabase client.
       ------------------------------------------------------------- */
    const DEMO_DB_KEY = 'rms-functional-demo-db-v2';
    const DEMO_PRIMARY_KEYS = {
        users: 'user_id', job_postings: 'job_id', applicants: 'applicant_id',
        applications: 'application_id', screenings: 'screening_id', interviews: 'interview_id',
        hiring: 'hiring_id', employees: 'employee_id'
    };
    const DEMO_ROLE_EMAILS = {
        'Administrator': 'admin@example.test', 'HR Staff': 'hr@example.test', 'HR Officer': 'hr.officer@example.test',
        'Recruiter': 'recruiter@example.test', 'Interviewer': 'interviewer@example.test',
        'Hiring Manager': 'hiring.manager@example.test', 'Management': 'management@example.test',
        'Applicant': 'applicant@example.test'
    };
    function demoSeedDatabase() {
        const now = new Date().toISOString();
        const today = localDate();
        const addDays = (n) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
        const userRoles = roles.map((role, index) => ({
            user_id: `demo-user-${index + 1}`,
            username: DEMO_ROLE_EMAILS[role],
            role,
            status: 'Active',
            created_at: now
        }));
        const applicants = [
            { applicant_id: 'demo-applicant-1', applicant_no: 'APP-DEMO-001', first_name: 'Alex', last_name: 'Sample', email: DEMO_ROLE_EMAILS.Applicant, contact_no: '+63 917 000 0001', address: 'Demo Address, Philippines', education: 'BS Information Technology', experience: 'Entry-level web projects', skills: 'HTML, CSS, JavaScript', resume_file: '', status: 'Active', auth_user_id: 'demo-user-8', created_at: now },
            { applicant_id: 'demo-applicant-2', applicant_no: 'APP-DEMO-002', first_name: 'Jordan', last_name: 'Example', email: 'jordan@example.test', contact_no: '+63 917 000 0002', address: 'Sample Address, Philippines', education: 'BS Computer Science', experience: 'Two years of software projects', skills: 'JavaScript, SQL, Git', resume_file: '', status: 'Active', auth_user_id: null, created_at: now }
        ];
        const jobs = [
            { job_id: 'demo-job-1', job_code: 'JOB-DEMO-001', job_title: 'Junior Web Developer', department: 'Information Technology', employment_type: 'Full-Time', description: 'Assist with building and maintaining internal web applications.', qualifications: 'Basic HTML, CSS, JavaScript, and willingness to learn.', posting_date: today, closing_date: addDays(45), vacancies: 2, status: 'Open', created_at: now, updated_at: now },
            { job_id: 'demo-job-2', job_code: 'JOB-DEMO-002', job_title: 'HR Assistant', department: 'Human Resources', employment_type: 'Full-Time', description: 'Support recruitment coordination, applicant records, and interview scheduling.', qualifications: 'Good communication and organization skills.', posting_date: today, closing_date: addDays(30), vacancies: 1, status: 'Open', created_at: now, updated_at: now },
            { job_id: 'demo-job-3', job_code: 'JOB-DEMO-003', job_title: 'Data Entry Clerk', department: 'Operations', employment_type: 'Part-Time', description: 'Maintain accurate internal records.', qualifications: 'Attention to detail.', posting_date: addDays(-60), closing_date: addDays(-5), vacancies: 1, status: 'Closed', created_at: now, updated_at: now }
        ];
        const applications = [
            { application_id: 'demo-application-1', applicant_id: applicants[0].applicant_id, job_id: jobs[0].job_id, cover_letter: 'I am excited to start my web development career.', application_date: today, status: 'Submitted', created_at: now, updated_at: now },
            { application_id: 'demo-application-2', applicant_id: applicants[1].applicant_id, job_id: jobs[1].job_id, cover_letter: 'I am interested in supporting the HR team.', application_date: today, status: 'Interview', created_at: now, updated_at: now }
        ];
        return {
            users: userRoles,
            job_postings: jobs,
            applicants,
            applications,
            screenings: [
                { screening_id: 'demo-screening-1', application_id: applications[0].application_id, screening_date: today, score: null, result: null, criteria_scores: [], remarks: 'Demo record — screening not completed.', screened_by: 'demo-user-2', created_at: now },
                { screening_id: 'demo-screening-2', application_id: applications[1].application_id, screening_date: today, score: 88, result: 'Qualified', criteria_scores: [{ criterion_name: 'Education', score: 18, max_score: 20 }, { criterion_name: 'Experience', score: 22, max_score: 25 }, { criterion_name: 'Technical Skills', score: 27, max_score: 30 }, { criterion_name: 'Certifications', score: 8, max_score: 10 }, { criterion_name: 'Resume Quality', score: 13, max_score: 15 }], remarks: 'Demo only: sample screening evaluation.', screened_by: 'demo-user-2', created_at: now }
            ],
            interviews: [
                { interview_id: 'demo-interview-1', application_id: applications[1].application_id, interview_date: today, interview_time: '10:00', interviewer: DEMO_ROLE_EMAILS.Interviewer, score: 90, result: 'Passed', remarks: 'Demo only: sample completed interview.', status: 'Completed', created_at: now, updated_at: now },
                { interview_id: 'demo-interview-2', application_id: applications[0].application_id, interview_date: addDays(3), interview_time: '14:00', interviewer: DEMO_ROLE_EMAILS.Interviewer, score: null, result: null, remarks: '', status: 'Scheduled', created_at: now, updated_at: now }
            ],
            hiring: [],
            employees: []
        };
    }
    function loadDemoDatabase() {
        try {
            const raw = localStorage.getItem(DEMO_DB_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.job_postings) && Array.isArray(parsed.applications) && Array.isArray(parsed.users)) return parsed;
            }
        } catch (error) { console.warn('Demo data could not be read; reseeding.', error); }
        const seed = demoSeedDatabase();
        try { localStorage.setItem(DEMO_DB_KEY, JSON.stringify(seed)); } catch (error) { console.warn('Demo data cannot be persisted by this browser.', error); }
        return seed;
    }
    function saveDemoDatabase(db) {
        try { localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db)); }
        catch (error) { throw new Error('The browser could not save demo data. Check browser storage settings.'); }
    }
    function createDemoClient() {
        const db = loadDemoDatabase();
        let nextId = 1;
        const makeId = (table) => `demo-${table}-${Date.now()}-${nextId++}`;
        const errorResult = (messageText, code = 'DEMO_ERROR') => ({ data: null, error: { message: messageText, code } });
        class DemoQuery {
            constructor(tableName) {
                this.tableName = tableName; this.action = 'select'; this.columns = '*'; this.filters = [];
                this.orGroups = []; this.orders = []; this.maxRows = null; this.cardinality = 'many';
                this.payload = null; this.head = false; this.countRequested = false; this.executed = false;
            }
            select(columns = '*', options = {}) { if (this.action === 'select') this.columns = columns; this.head = Boolean(options.head); this.countRequested = options.count === 'exact'; return this; }
            insert(rows) { this.action = 'insert'; this.payload = rows; return this; }
            update(values) { this.action = 'update'; this.payload = values; return this; }
            delete() { this.action = 'delete'; return this; }
            eq(column, value) { this.filters.push(row => String(row[column] ?? '') === String(value ?? '')); return this; }
            neq(column, value) { this.filters.push(row => String(row[column] ?? '') !== String(value ?? '')); return this; }
            gt(column, value) { this.filters.push(row => row[column] > value); return this; }
            gte(column, value) { this.filters.push(row => row[column] >= value); return this; }
            lt(column, value) { this.filters.push(row => row[column] < value); return this; }
            lte(column, value) { this.filters.push(row => row[column] <= value); return this; }
            in(column, values) { const set = new Set((values || []).map(v => String(v))); this.filters.push(row => set.has(String(row[column]))); return this; }
            is(column, value) { this.filters.push(row => value === null ? row[column] == null : row[column] === value); return this; }
            or(expression) {
                const tests = String(expression || '').split(',').map(part => {
                    const [column, op, ...rest] = part.split('.'); const value = rest.join('.');
                    if (op === 'is' && value === 'null') return row => row[column] == null;
                    if (op === 'eq') return row => String(row[column] ?? '') === value;
                    if (op === 'gte') return row => String(row[column] ?? '') >= value;
                    if (op === 'lte') return row => String(row[column] ?? '') <= value;
                    return () => false;
                });
                this.orGroups.push(row => tests.some(test => test(row))); return this;
            }
            order(column, options = {}) { this.orders.push({ column, ascending: options.ascending !== false }); return this; }
            limit(number) { this.maxRows = Math.max(0, Number(number) || 0); return this; }
            single() { this.cardinality = 'single'; return this; }
            maybeSingle() { this.cardinality = 'maybeSingle'; return this; }
            then(resolve, reject) { return this.execute().then(resolve, reject); }
            async execute() {
                if (this.executed) return this.result;
                this.executed = true;
                try {
                    const rows = db[this.tableName];
                    if (!Array.isArray(rows)) return this.result = errorResult(`Unknown demo table: ${this.tableName}`, '42P01');
                    if (this.action === 'insert') {
                        const inputRows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(item => ({ ...item }));
                        for (const row of inputRows) {
                            const pk = DEMO_PRIMARY_KEYS[this.tableName];
                            if (pk && !row[pk]) row[pk] = makeId(this.tableName);
                            row.created_at = row.created_at || new Date().toISOString();
                            if (this.tableName === 'job_postings') { row.status = row.status || 'Open'; row.updated_at = row.updated_at || row.created_at; }
                            if (this.tableName === 'applicants') { row.status = row.status || 'Active'; row.updated_at = row.updated_at || row.created_at; }
                            if (this.tableName === 'applications') { row.status = row.status || 'Submitted'; row.application_date = row.application_date || localDate(); row.updated_at = row.updated_at || row.created_at; }
                            if (this.tableName === 'screenings') { row.screening_date = row.screening_date || localDate(); row.criteria_scores = row.criteria_scores || []; }
                            if (this.tableName === 'interviews') { row.status = row.status || 'Scheduled'; row.updated_at = row.updated_at || row.created_at; }
                            if (this.tableName === 'hiring') row.hiring_date = row.hiring_date || localDate();
                            if (this.tableName === 'employees') row.updated_at = row.updated_at || row.created_at;
                        }
                        if (this.tableName === 'applications') {
                            const duplicate = inputRows.some((r, i) => rows.concat(inputRows.slice(0, i)).some(old => old.applicant_id === r.applicant_id && old.job_id === r.job_id));
                            if (duplicate) return this.result = errorResult('You have already applied for this position.', '23505');
                        }
                        if (this.tableName === 'employees' && inputRows.some(r => rows.some(old => old.application_id === r.application_id))) return this.result = errorResult('An employee record already exists for this application.', '23505');
                        rows.push(...inputRows); saveDemoDatabase(db);
                        return this.result = { data: null, error: null, count: inputRows.length };
                    }
                    const filtered = rows.filter(row => this.filters.every(test => test(row)) && this.orGroups.every(test => test(row)));
                    if (this.action === 'update') {
                        for (const row of filtered) Object.assign(row, this.payload || {});
                        if (filtered.length) saveDemoDatabase(db);
                        return this.result = { data: null, error: null, count: filtered.length };
                    }
                    if (this.action === 'delete') {
                        const remove = new Set(filtered);
                        db[this.tableName] = rows.filter(row => !remove.has(row));
                        saveDemoDatabase(db);
                        return this.result = { data: null, error: null, count: remove.size };
                    }
                    for (const order of [...this.orders].reverse()) {
                        filtered.sort((a, b) => {
                            const av = a[order.column], bv = b[order.column];
                            if (av == null && bv == null) return 0;
                            if (av == null) return order.ascending ? -1 : 1;
                            if (bv == null) return order.ascending ? 1 : -1;
                            if (av < bv) return order.ascending ? -1 : 1;
                            if (av > bv) return order.ascending ? 1 : -1;
                            return 0;
                        });
                    }
                    const count = filtered.length;
                    const limited = this.maxRows == null ? filtered : filtered.slice(0, this.maxRows);
                    const projected = limited.map(row => this.columns === '*' ? { ...row } : Object.fromEntries(String(this.columns).split(',').map(c => c.trim()).filter(Boolean).map(c => [c, row[c]])));
                    if (this.head) return this.result = { data: null, error: null, count };
                    if (this.cardinality === 'single') {
                        if (projected.length !== 1) return this.result = errorResult(projected.length ? 'Expected one row but found multiple.' : 'No rows found.', 'PGRST116');
                        return this.result = { data: projected[0], error: null, count };
                    }
                    if (this.cardinality === 'maybeSingle') {
                        if (projected.length > 1) return this.result = errorResult('Expected at most one row but found multiple.', 'PGRST116');
                        return this.result = { data: projected[0] || null, error: null, count };
                    }
                    return this.result = { data: projected, error: null, count: this.countRequested ? count : null };
                } catch (error) { return this.result = errorResult(error.message || 'Demo operation failed.'); }
            }
        }
        return {
            from: tableName => new DemoQuery(tableName),
            auth: { signOut: async () => ({ error: null }) }
        };
    }
    function enterDemo(role = 'Administrator') {
        const db = loadDemoDatabase();
        const selectedRole = roles.includes(role) ? role : 'Administrator';
        const demoUser = db.users.find(user => user.role === selectedRole) || db.users[0];
        state.isDemo = true;
        state.client = createDemoClient();
        state.user = { id: demoUser.user_id, email: demoUser.username };
        const applicant = db.applicants.find(person => person.auth_user_id === demoUser.user_id) || (selectedRole === 'Applicant' ? db.applicants[0] : null);
        state.profile = {
            id: demoUser.user_id,
            full_name: selectedRole === 'Applicant' && applicant ? `${applicant.first_name} ${applicant.last_name}` : selectedRole === 'Interviewer' ? demoUser.username : `${selectedRole} Demo`,
            email: selectedRole === 'Applicant' && applicant ? applicant.email : demoUser.username,
            role: selectedRole,
            status: demoUser.status || 'Active',
            applicant_id: selectedRole === 'Applicant' ? applicant?.applicant_id : undefined
        };
        state.page = 'dashboard';
        history.replaceState(null, '', `${location.pathname}#dashboard`);
        showApp();
        toast('Interactive demo opened. Changes stay in this browser.');
    }
    function resetDemo() {
        if (!window.confirm('Reset all local demo records to the original sample data? This does not affect Supabase.')) return;
        localStorage.removeItem(DEMO_DB_KEY);
        enterDemo(state.profile?.role || 'Administrator');
        toast('Demo data reset.');
    }

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
    function showAuth(mode = 'login', msg = '') { $('#authScreen').classList.remove('hidden'); $('#appShell').classList.add('hidden'); $('#demoTools').classList.add('hidden'); $('#demoTools').hidden = true; $('#demoBanner').classList.add('hidden'); $('#demoBanner').hidden = true; $('#loginForm').classList.toggle('hidden', mode !== 'login'); $('#registerForm').classList.toggle('hidden', mode !== 'register'); $('#resetForm').classList.toggle('hidden', mode !== 'reset'); $('#updatePasswordForm').classList.toggle('hidden', mode !== 'update'); $('#authTitle').textContent = mode === 'register' ? 'Create account' : mode === 'reset' ? 'Reset password' : mode === 'update' ? 'Choose a new password' : 'Sign in'; $('#authSubtitle').textContent = mode === 'register' ? 'Create an applicant account to apply for open positions.' : mode === 'reset' ? 'We will email you a secure password reset link.' : mode === 'update' ? 'Choose a new password for your account.' : 'Sign in to continue to your workspace.'; $('#backToLogin').classList.toggle('hidden', mode === 'login'); $$('[data-auth-mode="register"],[data-auth-mode="reset"]').forEach(b => b.classList.toggle('hidden', mode !== 'login')); message($('#authMessage'), msg); }
    function nav() { const list = (access[state.profile.role] || []); $('#navigation').innerHTML = list.map(key => `<a class="nav-button ${state.page === key ? 'active' : ''}" href="#${key}" data-page="${key}">${esc(titles[key] || key)}</a>`).join(''); }
    function showApp() { $('#authScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden'); $('#demoTools').classList.toggle('hidden', !state.isDemo); $('#demoTools').hidden = !state.isDemo; $('#demoBanner').classList.toggle('hidden', !state.isDemo); $('#demoBanner').hidden = !state.isDemo; if (state.isDemo) $('#demoRoleSelect').value = state.profile.role; $('#sidebarName').textContent = state.profile.full_name || state.user.email; $('#sidebarRole').textContent = state.profile.role; $('#userChip').textContent = state.profile.role; nav(); renderPage(); }
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
    async function establishSession(session) { if (!session?.user)
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
        const requested = location.hash.slice(1);
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
        if (role === 'Applicant') {
            const today = localDate();
            const [open, mine] = await Promise.all([count('rms_job_postings', q => q.eq('status', 'Open').or(`closing_date.is.null,closing_date.gte.${today}`)), state.profile.applicant_id ? count('rms_applications', q => q.eq('applicant_id', state.profile.applicant_id)) : 0]);
            cards = [stat('Open positions', open), stat('Applications', mine)];
        }
        else {
            const [jobs, apps, interviews, hired] = await Promise.all([count('rms_job_postings'), count('rms_applications'), count('rms_interviews', q => q.gte('interview_date', localDate())), count('rms_hiring_decisions', q => q.eq('status', 'Hired'))]);
            cards = [stat('Job postings', jobs), stat('Applications', apps), stat('Upcoming interviews', interviews), stat('Hired', hired)];
        }
        const applicantNotice = role === 'Applicant' && !state.profile.applicant_id ? '<div class="panel panel-pad applicant-notice"><strong>Applicant account needs linking</strong><p>Ask the recruitment administrator to link your existing applicant record by setting <code>applicants.auth_user_id</code> to your Supabase user ID. Applying and application tracking need that link.</p></div>' : '';
        return `${pageHead('Dashboard', `Welcome, ${state.profile.full_name || state.user.email}. Your workspace is ready.`)}<div class="stats-grid">${cards.join('')}</div>${applicantNotice}<div class="section-head"><h2>Quick actions</h2><span class="micro">BASED ON YOUR ROLE</span></div><div class="panel panel-pad"><div class="toolbar">${(access[role] || []).filter(k => k !== 'dashboard').slice(0, 5).map(k => `<button class="button secondary" data-page="${k}">${esc(titles[k] || k)} ↗</button>`).join('')}</div><p class="muted">${state.isDemo ? 'These sample records are stored only in this browser and are never sent to Supabase.' : 'Counts are queried from Supabase. No sample applicants or demo records are inserted by this application.'}</p></div>`;
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
    async function renderJobs() { const jobs = await fetchJobs(); const applicant = state.profile.role === 'Applicant'; const action = applicant ? '' : `<button class="button primary" data-action="new-job">+ New posting</button>`; const rows = jobRows(jobs, applicant); const linkNotice = applicant && !state.profile.applicant_id ? '<div class="panel panel-pad applicant-notice"><strong>Applicant account needs linking</strong><p>Your sign-in works, but this account is not linked to an existing applicant record. Ask the recruitment administrator to set <code>applicants.auth_user_id</code> to your Supabase user ID. No database structure change is needed.</p></div>' : ''; return `${pageHead('Job postings', applicant ? 'Browse open positions and submit an application.' : 'Create and maintain current vacancies.', action)}${linkNotice}<div class="toolbar"><input class="filter-input" id="jobSearch" placeholder="Search position or department" aria-label="Search job postings"><span class="micro">${jobs.length} RECORD(S)</span></div><div id="jobTable">${table('', ['POSITION', 'TYPE', 'DEADLINE', 'STATUS', 'ACTION'], rows, 'No open positions', 'There are currently no positions available.')}</div>`; }
    async function renderApplicants() {
        const { data, error } = await state.client.from('applicants').select('applicant_id,applicant_no,first_name,last_name,email,contact_no,address,education,experience,skills,resume_file,status,created_at').order('created_at', { ascending: false });
        if (error)
            throw error;
        const records = data || [];
        state.applicants = records;
        const rows = records.map(a => `<tr><td><strong>${esc([a.first_name, a.last_name].filter(Boolean).join(' ') || 'Applicant')}</strong><span class="subcell">${esc(a.applicant_no || 'No applicant number')}</span></td><td>${esc(a.email || '—')}<span class="subcell">${esc(a.contact_no || '')}</span></td><td>${esc(a.education || '—')}</td><td><span class="pill ${String(a.status || 'Active').toLowerCase() === 'active' ? 'strong' : ''}">${esc(a.status || 'Active')}</span></td><td><button class="action-link" data-action="edit-applicant" data-id="${esc(a.applicant_id)}">Edit profile</button></td></tr>`);
        return `${pageHead('Applicants', 'Maintain applicant profiles and recruitment information.', `<button class="button primary" data-action="new-applicant">+ Register applicant</button>`)}<div class="toolbar"><input class="filter-input" id="applicantSearch" placeholder="Search name, number, or email" aria-label="Search applicants"><span class="micro">${records.length} RECORD(S)</span></div><div id="applicantTable">${table('', ['APPLICANT', 'CONTACT', 'EDUCATION', 'STATUS', 'ACTION'], rows, 'No applicants registered', 'Register an applicant to start their recruitment record.')}</div><p class="muted">Resume files are stored as references/URLs in this version. Configure private storage before uploading sensitive documents.</p>`;
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
        throw error; const base = data || [], context = await applicationContext(base.map(a => a.application_id)), byId = new Map(context.map(a => [a.id, a])); state.applications = base.map(a => ({ ...a, id: a.application_id, created_at: a.created_at || a.application_date, ...byId.get(a.application_id) })); const rows = state.applications.map(a => `<tr><td><strong>${esc(a.rms_job_postings?.title || 'Position unavailable')}</strong><span class="subcell">${esc(a.rms_job_postings?.department || '')}</span></td>${applicant ? '' : `<td>${esc(a.rms_profiles?.full_name || 'Applicant')}<span class="subcell">${esc(a.rms_profiles?.email || '')}</span></td>`}<td>${new Date(a.created_at).toLocaleDateString()}</td><td><span class="pill ${a.status === 'Hired' ? 'strong' : ''}">${esc(a.status)}</span></td><td>${applicant ? '—' : state.profile.role === 'Hiring Manager' ? (a.status === 'Selected' ? '<span class="pill strong">Selected</span>' : a.status === 'Hired' ? '<span class="pill strong">Hired</span>' : ['Rejected', 'Withdrawn'].includes(a.status) ? '<span class="muted">Closed</span>' : `<button class="action-link" data-action="select-candidate" data-id="${a.id}">Select candidate</button>`) : `<button class="action-link" data-action="update-application" data-id="${a.id}" data-status="${esc(a.status)}">Update status</button>`}</td></tr>`); return `${pageHead(applicant ? 'My applications' : 'Applications', applicant ? 'Track the status of your submissions.' : 'Review applicant submissions and move them through the recruitment workflow.')} ${table('', applicant ? ['POSITION', 'APPLIED', 'STATUS', 'NEXT STEP'] : ['POSITION', 'APPLICANT', 'APPLIED', 'STATUS', 'ACTION'], rows, 'No applications yet', applicant ? 'Apply to an open position to see it here.' : 'Applications submitted by applicants will appear here.')}`; }
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
    async function renderReports() {
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
    function renderManuals() { const role = state.profile.role; const guide = { 'Administrator': 'ADMIN-BOOTSTRAP.pdf', 'HR Staff': 'HR-STAFF.pdf', 'HR Officer': 'HR-STAFF.pdf', 'Recruiter': 'RECRUITER.pdf', 'Interviewer': 'INTERVIEWER.pdf', 'Hiring Manager': 'HIRING-MANAGER.pdf', 'Management': 'MANAGEMENT.pdf', 'Applicant': 'APPLICANT.pdf' }[role] || 'APPLICANT.pdf'; return `${pageHead('User guide', `Your current role is ${role}. Only role-relevant actions are available in the navigation.`)}<div class="panel panel-pad"><h2>${esc(role)} guide</h2><p class="page-description">Download the full role-specific manual for step-by-step instructions.</p><p><a class="button secondary" href="manuals/${guide}" target="_blank" rel="noopener noreferrer">Open ${esc(role)} manual (PDF) ↗</a></p><ol>${(role === 'Applicant' ? ['Create and confirm your account.', 'Open Job postings and review requirements and deadline.', 'Choose Apply and complete the application form.', 'Open My applications to track status.', 'Use Forgot password if you cannot sign in.'] : role === 'Administrator' ? ['Confirm each staff member’s identity before assigning a role.', 'Give each account only the minimum role needed.', 'Deactivate accounts when access is no longer required.', 'Review RLS policies and Supabase logs periodically.', 'Never share service-role keys or applicant credentials.'] : role === 'Interviewer' ? ['Open Interviews to view assigned interview records.', 'Record the interview result, score, and relevant job-related remarks.', 'Keep notes factual, professional, and limited to hiring needs.', 'Do not change hiring permissions or account roles.'] : role === 'Management' ? ['Open Dashboard for current system totals.', 'Open Reports for live aggregate counts.', 'Use results only for authorized recruitment oversight.', 'Contact HR for record corrections; avoid exporting personal data unnecessarily.'] : ['Review the records assigned to your workflow.', 'Enter only accurate, job-related information.', 'Update application, screening, interview, or hiring records according to your role.', 'Do not share applicant information outside authorized recruitment activities.']).map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="muted">If an action is denied, contact the administrator instead of attempting to bypass access controls.</p></div>`; }
    async function renderPage() { nav(); const root = $('#pageRoot'); root.innerHTML = '<div class="panel panel-pad muted">Loading live data…</div>'; try {
        let html;
        switch (state.page) {
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
        root.innerHTML = html;
    }
    catch (e) {
        root.innerHTML = `${pageHead(titles[state.page] || 'Workspace', 'Unable to load this page.')}<div class="panel panel-pad"><strong>Data could not be loaded.</strong><p class="muted">${esc(friendly(e))}</p><button class="button secondary" data-action="retry">Try again</button></div>`;
        console.error('RMS page load error:', e);
    } }
    function field(name, label, type = 'text', required = true, value = '', options = []) { let input; if (type === 'select')
        input = `<select name="${name}" ${required ? 'required' : ''}>${options.map(o => { const ov = typeof o === 'object' ? o.value : o; const ol = typeof o === 'object' ? o.label : o; return `<option value="${esc(ov)}" ${String(value) === String(ov) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
    else if (type === 'textarea')
        input = `<textarea name="${name}" rows="4" maxlength="5000" ${required ? 'required' : ''}>${esc(value)}</textarea>`;
    else
        input = `<input name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${type === 'number' ? 'min="0" max="100000000"' : ''} ${type === 'date' ? '' : ''} maxlength="5000">`; return `<label>${esc(label)}${input}</label>`; }
    function openDialog(title, fields, save, eyebrow = 'RECORD') { const d = $('#recordDialog'); $('#dialogTitle').textContent = title; $('#dialogEyebrow').textContent = eyebrow; $('#dialogFields').innerHTML = fields; message($('#dialogMessage'), ''); d.showModal(); state.dialogSave = save; }
    async function saveJob(form, id) { const f = new FormData(form), fields = { job_title: String(f.get('title')).trim(), department: String(f.get('department') || '').trim(), employment_type: f.get('employment_type'), description: String(f.get('description')).trim(), qualifications: String(f.get('qualifications') || '').trim(), closing_date: f.get('closing_date'), vacancies: Number(f.get('vacancies')), status: f.get('status') || 'Open', updated_at: new Date().toISOString() }; if (!fields.job_title || fields.job_title.length < 2)
        throw new Error('Enter a position title with at least 2 characters.'); if (!fields.department)
        throw new Error('Enter a department.'); if (!fields.description || fields.description.length < 5)
        throw new Error('Enter a job description with at least 5 characters.'); if (!fields.closing_date)
        throw new Error('Choose a closing date.'); const originalJob = id ? state.jobs.find(job => job.id === id) : null; const effectivePostingDate = originalJob?.posting_date || localDate(); if (fields.closing_date < effectivePostingDate)
        throw new Error('The closing date cannot be earlier than the posting date.'); if (fields.status === 'Open' && fields.closing_date < localDate())
        throw new Error('An open posting must have a closing date today or later.'); if (!Number.isInteger(fields.vacancies) || fields.vacancies < 1)
        throw new Error('Vacancies must be a whole number greater than zero.'); if (id) {
        const { error } = await state.client.from('job_postings').update(fields).eq('job_id', id);
        if (error)
            throw error;
    }
    else {
        const payload = { ...fields, job_code: `JOB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, posting_date: localDate() };
        const { error } = await state.client.from('job_postings').insert(payload);
        if (error)
            throw error;
    } toast(id ? 'Job posting updated.' : 'Job posting created.'); $('#recordDialog').close(); renderPage(); }
    async function openJob(id) { const j = state.jobs.find(x => x.id === id); openDialog(id ? 'Edit job posting' : 'New job posting', field('title', 'Position title', 'text', true, j?.title || '') + field('department', 'Department', 'text', true, j?.department || '') + field('employment_type', 'Employment type', 'select', true, j?.employment_type || 'Full-Time', ['Full-Time', 'Part-Time', 'Contract', 'Temporary']) + field('closing_date', 'Closing date', 'date', true, j?.closing_date || '') + field('vacancies', 'Number of vacancies', 'number', true, j?.vacancies ?? 1) + field('description', 'Job description', 'textarea', true, j?.description || '') + field('qualifications', 'Qualifications', 'textarea', false, j?.qualifications || '') + field('status', 'Status', 'select', true, j?.status || 'Open', ['Open', 'Closed']), f => saveJob(f, id), 'JOB POSTING'); }
    async function applyJob(id) { const j = state.jobs.find(x => x.id === id); if (!j)
        return; if (!state.profile.applicant_id)
        throw new Error('This account is not linked to an applicant record. Ask an administrator to set applicants.auth_user_id to your Supabase user ID.'); const { data: existing, error: checkError } = await state.client.from('applications').select('application_id').eq('job_id', id).eq('applicant_id', state.profile.applicant_id).maybeSingle(); if (checkError)
        throw checkError; if (existing) {
        toast('You have already applied for this position.');
        return;
    } openDialog('Apply for position', `<p class="muted">${esc(j.title)} · ${esc(j.department || '')}</p>${field('cover_letter', 'Cover letter (optional)', 'textarea', false, '')}`, async (f) => { const fd = new FormData(f), letter = String(fd.get('cover_letter') || '').trim(); const { error } = await state.client.from('applications').insert({ job_id: id, applicant_id: state.profile.applicant_id, cover_letter: letter, application_date: localDate() }); if (error)
        throw error; toast('Application submitted.'); $('#recordDialog').close(); state.page = 'my-applications'; renderPage(); }, 'APPLICATION'); }
    async function updateApplication(id, current) {
        const statuses = ['Submitted', 'Under Review', 'Screening', 'Interview', 'Rejected', 'Withdrawn'];
        if (current === 'Selected' || current === 'Hired') statuses.push(current);
        // Preserve a legacy status as the selected value instead of silently
        // replacing it with the first option when the dialog is opened.
        if (current && !statuses.includes(current)) statuses.push(current);
        openDialog('Update application status', field('status', 'Status', 'select', true, current, statuses), async (form) => {
            const nextStatus = String(new FormData(form).get('status') || '');
            if (nextStatus === 'Selected' && current !== 'Selected') {
                throw new Error('Use Select candidate after a qualified screening and passed completed interview.');
            }
            if (nextStatus === 'Hired' && current !== 'Hired') {
                throw new Error('Record a hiring decision in the Hiring module to mark an applicant as Hired.');
            }
            if (nextStatus === 'Screening') {
                const { data: screenings, error: screeningError } = await state.client.from('screenings').select('screening_id').eq('application_id', id).limit(1);
                if (screeningError) throw screeningError;
                if (!screenings?.length) throw new Error('Create a screening record before moving this application to Screening.');
            }
            if (nextStatus === 'Interview') {
                const { data: interviews, error: interviewError } = await state.client.from('interviews').select('interview_id').eq('application_id', id).limit(1);
                if (interviewError) throw interviewError;
                if (!interviews?.length) throw new Error('Schedule an interview before moving this application to Interview.');
            }
            const { error } = await state.client.from('applications').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('application_id', id);
            if (error) throw error;
            toast('Application status updated.');
            $('#recordDialog').close();
            await renderPage();
        }, 'APPLICATION');
    }
    const SCREENING_RUBRIC = [
        { key: 'education', name: 'Education', max: 20 },
        { key: 'experience', name: 'Work Experience', max: 25 },
        { key: 'technical', name: 'Technical Skills', max: 30 },
        { key: 'certifications', name: 'Certifications', max: 10 },
        { key: 'resume', name: 'Resume Quality', max: 15 }
    ];
    const INTERVIEW_RUBRIC = [
        { key: 'communication', name: 'Communication', max: 20 },
        { key: 'technical', name: 'Technical Knowledge', max: 30 },
        { key: 'problem_solving', name: 'Problem Solving', max: 20 },
        { key: 'teamwork', name: 'Teamwork', max: 15 },
        { key: 'professionalism', name: 'Professionalism', max: 15 }
    ];
    function automaticResultField(id, result) {
        return `<label>Result<input id="${id}" type="text" value="${esc(result)}" readonly aria-live="polite" title="Automatically calculated from the score"></label>`;
    }
    function interviewRubricFields() {
        return INTERVIEW_RUBRIC.map(criterion => `<label>${esc(criterion.name)} <span class="muted">(maximum ${criterion.max})</span><input type="number" name="interview_${criterion.key}" min="0" max="${criterion.max}" step="0.01" data-interview-score="${criterion.max}" inputmode="decimal" aria-label="${esc(criterion.name)} score, maximum ${criterion.max}"></label>`).join('');
    }
    function screeningRubricFields(criteriaScores = []) {
        const byName = new Map((Array.isArray(criteriaScores) ? criteriaScores : []).map(item => [String(item.criterion_name || '').toLowerCase(), item]));
        return SCREENING_RUBRIC.map(criterion => {
            const saved = byName.get(criterion.name.toLowerCase());
            const value = saved && Number.isFinite(Number(saved.score)) ? String(saved.score) : '';
            return `<label>${esc(criterion.name)} <span class="muted">(maximum ${criterion.max})</span><input type="number" name="criterion_${criterion.key}" min="0" max="${criterion.max}" step="0.01" value="${esc(value)}" data-screening-score="${criterion.max}" inputmode="decimal" aria-label="${esc(criterion.name)} score, maximum ${criterion.max}"></label>`;
        }).join('');
    }
    async function openScreening(id, appId, score = '', result = 'Pending', remarks = '', criteriaScores = []) {
        let apps = state.applications;
        if (!apps.length) {
            const { data, error } = await state.client.from('applications').select('application_id');
            if (error) throw error;
            const ids = (data || []).map(application => application.application_id);
            apps = await applicationContext(ids);
        }
        const choices = apps.map(application => ({
            value: application.id || application.application_id,
            label: `${application.rms_profiles?.full_name || 'Applicant'} — ${application.rms_job_postings?.title || 'Position'} — ${application.id || application.application_id}`
        }));
        if (!choices.length) throw new Error('Create an application before starting screening.');
        const currentRubric = Array.isArray(criteriaScores) ? criteriaScores : [];
        const hasSavedRubric = currentRubric.length > 0;
        const fields =
            field('application_id', 'Application', 'select', true, appId || choices[0].value, choices) +
            `<div class="screening-rubric"><div class="section-head"><h3>Screening criteria</h3><span class="micro">100 POINTS TOTAL</span></div><div class="form-grid">${screeningRubricFields(currentRubric)}</div><div class="rubric-total" id="screeningTotal"><span>Calculated total</span><strong>${hasSavedRubric ? `${esc(score || currentRubric.reduce((sum, item) => sum + Number(item.score || 0), 0))} / 100` : '— / 100'}</strong></div><p class="muted">Education 20 · Work Experience 25 · Technical Skills 30 · Certifications 10 · Resume Quality 15. If editing a legacy record without a saved breakdown, leave all five fields blank to preserve its existing total.</p></div>` +
            automaticResultField('screeningResult', automaticResult(score, SCREENING_PASS_SCORE, 'Qualified', 'Not Qualified')) +
            field('remarks', 'Remarks', 'textarea', false, remarks);
        openDialog(id ? 'Edit screening' : 'Add screening', fields, async (form) => {
            const formData = new FormData(form);
            const applicationId = String(formData.get('application_id') || '');
            const enteredScores = SCREENING_RUBRIC.map(criterion => {
                const raw = String(formData.get(`criterion_${criterion.key}`) ?? '').trim();
                return { criterion, raw, score: raw === '' ? null : Number(raw) };
            });
            const anyScore = enteredScores.some(item => item.raw !== '');
            const everyScore = enteredScores.every(item => item.raw !== '');
            let totalScore;
            let savedCriteria = [];
            if (!anyScore && id && score !== '') {
                totalScore = Number(score);
                savedCriteria = currentRubric;
            } else {
                if (!everyScore) throw new Error('Enter a score for all five screening criteria, or leave all five blank only when keeping a legacy total.');
                for (const item of enteredScores) {
                    if (!Number.isFinite(item.score) || item.score < 0 || item.score > item.criterion.max) {
                        throw new Error(`${item.criterion.name} must be between 0 and ${item.criterion.max}.`);
                    }
                }
                totalScore = Number(enteredScores.reduce((sum, item) => sum + item.score, 0).toFixed(2));
                savedCriteria = enteredScores.map(item => ({ criterion_name: item.criterion.name, score: Number(item.score.toFixed(2)), max_score: item.criterion.max }));
            }
            const selectedResult = automaticResult(totalScore, SCREENING_PASS_SCORE, 'Qualified', 'Not Qualified');
            const payload = {
                application_id: applicationId,
                score: totalScore,
                criteria_scores: savedCriteria,
                result: selectedResult,
                remarks: String(formData.get('remarks') || '').trim() || null
            };
            const response = id
                ? await state.client.from('screenings').update(payload).eq('screening_id', id)
                : await state.client.from('screenings').insert({ ...payload, screening_date: localDate(), screened_by: state.user.id });
            if (response.error) throw response.error;
            const nextStatus = payload.result === 'Qualified' ? 'Screening' : payload.result === 'Not Qualified' ? 'Rejected' : 'Submitted';
            const { error: applicationError } = await state.client.from('applications').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('application_id', applicationId);
            if (applicationError) console.warn('Screening saved, but application status was not synchronized:', applicationError.message);
            toast(`Screening saved with a total score of ${totalScore} / 100.`);
            $('#recordDialog').close();
            await renderPage();
        }, 'SCREENING');
        $('#dialogFields').dataset.screeningForm = 'true';
    }
    async function openInterview(id, appId, scheduled = '', score = '', result = 'Pending', status = 'Scheduled', remarks = '', currentInterviewer = '') {
        const apps = await applicationContext();
        const choices = apps.map(a => ({
            value: a.id || a.application_id,
            label: [a.rms_profiles?.full_name || 'Applicant', a.rms_job_postings?.title || 'Position', a.id || a.application_id].join(' - ')
        }));
        if (!choices.length) throw new Error('Create an application before scheduling an interview.');

        let interviewerField = '';
        if (state.profile.role !== 'Interviewer') {
            const { data: people, error: peopleError } = await state.client.from('users').select('username').eq('role', 'Interviewer').eq('status', 'Active').order('username');
            if (peopleError) throw peopleError;
            const options = (people || []).map(p => ({ value: p.username, label: p.username }));
            interviewerField = field('interviewer_id', 'Assign interviewer', 'select', true, currentInterviewer || options[0]?.value || '', options);
        }

        const scheduledDate = scheduled ? String(scheduled).slice(0, 10) : '';
        const scheduledTime = scheduled ? String(scheduled).slice(11, 16) : '';
        const savedScore = score === '' || score == null ? null : Number(score);
        const fields = field('application_id', 'Applicant / position', 'select', true, appId || choices[0].value, choices) +
            interviewerField +
            field('interview_date', 'Date', 'date', true, scheduledDate) +
            field('interview_time', 'Time', 'time', true, scheduledTime) +
            '<div class="interview-rubric"><div class="section-head"><h3>Interview evaluation</h3><span class="micro">100 POINTS TOTAL</span></div><div class="form-grid">' + interviewRubricFields() + '</div><div class="rubric-total" id="interviewTotal"><span>Calculated total</span><strong>' + (savedScore == null ? '— / 100' : esc(savedScore) + ' / 100') + '</strong></div><p class="muted">Enter all five criteria to grade the interview. The result is automatic at ' + INTERVIEW_PASS_SCORE + ' points or above. Leave the scores blank when only scheduling.</p></div>' +
            automaticResultField('interviewResult', automaticResult(savedScore, INTERVIEW_PASS_SCORE, 'Passed', 'Failed')) +
            field('status', 'Status', 'select', true, status, ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled']) +
            field('remarks', 'Remarks', 'textarea', false, remarks);

        openDialog(id ? 'Edit interview' : 'Schedule interview', fields, async (form) => {
            const data = new FormData(form);
            const interviewDate = String(data.get('interview_date') || '');
            const interviewTime = String(data.get('interview_time') || '');
            const applicationId = String(data.get('application_id') || '');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(interviewDate) || !/^\d{2}:\d{2}$/.test(interviewTime)) {
                throw new Error('Choose a valid interview date and time.');
            }

            const enteredScores = INTERVIEW_RUBRIC.map(criterion => {
                const raw = String(data.get('interview_' + criterion.key) ?? '').trim();
                return { criterion, raw, score: raw === '' ? null : Number(raw) };
            });
            const anyScore = enteredScores.some(item => item.raw !== '');
            const everyScore = enteredScores.every(item => item.raw !== '');
            let totalScore = savedScore;
            if (anyScore && !everyScore) {
                throw new Error('Enter scores for all five interview criteria, or leave all five blank when only scheduling.');
            }
            if (everyScore) {
                for (const item of enteredScores) {
                    if (!Number.isFinite(item.score) || item.score < 0 || item.score > item.criterion.max) {
                        throw new Error(item.criterion.name + ' must be between 0 and ' + item.criterion.max + '.');
                    }
                }
                totalScore = Number(enteredScores.reduce((sum, item) => sum + item.score, 0).toFixed(2));
            }
            const interviewResult = automaticResult(totalScore, INTERVIEW_PASS_SCORE, 'Passed', 'Failed');

            if (!id) {
                const { data: screen, error: screenError } = await state.client.from('screenings').select('result,created_at').eq('application_id', applicationId).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (screenError) throw screenError;
                if (screen?.result !== 'Qualified') {
                    throw new Error('Only applicants who passed screening can be scheduled for an interview.');
                }
                const { data: existing, error: existingError } = await state.client.from('interviews').select('interview_id').eq('application_id', applicationId).eq('status', 'Scheduled').limit(1);
                if (existingError) throw existingError;
                if (existing?.length) {
                    throw new Error('This application already has a scheduled interview. Edit or cancel that interview first.');
                }
            }

            const payload = {
                application_id: applicationId,
                interview_date: interviewDate,
                interview_time: interviewTime,
                interviewer: state.profile.role === 'Interviewer' ? state.profile.full_name : (data.get('interviewer_id') || state.profile.full_name),
                score: totalScore,
                result: interviewResult === 'Pending' ? null : interviewResult,
                status: data.get('status'),
                remarks: String(data.get('remarks') || '').trim() || null,
                updated_at: new Date().toISOString()
            };
            const response = id
                ? await state.client.from('interviews').update(payload).eq('interview_id', id)
                : await state.client.from('interviews').insert({ ...payload, created_at: new Date().toISOString() });
            if (response.error) throw response.error;

            if (state.profile.role !== 'Interviewer' && payload.result === 'Passed' && payload.status === 'Completed') {
                const { error } = await state.client.from('applications').update({ status: 'Interview', updated_at: new Date().toISOString() }).eq('application_id', applicationId);
                if (error) console.warn('Interview saved, but application status was not synchronized:', error.message);
            }
            if (state.profile.role !== 'Interviewer' && payload.result === 'Failed' && payload.status === 'Completed') {
                const { error } = await state.client.from('applications').update({ status: 'Rejected', updated_at: new Date().toISOString() }).eq('application_id', applicationId);
                if (error) console.warn('Interview saved, but application status was not synchronized:', error.message);
            }

            toast(totalScore == null ? 'Interview saved.' : 'Interview saved with a score of ' + totalScore + ' / 100 (' + interviewResult + ').');
            $('#recordDialog').close();
            renderPage();
        }, 'INTERVIEW');
    }
    async function selectCandidate(applicationId) {
        const { data: screen, error: screenError } = await state.client.from('screenings').select('result,created_at').eq('application_id', applicationId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (screenError)
            throw screenError;
        if (screen?.result !== 'Qualified')
            throw new Error('Only applicants with a Qualified screening result can be selected.');
        const { data: interview, error: interviewError } = await state.client.from('interviews').select('interview_id').eq('application_id', applicationId).eq('result', 'Passed').eq('status', 'Completed').limit(1);
        if (interviewError)
            throw interviewError;
        if (!interview?.length)
            throw new Error('The applicant must pass a completed interview before selection.');
        const { error } = await state.client.from('applications').update({ status: 'Selected', updated_at: new Date().toISOString() }).eq('application_id', applicationId);
        if (error)
            throw error;
        toast('Applicant marked as Selected.');
        renderPage();
    }
    async function openHiring() { const { data: apps, error } = await state.client.from('applications').select('application_id,job_id,status').eq('status', 'Selected'); if (error)
        throw error; if (!apps?.length)
        throw new Error('No selected applicants are ready for a hiring decision. Select a qualified candidate after a passed completed interview.'); const jobIds = [...new Set((apps || []).map(a => a.job_id).filter(Boolean))], jobsResult = jobIds.length ? await state.client.from('job_postings').select('job_id,job_title').in('job_id', jobIds) : { data: [], error: null }; if (jobsResult.error)
        throw jobsResult.error; const jobs = new Map((jobsResult.data || []).map(j => [j.job_id, j.job_title])), choices = (apps || []).map(a => ({ value: a.application_id, label: `${a.application_id} — ${jobs.get(a.job_id) || 'Position'}` })); openDialog('Record hiring decision', field('application_id', 'Application', 'select', true, choices[0]?.value || '', choices) + field('decision', 'Decision', 'select', true, 'Hired', ['Hired', 'Declined', 'Rejected', 'On Hold']) + field('salary_offer', 'Salary offer (PHP)', 'number', false, '') + field('start_date', 'Start date', 'date', false, ''), async (f) => { const d = new FormData(f), applicationId = d.get('application_id'), decision = d.get('decision'), jobTitle = jobs.get((apps || []).find(a => a.application_id === applicationId)?.job_id) || 'Position'; if (d.get('salary_offer') !== '' && (!Number.isFinite(Number(d.get('salary_offer'))) || Number(d.get('salary_offer')) < 0))
        throw new Error('Salary offer must be zero or greater.'); const { data: existingHiring, error: existingHiringError } = await state.client.from('hiring').select('hiring_id').eq('application_id', applicationId).limit(1); if (existingHiringError)
        throw existingHiringError; if (existingHiring?.length)
        throw new Error('A hiring decision already exists for this application.'); if (decision === 'Hired') {
        const { data: passed, error: passedError } = await state.client.from('interviews').select('interview_id').eq('application_id', applicationId).eq('result', 'Passed').eq('status', 'Completed').limit(1);
        if (passedError)
            throw passedError;
        if (!passed?.length)
            throw new Error('A candidate must pass a completed interview before being marked as hired.');
    } const p = { application_id: applicationId, position: jobTitle, status: decision, hiring_date: localDate(), salary_offer: d.get('salary_offer') === '' ? null : Number(d.get('salary_offer')), start_date: d.get('start_date') || null, created_at: new Date().toISOString() }; const r = await state.client.from('hiring').insert(p); if (r.error)
        throw r.error; const appStatus = decision === 'Hired' ? 'Hired' : (decision === 'Declined' || decision === 'Rejected') ? 'Rejected' : 'Under Review'; const { error: appError } = await state.client.from('applications').update({ status: appStatus, updated_at: new Date().toISOString() }).eq('application_id', applicationId); if (appError)
        console.warn('Application status was not synchronized:', appError.message); toast('Hiring decision saved.'); $('#recordDialog').close(); renderPage(); }, 'HIRING'); }
    function openUser(id, role, status, name) { if (id === state.user.id) {
        toast('For safety, you cannot change your own role or deactivate your own account.');
        return;
    } openDialog('Manage user', `<p class="muted">${esc(name || 'User')}<br>${esc(id)}</p>${field('role', 'Role', 'select', true, role, roles)}${field('status', 'Account status', 'select', true, status, ['Active', 'Inactive'])}`, async (f) => { const d = new FormData(f); const { error } = await state.client.from('users').update({ role: d.get('role'), status: d.get('status') }).eq('user_id', id); if (error)
        throw error; toast('User access updated.'); $('#recordDialog').close(); renderPage(); }, 'ACCESS CONTROL'); }
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
    async function exportApplications() { const { data, error } = await state.client.from('applications').select('application_id,job_id,applicant_id,status,created_at,application_date'); if (error)
        throw error; const csv = [['application_id', 'job_id', 'applicant_id', 'status', 'created_at'], ...(data || []).map(r => [r.application_id, r.job_id, r.applicant_id, r.status, r.created_at || r.application_date])].map(row => row.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'applications.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('CSV export created. Handle applicant data securely.'); }
    document.addEventListener('click', async (e) => { const navLink = e.target.closest('[data-page]'); if (navLink) {
        e.preventDefault();
        const next = navLink.dataset.page;
        if (!(access[state.profile?.role] || []).includes(next))
            return toast('Your role cannot access that page.');
        state.page = next;
        history.replaceState(null, '', `#${next}`);
        $('#sidebar').classList.remove('open');
        $('#mobileOverlay').classList.remove('show');
        $('#menuButton').setAttribute('aria-expanded', 'false');
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
            if (totalElement) totalElement.textContent = entered === inputs.length ? `${total.toFixed(2).replace(/\\.00$/, '')} / 100` : entered ? `${total.toFixed(2).replace(/\\.00$/, '')} / 100 (partial)` : '— / 100';
            const resultElement = $('#interviewResult');
            if (resultElement) resultElement.value = entered === inputs.length ? automaticResult(total, INTERVIEW_PASS_SCORE, 'Passed', 'Failed') : 'Pending';
        }
        if (e.target.id === 'applicantSearch') {
        const term = e.target.value.toLowerCase();
        const records = state.applicants.filter(a => `${a.applicant_no || ''} ${a.first_name || ''} ${a.last_name || ''} ${a.email || ''}`.toLowerCase().includes(term));
        const rows = records.map(a => `<tr><td><strong>${esc([a.first_name, a.last_name].filter(Boolean).join(' ') || 'Applicant')}</strong><span class="subcell">${esc(a.applicant_no || 'No applicant number')}</span></td><td>${esc(a.email || '—')}<span class="subcell">${esc(a.contact_no || '')}</span></td><td>${esc(a.education || '—')}</td><td><span class="pill">${esc(a.status || 'Active')}</span></td><td><button class="action-link" data-action="edit-applicant" data-id="${esc(a.applicant_id)}">Edit profile</button></td></tr>`);
        $('#applicantTable').innerHTML = table('', ['APPLICANT', 'CONTACT', 'EDUCATION', 'STATUS', 'ACTION'], rows, 'No matching applicants', 'Try a different search.');
    } if (e.target.id === 'jobSearch') {
        const term = e.target.value.toLowerCase();
        const jobs = state.jobs.filter(j => `${j.title} ${j.department || ''} ${j.employment_type || ''} ${j.description || ''} ${j.qualifications || ''}`.toLowerCase().includes(term));
        $('#jobTable').innerHTML = table('', ['POSITION', 'TYPE', 'DEADLINE', 'STATUS', 'ACTION'], jobRows(jobs, state.profile.role === 'Applicant'), 'No matching positions', 'Try a different search.');
    } });
    $('#loginForm').addEventListener('submit', async (e) => { e.preventDefault(); const form = e.currentTarget, b = $('button[type="submit"]', form), originalButton = b.innerHTML; b.disabled = true; form.setAttribute('aria-busy', 'true'); b.textContent = 'Signing in…'; message($('#authMessage'), 'Signing in…'); let timer; try {
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
    $('#signOutButton').addEventListener('click', async () => { if (state.isDemo) { state.isDemo = false; state.client = state.realClient; state.user = null; state.profile = null; state.page = 'dashboard'; history.replaceState(null, '', location.pathname); showAuth('login', 'You exited the interactive demo. Sign in with a configured account or reopen the demo.'); return; } const { error } = await state.client.auth.signOut(); if (error)
        toast(friendly(error));
    else {
        state.user = null;
        state.profile = null;
        showAuth('login', 'You have signed out.');
    } });
    $('#menuButton').addEventListener('click', () => { const open = $('#sidebar').classList.toggle('open'); $('#mobileOverlay').classList.toggle('show', open); $('#menuButton').setAttribute('aria-expanded', String(open)); });
    $('#mobileOverlay').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#mobileOverlay').classList.remove('show'); $('#menuButton').setAttribute('aria-expanded', 'false'); });
    $('#themeButton').addEventListener('click', () => { const root = document.documentElement; const current = root.dataset.theme; const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light'; root.dataset.theme = next; localStorage.setItem('rms-theme', next); toast(`Theme: ${next}`); });
    $('#demoModeButton').addEventListener('click', () => enterDemo('Administrator'));
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
        document.documentElement.dataset.theme = 'system'; if (!configured()) {
        showAuth('login', 'Setup required: edit js/config.js and add your Supabase project URL and publishable/anon key.');
        document.querySelectorAll('#authScreen input,#loginForm button,#registerForm button,#resetForm button,#updatePasswordForm button,.auth-links button').forEach(x => x.disabled = true);
        return;
    } if (!window.supabase?.createClient) {
        showAuth('login', 'Supabase client failed to load. Check your connection and reload.');
        return;
    } state.client = window.supabase.createClient(window.RMS_CONFIG.SUPABASE_URL, window.RMS_CONFIG.SUPABASE_ANON_KEY, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }, global: { fetch: authFetch } }); state.realClient = state.client; const hash = location.hash.slice(1); if (new URLSearchParams(location.search).get('mode') === 'reset' || hash.includes('type=recovery')) {
        showAuth('update', 'Enter a new password for your account.');
    }
    else if (access[state.profile?.role]?.includes(hash))
        state.page = hash; state.client.auth.onAuthStateChange((event, session) => { if ((new URLSearchParams(location.search).get('mode') === 'reset' || location.hash.includes('type=recovery')) && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
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
    boot().catch(e => { console.error(e); showAuth('login', friendly(e)); });
})();
