-- Integrated Recruitment Management System upgrade (Supabase / PostgreSQL)
-- Apply in the Supabase SQL Editor after sql/schema.sql and before enabling
-- applicant self-registration. This migration is additive and safe to rerun.

begin;

-- Applicant registration/profile fields used by the portal.
alter table public.applicants add column if not exists skills text;
alter table public.applicants add column if not exists auth_user_id uuid
  references auth.users(id) on delete set null;
create unique index if not exists applicants_auth_user_id_uidx
  on public.applicants(auth_user_id) where auth_user_id is not null;
create index if not exists applicants_email_lower_idx
  on public.applicants(lower(email));
create or replace function public.prevent_duplicate_applicant_email()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.email := lower(trim(new.email));
  if tg_op = 'INSERT' or lower(trim(old.email)) is distinct from new.email then
    perform pg_advisory_xact_lock(hashtextextended(new.email, 0));
    if exists (select 1 from public.applicants a
      where lower(trim(a.email)) = new.email and a.applicant_id <> new.applicant_id) then
      raise exception 'An applicant with this email address already exists.' using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_prevent_duplicate_applicant_email on public.applicants;
drop trigger if exists trg_prevent_duplicate_applicant_email_insert on public.applicants;
create trigger trg_prevent_duplicate_applicant_email_insert before insert on public.applicants
for each row execute function public.prevent_duplicate_applicant_email();
create trigger trg_prevent_duplicate_applicant_email before update of email on public.applicants
for each row execute function public.prevent_duplicate_applicant_email();

-- Roles consumed by the existing UI and the applicant signup trigger.
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check
  (role in ('Administrator','HR Staff','HR Officer','Recruiter','Interviewer','Hiring Manager','Management','Applicant'));

-- Expand the application lifecycle to values already written by the UI.
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check check
  (status in ('Submitted','Under Review','Under Screening','Screening','Qualified','Not Qualified','For Interview','Interview','Interviewed','Selected','Selected for Hiring','Hired','Rejected','Withdrawn',
              'QUALIFIED','SELECTED','SELECTED FOR HIRING','HIRED','DECLINED','REJECTED','ON HOLD'));

-- Normalize legacy selection/hiring labels so the current workflow recognizes
-- existing candidates instead of leaving them out of the Hiring queue.
update public.applications
set status = case
  when status in ('Selected for Hiring', 'SELECTED FOR HIRING', 'SELECTED') then 'Selected'
  when status = 'HIRED' then 'Hired'
  when status = 'QUALIFIED' then 'Qualified'
  when status = 'REJECTED' then 'Rejected'
  else status
end
where status in ('Selected for Hiring', 'SELECTED FOR HIRING', 'SELECTED', 'HIRED', 'QUALIFIED', 'REJECTED');

-- Evaluation / schedule columns queried by current modules.
alter table public.screenings add column if not exists criteria_scores jsonb not null default '[]'::jsonb;
alter table public.interviews add column if not exists status text not null default 'Scheduled';
alter table public.interviews add column if not exists venue text;
alter table public.interviews add column if not exists updated_at timestamptz default now();
alter table public.interviews add column if not exists communication_score integer;
alter table public.interviews add column if not exists technical_knowledge_score integer;
alter table public.interviews add column if not exists problem_solving_score integer;
alter table public.interviews add column if not exists teamwork_score integer;
alter table public.interviews add column if not exists professionalism_score integer;
alter table public.interviews add column if not exists evaluated_by text;
alter table public.interviews add column if not exists evaluated_at timestamptz;
alter table public.interviews drop constraint if exists interviews_status_check;
alter table public.interviews add constraint interviews_status_check
  check (status in ('Scheduled','Rescheduled','Completed','Cancelled'));
-- Existing pass/fail results were completed evaluations before status existed.
update public.interviews set status = 'Completed' where result in ('Passed','Failed') and status = 'Scheduled';
alter table public.interviews drop constraint if exists interviews_score_range_check;
alter table public.interviews add constraint interviews_score_range_check check (
  (communication_score is null or communication_score between 0 and 100) and
  (technical_knowledge_score is null or technical_knowledge_score between 0 and 100) and
  (problem_solving_score is null or problem_solving_score between 0 and 100) and
  (teamwork_score is null or teamwork_score between 0 and 100) and
  (professionalism_score is null or professionalism_score between 0 and 100)
);

