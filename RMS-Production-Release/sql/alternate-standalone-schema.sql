-- Recruitment Management System | Creator: Gigson Aquino
-- Safe additive schema: uses rms_* tables and does not drop or modify existing tables.
-- Review this file before applying it to a project that already contains RMS tables.

create extension if not exists pgcrypto;

create table if not exists public.rms_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Applicant' check (char_length(full_name) between 2 and 100),
  email text not null,
  role text not null default 'Applicant' check (role in ('Administrator','HR Staff','Recruiter','Interviewer','Hiring Manager','Management','Applicant')),
  status text not null default 'Active' check (status in ('Active','Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.rms_current_role()
returns text language sql stable security definer set search_path = public, pg_temp
as $$ select p.role from public.rms_profiles p where p.id = (select auth.uid()) and p.status = 'Active' limit 1 $$;

create or replace function public.rms_is_active()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists(select 1 from public.rms_profiles p where p.id = (select auth.uid()) and p.status = 'Active') $$;

create or replace function public.rms_has_role(allowed text[])
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce(public.rms_current_role() = any(allowed), false) $$;

create or replace function public.rms_touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists rms_profiles_touch_updated_at on public.rms_profiles;
create trigger rms_profiles_touch_updated_at before update on public.rms_profiles for each row execute function public.rms_touch_updated_at();

-- Every public signup is an Applicant. User-supplied metadata is never allowed to choose a role.
create or replace function public.rms_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp
as $$
begin
  insert into public.rms_profiles(id, full_name, email, role, status)
  values (new.id,
          left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Applicant'), 100),
          coalesce(new.email, ''), 'Applicant', 'Active')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists rms_on_auth_user_created on auth.users;
create trigger rms_on_auth_user_created after insert on auth.users for each row execute function public.rms_handle_new_auth_user();

-- Backfill accounts that existed before this release's profile trigger was installed.
-- Existing RMS roles/statuses are preserved; only missing profiles receive the least-privileged Applicant role.
insert into public.rms_profiles(id, full_name, email, role, status)
select u.id,
       case when char_length(trim(coalesce(u.raw_user_meta_data ->> 'full_name', ''))) between 2 and 100
            then trim(u.raw_user_meta_data ->> 'full_name') else 'Applicant' end,
       u.email,
       'Applicant',
       'Active'
from auth.users u
where u.email is not null
on conflict (id) do nothing;

create table if not exists public.rms_job_postings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 160),
  department text,
  employment_type text not null default 'Full-time' check (employment_type in ('Full-time','Part-time','Contract','Temporary','Internship')),
  description text not null check (char_length(trim(description)) between 5 and 10000),
  qualifications text,
  location text,
  closing_date date not null,
  vacancies integer not null default 1 check (vacancies between 1 and 10000),
  status text not null default 'Open' check (status in ('Open','Closed')),
  created_by uuid references public.rms_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rms_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.rms_job_postings(id) on delete restrict,
  applicant_id uuid not null references public.rms_profiles(id) on delete restrict,
  cover_letter text not null check (char_length(trim(cover_letter)) between 1 and 10000),
  resume_url text check (resume_url is null or (char_length(resume_url) <= 2048 and resume_url ~ '^https://')),
  status text not null default 'Submitted' check (status in ('Submitted','Under Review','Screening','Interview','Hired','Rejected','Withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, applicant_id)
);

create table if not exists public.rms_screenings (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.rms_applications(id) on delete cascade,
  score numeric(5,2) not null check (score between 0 and 100),
  result text not null check (result in ('Pending','Qualified','Not Qualified')),
  remarks text check (remarks is null or char_length(remarks) <= 5000),
  screened_by uuid references public.rms_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rms_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.rms_applications(id) on delete cascade,
  scheduled_at timestamptz not null,
  interviewer_id uuid references public.rms_profiles(id) on delete set null,
  score numeric(5,2) check (score between 0 and 100),
  result text not null default 'Pending' check (result in ('Pending','Passed','Failed')),
  status text not null default 'Scheduled' check (status in ('Scheduled','Completed','Cancelled','Rescheduled')),
  remarks text check (remarks is null or char_length(remarks) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rms_hiring_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.rms_applications(id) on delete restrict,
  decision text not null check (decision in ('Hired','Declined','On Hold')),
  salary_offer numeric(12,2) check (salary_offer is null or salary_offer >= 0),
  start_date date,
  remarks text check (remarks is null or char_length(remarks) <= 5000),
  decided_by uuid references public.rms_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(application_id)
);

-- Indexes support common filters and joins.
create index if not exists rms_jobs_status_deadline_idx on public.rms_job_postings(status, closing_date);
create index if not exists rms_applications_applicant_idx on public.rms_applications(applicant_id, created_at desc);
create index if not exists rms_applications_job_idx on public.rms_applications(job_id, created_at desc);
create index if not exists rms_screenings_application_idx on public.rms_screenings(application_id, created_at desc);
create index if not exists rms_interviews_schedule_idx on public.rms_interviews(scheduled_at);
create index if not exists rms_interviews_interviewer_idx on public.rms_interviews(interviewer_id, scheduled_at);

-- Enable RLS on every application table.
alter table public.rms_profiles enable row level security;
alter table public.rms_job_postings enable row level security;
alter table public.rms_applications enable row level security;
alter table public.rms_screenings enable row level security;
alter table public.rms_interviews enable row level security;
alter table public.rms_hiring_decisions enable row level security;

-- Recreate only this release's policies (no data is deleted).
drop policy if exists rms_profiles_select on public.rms_profiles;
create policy rms_profiles_select on public.rms_profiles for select to authenticated
using (id = (select auth.uid()) or public.rms_has_role(array['Administrator','HR Staff','Recruiter','Hiring Manager','Management']));
drop policy if exists rms_profiles_admin_update on public.rms_profiles;
create policy rms_profiles_admin_update on public.rms_profiles for update to authenticated
using (public.rms_has_role(array['Administrator']) and id <> (select auth.uid()))
with check (public.rms_has_role(array['Administrator']) and id <> (select auth.uid()));

-- Job listings: active applicants can read open listings; recruitment staff can read all.
drop policy if exists rms_jobs_select on public.rms_job_postings;
create policy rms_jobs_select on public.rms_job_postings for select to authenticated
using ((public.rms_current_role() = 'Applicant' and status = 'Open' and closing_date >= current_date) or public.rms_has_role(array['Administrator','HR Staff','Recruiter','Interviewer','Hiring Manager','Management']));
drop policy if exists rms_jobs_insert on public.rms_job_postings;
create policy rms_jobs_insert on public.rms_job_postings for insert to authenticated
with check (public.rms_has_role(array['Administrator','HR Staff','Recruiter']) and created_by = (select auth.uid()));
drop policy if exists rms_jobs_update on public.rms_job_postings;
create policy rms_jobs_update on public.rms_job_postings for update to authenticated
using (public.rms_has_role(array['Administrator','HR Staff','Recruiter']))
with check (public.rms_has_role(array['Administrator','HR Staff','Recruiter']));
drop policy if exists rms_jobs_delete on public.rms_job_postings;
create policy rms_jobs_delete on public.rms_job_postings for delete to authenticated
using (public.rms_has_role(array['Administrator']));

-- Applicants may submit and read only their own applications. Staff access is role-bound.
drop policy if exists rms_apps_select on public.rms_applications;
create policy rms_apps_select on public.rms_applications for select to authenticated
using (applicant_id = (select auth.uid())
  or public.rms_has_role(array['Administrator','HR Staff','Recruiter','Hiring Manager','Management'])
  or (public.rms_current_role() = 'Interviewer' and exists (select 1 from public.rms_interviews i where i.application_id = rms_applications.id and i.interviewer_id = (select auth.uid()))));
drop policy if exists rms_apps_insert on public.rms_applications;
create policy rms_apps_insert on public.rms_applications for insert to authenticated
with check (public.rms_current_role() = 'Applicant' and applicant_id = (select auth.uid()) and exists(select 1 from public.rms_job_postings j where j.id = job_id and j.status = 'Open' and j.closing_date >= current_date));
drop policy if exists rms_apps_staff_update on public.rms_applications;
create policy rms_apps_staff_update on public.rms_applications for update to authenticated
using (public.rms_has_role(array['Administrator','HR Staff','Recruiter','Hiring Manager']))
with check (public.rms_has_role(array['Administrator','HR Staff','Recruiter','Hiring Manager']));

-- Screening is managed by authorized recruitment staff.
drop policy if exists rms_screenings_select on public.rms_screenings;
create policy rms_screenings_select on public.rms_screenings for select to authenticated
using (public.rms_has_role(array['Administrator','HR Staff','Recruiter','Hiring Manager','Management']));
drop policy if exists rms_screenings_insert on public.rms_screenings;
create policy rms_screenings_insert on public.rms_screenings for insert to authenticated
with check (public.rms_has_role(array['Administrator','HR Staff','Recruiter']) and screened_by = (select auth.uid()));
drop policy if exists rms_screenings_update on public.rms_screenings;
create policy rms_screenings_update on public.rms_screenings for update to authenticated
using (public.rms_has_role(array['Administrator','HR Staff','Recruiter']))
with check (public.rms_has_role(array['Administrator','HR Staff','Recruiter']));
drop policy if exists rms_screenings_delete on public.rms_screenings;
create policy rms_screenings_delete on public.rms_screenings for delete to authenticated
using (public.rms_has_role(array['Administrator']));

-- Interviewers can see/update assigned interviews only; staff may create and assign them.
drop policy if exists rms_interviews_select on public.rms_interviews;
create policy rms_interviews_select on public.rms_interviews for select to authenticated
using ((public.rms_current_role() = 'Interviewer' and interviewer_id = (select auth.uid())) or public.rms_has_role(array['Administrator','HR Staff','Recruiter','Hiring Manager','Management']));
drop policy if exists rms_interviews_insert on public.rms_interviews;
create policy rms_interviews_insert on public.rms_interviews for insert to authenticated
with check (public.rms_has_role(array['Administrator','HR Staff','Recruiter']) and (interviewer_id is null or exists(select 1 from public.rms_profiles p where p.id = interviewer_id and p.role = 'Interviewer' and p.status = 'Active')));
drop policy if exists rms_interviews_update on public.rms_interviews;
create policy rms_interviews_update on public.rms_interviews for update to authenticated
using ((public.rms_current_role() = 'Interviewer' and interviewer_id = (select auth.uid())) or public.rms_has_role(array['Administrator','HR Staff','Recruiter']))
with check ((public.rms_current_role() = 'Interviewer' and interviewer_id = (select auth.uid())) or public.rms_has_role(array['Administrator','HR Staff','Recruiter']));
drop policy if exists rms_interviews_delete on public.rms_interviews;
create policy rms_interviews_delete on public.rms_interviews for delete to authenticated
using (public.rms_has_role(array['Administrator','HR Staff']));

-- Interviewers may evaluate assigned interviews but cannot reassign them or change the application/schedule.
create or replace function public.rms_guard_interviewer_interview_update()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if public.rms_current_role() = 'Interviewer' and auth.uid() is not null then
    if new.application_id is distinct from old.application_id
       or new.interviewer_id is distinct from old.interviewer_id
       or new.scheduled_at is distinct from old.scheduled_at then
      raise exception 'Interviewers cannot reassign interviews or change the scheduled time.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists rms_interviewer_interview_update_guard on public.rms_interviews;
create trigger rms_interviewer_interview_update_guard before update on public.rms_interviews
for each row execute function public.rms_guard_interviewer_interview_update();

-- Hiring decisions are limited to authorized hiring roles.
drop policy if exists rms_hiring_select on public.rms_hiring_decisions;
create policy rms_hiring_select on public.rms_hiring_decisions for select to authenticated
using (public.rms_has_role(array['Administrator','HR Staff','Hiring Manager','Management']));
drop policy if exists rms_hiring_insert on public.rms_hiring_decisions;
create policy rms_hiring_insert on public.rms_hiring_decisions for insert to authenticated
with check (public.rms_has_role(array['Administrator','HR Staff','Hiring Manager']) and decided_by = (select auth.uid()));
drop policy if exists rms_hiring_update on public.rms_hiring_decisions;
create policy rms_hiring_update on public.rms_hiring_decisions for update to authenticated
using (public.rms_has_role(array['Administrator','HR Staff','Hiring Manager']))
with check (public.rms_has_role(array['Administrator','HR Staff','Hiring Manager']));
drop policy if exists rms_hiring_delete on public.rms_hiring_decisions;
create policy rms_hiring_delete on public.rms_hiring_decisions for delete to authenticated
using (public.rms_has_role(array['Administrator']));

-- Restrict default table privileges and grant only the operations used by the client.
revoke all on public.rms_profiles, public.rms_job_postings, public.rms_applications, public.rms_screenings, public.rms_interviews, public.rms_hiring_decisions from public, anon, authenticated;
grant select on public.rms_profiles to authenticated;
grant update(role, status) on public.rms_profiles to authenticated;
grant select, insert, update, delete on public.rms_job_postings to authenticated;
grant select, insert on public.rms_applications to authenticated;
grant update(status) on public.rms_applications to authenticated;
grant select, insert, delete on public.rms_screenings to authenticated;
grant update(score, result, remarks) on public.rms_screenings to authenticated;
grant select, insert, delete on public.rms_interviews to authenticated;
grant update(application_id, scheduled_at, interviewer_id, score, result, status, remarks) on public.rms_interviews to authenticated;
grant select, insert, delete on public.rms_hiring_decisions to authenticated;

-- Do not promote anyone automatically. First register your own account, then follow
-- manuals/ADMIN-BOOTSTRAP.md to promote that exact account using the Supabase SQL editor.
