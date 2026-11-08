window.RMSHiringActions = function (dependencies) {
    const { state, $, esc, roles, field, openDialog, toast, localDate, applicationContext, renderPage } = dependencies;

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
        throw r.error; const appStatus = decision === 'Hired' ? 'Hired' : (decision === 'Declined' || decision === 'Rejected') ? 'Rejected' : 'Selected'; const { error: appError } = await state.client.from('applications').update({ status: appStatus, updated_at: new Date().toISOString() }).eq('application_id', applicationId); if (appError)
        console.warn('Application status was not synchronized:', appError.message); toast('Hiring decision saved.'); $('#recordDialog').close(); renderPage(); }, 'HIRING'); }

    function openUser(id, role, status, name) { if (id === state.user.id) {
        toast('For safety, you cannot change your own role or deactivate your own account.');
        return;
    } openDialog('Manage user', `<p class="muted">${esc(name || 'User')}<br>${esc(id)}</p>${field('role', 'Role', 'select', true, role, roles)}${field('status', 'Account status', 'select', true, status, ['Active', 'Inactive'])}`, async (f) => { const d = new FormData(f); const { error } = await state.client.from('users').update({ role: d.get('role'), status: d.get('status') }).eq('user_id', id); if (error)
        throw error; toast('User access updated.'); $('#recordDialog').close(); renderPage(); }, 'ACCESS CONTROL'); }

    return { selectCandidate, openHiring, openUser };
};
