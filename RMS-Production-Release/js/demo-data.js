window.RMSDemoTools = function (dependencies) {
    const { state, roles, localDate, showApp, toast } = dependencies;
    const DEMO_DB_KEY = 'rms-functional-demo-db-v2';
    const DEMO_SESSION_KEY = 'rms-functional-demo-session-v1';
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
        const requestedPage = document.body.dataset.page || 'dashboard';
        state.page = (access[selectedRole] || []).includes(requestedPage) ? requestedPage : 'dashboard';
        showApp();
        toast('Interactive demo opened. Changes stay in this browser.');
    }
    function resetDemo() {
        if (!window.confirm('Reset all local demo records to the original sample data? This does not affect Supabase.')) return;
        localStorage.removeItem(DEMO_DB_KEY);
        enterDemo(state.profile?.role || 'Administrator');
        toast('Demo data reset.');
    }

    return { sessionKey: DEMO_SESSION_KEY, enterDemo, resetDemo };
};
