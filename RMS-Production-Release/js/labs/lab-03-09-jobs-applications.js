window.RMSJobApplicationActions = function (dependencies) {
    const { state, $, esc, field, openDialog, toast, localDate, fetchJobs, applicationContext, renderPage } = dependencies;

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

    async function applyJob(id) {
        const job = state.jobs.find(item => item.id === id);
        if (!job) throw new Error('This job posting is no longer available. Refresh the page and try again.');
        if (!state.profile.applicant_id) {
            throw new Error('This account is not linked to an applicant record. Ask an administrator to set applicants.auth_user_id to your Supabase user ID.');
        }

        const { data: applicant, error: applicantError } = await state.client
            .from('applicants')
            .select('first_name,last_name,email,contact_no,address,education,experience,skills,status')
            .eq('applicant_id', state.profile.applicant_id)
            .maybeSingle();
        if (applicantError) throw applicantError;
        if (!applicant) throw new Error('Your applicant profile could not be found. Contact the recruitment administrator.');
        if (String(applicant.status || '').toLowerCase() !== 'active') {
            throw new Error('Your applicant profile is inactive. Contact the recruitment administrator.');
        }
        const requiredDetails = ['first_name', 'last_name', 'email', 'contact_no', 'address', 'education', 'experience', 'skills'];
        if (requiredDetails.some(key => !String(applicant[key] || '').trim())) {
            throw new Error('Complete your applicant profile before applying for a position.');
        }

        const { data: currentJob, error: jobError } = await state.client
            .from('job_postings')
            .select('job_id,job_title,department,status,closing_date')
            .eq('job_id', id)
            .maybeSingle();
        if (jobError) throw jobError;
        if (!currentJob || currentJob.status !== 'Open') {
            throw new Error('This position is no longer open for applications.');
        }
        if (currentJob.closing_date && currentJob.closing_date < localDate()) {
            throw new Error('The application deadline for this position has passed.');
        }

        const { data: existing, error: checkError } = await state.client
            .from('applications')
            .select('application_id')
            .eq('job_id', id)
            .eq('applicant_id', state.profile.applicant_id)
            .maybeSingle();
        if (checkError) throw checkError;
        if (existing) {
            toast('You have already applied for this position.');
            return;
        }

        openDialog('Apply for position', `<p class="muted">${esc(currentJob.job_title)} · ${esc(currentJob.department || '')}</p><div class="notice"><strong>Application validation passed</strong><p>Your profile is complete, this posting is open and before its deadline, and no duplicate application was found.</p></div>${field('cover_letter', 'Cover letter (optional)', 'textarea', false, '')}`, async form => {
            const formData = new FormData(form);
            const coverLetter = String(formData.get('cover_letter') || '').trim();
            const { error } = await state.client.from('applications').insert({
                job_id: id,
                applicant_id: state.profile.applicant_id,
                cover_letter: coverLetter,
                application_date: localDate()
            });
            if (error) throw error;

            toast('Application submitted.');
            $('#recordDialog').close();
            state.page = 'my-applications';
            await renderPage();
        }, 'APPLICATION');
    }

    async function updateApplication(id, current) {
        if (['Hired', 'Rejected', 'Withdrawn'].includes(current)) {
            throw new Error('This application is closed and its status cannot be changed here.');
        }
        // Recruitment stage statuses are set only by their corresponding action.
        const statuses = [...new Set([current, 'Rejected', 'Withdrawn'].filter(Boolean))];
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
            const { error } = await state.client.from('applications').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('application_id', id);
            if (error) throw error;
            toast('Application status updated.');
            $('#recordDialog').close();
            await renderPage();
        }, 'APPLICATION');
    }

    return { openJob, applyJob, updateApplication };
};
