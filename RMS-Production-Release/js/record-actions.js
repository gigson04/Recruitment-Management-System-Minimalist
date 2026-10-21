window.RMSRecordActions = function (dependencies) {
    const { state, $, esc, roles, field, openDialog, toast, localDate, fetchJobs,
        applicationContext, renderPage, SCREENING_PASS_SCORE, INTERVIEW_PASS_SCORE,
        automaticResult } = dependencies;
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

        openDialog('Apply for position', `<p class="muted">${esc(currentJob.job_title)} · ${esc(currentJob.department || '')}</p>${field('cover_letter', 'Cover letter (optional)', 'textarea', false, '')}`, async form => {
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
            if (['Scheduled', 'Rescheduled'].includes(String(data.get('status'))) && interviewDate < localDate()) {
                throw new Error('A scheduled interview must be set for today or a future date.');
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
            if (data.get('status') === 'Completed' && totalScore == null) {
                throw new Error('Enter scores for all five interview criteria before marking the interview as completed.');
            }

            if (!id) {
                const { data: screen, error: screenError } = await state.client.from('screenings').select('result,created_at').eq('application_id', applicationId).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (screenError) throw screenError;
                if (screen?.result !== 'Qualified') {
                    throw new Error('Only applicants who passed screening can be scheduled for an interview.');
                }
                const { data: existing, error: existingError } = await state.client.from('interviews').select('interview_id').eq('application_id', applicationId).in('status', ['Scheduled', 'Rescheduled']).limit(1);
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
    return {
        openJob, applyJob, updateApplication, openScreening, openInterview,
        selectCandidate, openHiring, openUser
    };
};