alter table public.hiring add column if not exists updated_at timestamptz default now();
alter table public.hiring drop constraint if exists hiring_status_check;
alter table public.hiring add constraint hiring_status_check
  check (status in ('Hired','Declined','Rejected','On Hold'));

-- Configurable screening rubric already used by the screening UI.
create table if not exists public.screening_criteria (
  criterion_id bigint generated by default as identity primary key,
  criterion_name text not null,
  description text,
  weight numeric(5,2) not null default 0 check (weight between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.screening_criteria(criterion_name, description, weight, is_active)
select v.criterion_name, v.description, v.weight, true
from (values
  ('Education', 'Relevance of educational background to the role.', 20.00::numeric),
  ('Work Experience', 'Relevance and depth of prior work experience.', 25.00::numeric),
  ('Technical Skills', 'Evidence of required technical and job-related skills.', 30.00::numeric),
  ('Certifications', 'Relevant professional or technical certifications.', 10.00::numeric),
  ('Resume Quality', 'Completeness, clarity, and relevance of the resume.', 15.00::numeric)
) as v(criterion_name, description, weight)
where not exists (select 1 from public.screening_criteria sc
  where lower(trim(sc.criterion_name)) = lower(trim(v.criterion_name)));

-- Employee conversion retains the application and applicant foreign keys.
create table if not exists public.employees (
  employee_id uuid primary key default gen_random_uuid(),
  employee_number text not null unique,
  application_id uuid not null unique references public.applications(application_id) on delete restrict,
  applicant_id uuid not null references public.applicants(applicant_id) on delete restrict,
  first_name text not null,
  last_name text not null,
  email text,
  contact_no text,
  address text,
  position text not null,
  department text,
  start_date date not null,
  employment_status text not null,
  hired_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auditable application stage changes, including actor and timestamp.
create table if not exists public.application_status_history (
  history_id bigint generated by default as identity primary key,
  application_id uuid not null references public.applications(application_id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists application_status_history_app_idx
  on public.application_status_history(application_id, changed_at desc);
-- Existing records receive a baseline event. Prior transitions cannot be
-- reconstructed; all changes after this migration are captured by the trigger.
insert into public.application_status_history(application_id, old_status, new_status, changed_by, changed_at)
select a.application_id, null, a.status, null, coalesce(a.created_at, now())
from public.applications a
where not exists (select 1 from public.application_status_history h
  where h.application_id = a.application_id);

create or replace function public.log_application_status_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history(application_id, old_status, new_status, changed_by)
    values (new.application_id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.application_status_history(application_id, old_status, new_status, changed_by)
    values (new.application_id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.log_application_status_change() from public;
drop trigger if exists trg_application_status_history on public.applications;
drop trigger if exists trg_application_status_history_insert on public.applications;
create trigger trg_application_status_history_insert after insert on public.applications
for each row execute function public.log_application_status_change();
create trigger trg_application_status_history after update of status on public.applications
for each row execute function public.log_application_status_change();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_interviews_updated_at on public.interviews;
create trigger trg_interviews_updated_at before update on public.interviews
for each row execute function public.set_updated_at();
drop trigger if exists trg_hiring_updated_at on public.hiring;
create trigger trg_hiring_updated_at before update on public.hiring
for each row execute function public.set_updated_at();
drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at before update on public.employees
for each row execute function public.set_updated_at();
drop trigger if exists trg_screening_criteria_updated_at on public.screening_criteria;
create trigger trg_screening_criteria_updated_at before update on public.screening_criteria
for each row execute function public.set_updated_at();

-- Remove the permissive policies in older lab SQL and enforce module roles.
alter table public.screening_criteria enable row level security;
alter table public.employees enable row level security;
alter table public.application_status_history enable row level security;

drop policy if exists "Authenticated users can view screening criteria" on public.screening_criteria;
drop policy if exists "Authenticated users can insert screening criteria" on public.screening_criteria;
drop policy if exists "Authenticated users can update screening criteria" on public.screening_criteria;
drop policy if exists "Authenticated users can delete screening criteria" on public.screening_criteria;
drop policy if exists "HR can manage screening criteria" on public.screening_criteria;
drop policy if exists "Authenticated users can read screening criteria" on public.screening_criteria;
create policy "Authenticated users can read screening criteria" on public.screening_criteria
  for select to authenticated using (true);
create policy "HR can manage screening criteria" on public.screening_criteria
  for all to authenticated using (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter'))
  with check (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter'));

drop policy if exists "Authenticated users can view employees" on public.employees;
drop policy if exists "Authenticated users can create employees" on public.employees;
drop policy if exists "Authenticated users can update employees" on public.employees;
drop policy if exists "HR can read employees" on public.employees;
drop policy if exists "HR can manage employees" on public.employees;
create policy "HR can read employees" on public.employees for select to authenticated
  using (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Hiring Manager','Management'));
create policy "HR can manage employees" on public.employees for all to authenticated
  using (public.current_user_role() in ('Administrator','HR Staff'))
  with check (public.current_user_role() in ('Administrator','HR Staff'));

drop policy if exists "Authenticated users can read application status history" on public.application_status_history;
create policy "Authenticated users can read application status history" on public.application_status_history
  for select to authenticated using (
    public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter','Interviewer','Hiring Manager','Management')
    or exists (select 1 from public.applications ap join public.applicants a using (applicant_id)
      where ap.application_id = application_status_history.application_id and a.auth_user_id = auth.uid())
  );
-- Only staff may write history directly. The trigger records submissions and
-- status changes using its protected definer execution context.
drop policy if exists "Application stage writers can record history" on public.application_status_history;
create policy "Application stage writers can record history" on public.application_status_history
  for insert to authenticated with check (
    public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter','Interviewer','Hiring Manager')
  );

-- Replace overly broad lab policies for interviews and screenings.
drop policy if exists "Authenticated users can insert interviews" on public.interviews;
drop policy if exists "Authenticated users can read interviews" on public.interviews;
drop policy if exists "Authenticated users can update interviews" on public.interviews;
drop policy if exists "Authenticated users can view interviews" on public.interviews;
drop policy if exists "Interviewers can manage interviews" on public.interviews;
drop policy if exists "RMS roles can read interviews" on public.interviews;
drop policy if exists "Interview roles can manage interviews" on public.interviews;
drop policy if exists "HR roles can manage interviews" on public.interviews;
drop policy if exists "Assigned interviewers can update their interviews" on public.interviews;
create policy "RMS roles can read interviews" on public.interviews for select to authenticated
  using (
    public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter','Hiring Manager','Management')
    or (public.current_user_role() = 'Interviewer' and exists (
      select 1 from public.users u where u.user_id = auth.uid() and u.username = interviews.interviewer
    ))
  );
create policy "HR roles can manage interviews" on public.interviews for all to authenticated
  using (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter'))
  with check (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter'));
create policy "Assigned interviewers can update their interviews" on public.interviews for update to authenticated
  using (public.current_user_role() = 'Interviewer' and exists (
    select 1 from public.users u where u.user_id = auth.uid() and u.username = interviews.interviewer
  ))
  with check (public.current_user_role() = 'Interviewer' and exists (
    select 1 from public.users u where u.user_id = auth.uid() and u.username = interviews.interviewer
  ));

drop policy if exists "Authenticated users can insert screenings" on public.screenings;
drop policy if exists "Authenticated users can update screenings" on public.screenings;
drop policy if exists "Authenticated users can view screenings" on public.screenings;
drop policy if exists "Recruitment roles can read screenings" on public.screenings;
drop policy if exists "Recruitment roles can write screenings" on public.screenings;
create policy "Recruitment roles can read screenings" on public.screenings for select to authenticated
  using (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter','Hiring Manager','Management'));
create policy "Recruitment roles can write screenings" on public.screenings for all to authenticated
  using (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter'))
  with check (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter'));

-- Keep applicant PII visible only to recruitment staff and the profile owner.
drop policy if exists "Authenticated users can read applicants" on public.applicants;
drop policy if exists "HR roles can manage applicants" on public.applicants;
drop policy if exists "Applicants can read own profile" on public.applicants;
drop policy if exists "Applicants can update their own profile" on public.applicants;
drop policy if exists "HR roles can read applicants" on public.applicants;
drop policy if exists "Applicants can update own profile" on public.applicants;
create policy "HR roles can read applicants" on public.applicants for select to authenticated
  using (
    public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter','Hiring Manager')
    or (public.current_user_role() = 'Interviewer' and exists (
      select 1 from public.applications ap
      join public.interviews i on i.application_id = ap.application_id
      join public.users u on u.user_id = auth.uid()
      where ap.applicant_id = applicants.applicant_id and i.interviewer = u.username
    ))
    or (public.current_user_role() = 'Management' and exists (
      select 1 from public.applications ap
      join public.hiring h on h.application_id = ap.application_id
      where ap.applicant_id = applicants.applicant_id
    ))
  );
create policy "HR roles can manage applicants" on public.applicants for all to authenticated
  using (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter'))
  with check (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter'));
create policy "Applicants can read own profile" on public.applicants for select to authenticated
  using (auth_user_id = auth.uid());
create policy "Applicants can update own profile" on public.applicants for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Offer details are restricted to HR and management roles.
drop policy if exists "HR roles can read hiring" on public.hiring;
drop policy if exists "HR roles can manage hiring" on public.hiring;
create policy "HR roles can read hiring" on public.hiring for select to authenticated
  using (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Hiring Manager','Management'));
create policy "HR roles can manage hiring" on public.hiring for all to authenticated
  using (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Hiring Manager'))
  with check (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Hiring Manager'));

-- Remove the original broad applications read rule. Applicants can only read
-- their applications; recruitment roles retain the views needed by modules.
drop policy if exists "Authenticated users can read applications" on public.applications;
drop policy if exists "Applicants can read own applications" on public.applications;
drop policy if exists "RMS staff can read applications" on public.applications;
drop policy if exists "Applicants can submit their own applications" on public.applications;
create policy "Applicants can read own applications" on public.applications for select to authenticated
  using (exists (select 1 from public.applicants a where a.applicant_id = applications.applicant_id
    and a.auth_user_id = auth.uid()));
create policy "RMS staff can read applications" on public.applications for select to authenticated
  using (
    public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter','Hiring Manager','Management')
    or (public.current_user_role() = 'Interviewer' and exists (
      select 1 from public.interviews i
      join public.users u on u.user_id = auth.uid()
      where i.application_id = applications.application_id and i.interviewer = u.username
    ))
  );
create policy "Applicants can submit their own applications" on public.applications for insert to authenticated
  with check (
    exists (select 1 from public.applicants a where a.applicant_id = applications.applicant_id
      and a.auth_user_id = auth.uid() and a.status = 'Active'
      and nullif(trim(a.first_name), '') is not null
      and nullif(trim(a.last_name), '') is not null
      and nullif(trim(a.email), '') is not null
      and nullif(trim(a.contact_no), '') is not null
      and nullif(trim(a.address), '') is not null
      and nullif(trim(a.education), '') is not null
      and nullif(trim(a.experience), '') is not null
      and nullif(trim(a.skills), '') is not null)
    and exists (select 1 from public.job_postings j where j.job_id = applications.job_id
      and j.status = 'Open' and j.closing_date >= current_date)
  );

-- Selection, hiring decisions, and interview evaluation update the same
-- application row as its workflow progresses.
drop policy if exists "HR roles can manage applications" on public.applications;
create policy "HR roles can manage applications" on public.applications for all to authenticated
  using (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter','Hiring Manager'))
  with check (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter','Hiring Manager'));

grant select, insert, update, delete on public.screening_criteria to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert on public.application_status_history to authenticated;
grant usage, select on sequence public.screening_criteria_criterion_id_seq to authenticated;
grant usage, select on sequence public.application_status_history_history_id_seq to authenticated;


-- Keep the job-posting policy aligned with the HR Officer navigation role.
drop policy if exists "HR roles can manage job postings" on public.job_postings;
create policy "HR roles can manage job postings" on public.job_postings for all to authenticated
  using (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter'))
  with check (public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter'));

-- Let HR users read the active interviewer directory without exposing other profile records.
drop policy if exists "Recruitment roles can read interviewer directory" on public.users;
create policy "Recruitment roles can read interviewer directory" on public.users for select to authenticated
  using (
    role = 'Interviewer' and status = 'Active'
    and public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter')
  );

commit;
