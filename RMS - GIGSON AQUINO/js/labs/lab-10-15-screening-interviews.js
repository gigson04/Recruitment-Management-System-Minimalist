window.RMSEvaluationActions = function (dependencies) {
    const { state, $, esc, field, openDialog, toast, localDate, applicationContext, renderPage, SCREENING_PASS_SCORE, INTERVIEW_PASS_SCORE, automaticResult } = dependencies;

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
            const nextStatus = payload.result === 'Qualified' ? 'Qualified' : payload.result === 'Not Qualified' ? 'Rejected' : 'Under Screening';
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
        const fields = (id ? '<div class="notice"><strong>After the interview</strong><p>Enter the evaluation and mark the interview Completed after the scheduled interview has been conducted.</p></div>' : '<div class="notice"><strong>Interview sequence</strong><p>Save this schedule first. Conduct the interview at the scheduled time, then edit this record to enter the evaluation and mark it Completed.</p></div>') +
            field('application_id', 'Applicant / position', 'select', true, appId || choices[0].value, choices) +
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
            if (!id && data.get('status') !== 'Scheduled') throw new Error('Schedule the interview first. Conduct it at the scheduled time, then edit the record to evaluate it.');
            const { data: screen, error: screenError } = await state.client.from('screenings').select('result,created_at').eq('application_id', applicationId).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (screenError) throw screenError;
            if (screen?.result !== 'Qualified') throw new Error('Only applicants who passed screening can be scheduled for an interview.');
            let conflictQuery = state.client.from('interviews').select('interview_id').eq('application_id', applicationId).in('status', ['Scheduled', 'Rescheduled']);
            if (id) conflictQuery = conflictQuery.neq('interview_id', id);
            const { data: existing, error: existingError } = await conflictQuery.limit(1);
            if (existingError) throw existingError;
            if (existing?.length && ['Scheduled', 'Rescheduled'].includes(String(data.get('status')))) {
                throw new Error('This application already has a scheduled interview. Edit or cancel that interview first.');
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

            if (state.profile.role !== 'Interviewer' && payload.status === 'Scheduled' && !id) {
                const { error } = await state.client.from('applications').update({ status: 'For Interview', updated_at: new Date().toISOString() }).eq('application_id', applicationId);
                if (error) console.warn('Interview saved, but application status was not synchronized:', error.message);
            }
            if (state.profile.role !== 'Interviewer' && payload.result === 'Passed' && payload.status === 'Completed') {
                const { error } = await state.client.from('applications').update({ status: 'Interviewed', updated_at: new Date().toISOString() }).eq('application_id', applicationId);
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

    return { openScreening, openInterview };
};
