-- Applicant self-registration setup
-- Run this AFTER the existing Recruitment Management System tables exist.
-- This uses Supabase Auth for passwords and automatically creates/links the
-- public.users + public.applicants records for a new Applicant account.

create or replace function public.handle_new_applicant_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_email text := lower(trim(new.email));
    v_first_name text := trim(coalesce(new.raw_user_meta_data ->> 'first_name', 'Applicant'));
    v_last_name text := trim(coalesce(new.raw_user_meta_data ->> 'last_name', 'User'));
    v_contact text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'contact_no', '')), '');
    v_base_username text;
    v_username text;
    v_applicant_no text;
begin
    -- Only accounts created through the applicant self-registration form are auto-linked.
    -- Staff accounts created by an administrator must not be downgraded to Applicant.
    if lower(coalesce(new.raw_user_meta_data ->> 'account_type', '')) <> 'applicant' then
        return new;
    end if;

    if v_email is null or v_email = '' then
        raise exception 'Email is required for applicant registration';
    end if;

    v_base_username := lower(split_part(v_email, '@', 1));
    v_username := left(v_base_username, 90);

    if exists (select 1 from public.users where username = v_username and user_id <> new.id) then
        v_username := left(v_base_username, 80) || '-' || substr(replace(new.id::text, '-', ''), 1, 8);
    end if;

    insert into public.users (user_id, username, role, status)
    values (new.id, v_username, 'Applicant', 'Active')
    on conflict (user_id) do update
        set username = excluded.username,
            role = 'Applicant',
            status = 'Active';

    -- Re-use an existing unlinked applicant record when the email matches.
    if exists (
        select 1
        from public.applicants
        where lower(email) = v_email
          and auth_user_id is null
    ) then
        update public.applicants
        set auth_user_id = new.id,
            first_name = coalesce(nullif(v_first_name, ''), first_name),
            last_name = coalesce(nullif(v_last_name, ''), last_name),
            contact_no = coalesce(v_contact, contact_no),
            updated_at = now()
        where applicant_id = (
            select applicant_id
            from public.applicants
            where lower(email) = v_email
              and auth_user_id is null
            order by created_at
            limit 1
        );
    else
        v_applicant_no := 'APP-' || upper(substr(replace(new.id::text, '-', ''), 1, 10));

        insert into public.applicants (
            applicant_no, first_name, last_name, email, contact_no, status, auth_user_id
        )
        values (
            v_applicant_no,
            coalesce(nullif(v_first_name, ''), 'Applicant'),
            coalesce(nullif(v_last_name, ''), 'User'),
            v_email,
            v_contact,
            'Active',
            new.id
        );
    end if;

    return new;
end;
$$;

revoke all on function public.handle_new_applicant_user() from public;

drop trigger if exists on_auth_user_created_rms_applicant on auth.users;
create trigger on_auth_user_created_rms_applicant
after insert on auth.users
for each row
execute function public.handle_new_applicant_user();

-- Applicant profile access: own profile only for app users.
drop policy if exists "Applicants can read own profile" on public.applicants;
create policy "Applicants can read own profile"
on public.applicants
for select
to authenticated
using (auth_user_id = auth.uid());

-- Applicants may edit only their own profile row. The portal limits editable
-- fields to profile/contact information and never changes the linked auth ID.
drop policy if exists "Applicants can update their own profile" on public.applicants;
drop policy if exists "Applicants can update own profile" on public.applicants;
create policy "Applicants can update own profile"
on public.applicants
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

-- Applicant applications: applicants can read only their own; recruitment staff can read all.
drop policy if exists "Authenticated users can read applications" on public.applications;
drop policy if exists "Applicants can read own applications" on public.applications;
create policy "Applicants can read own applications"
on public.applications
for select
to authenticated
using (
    exists (
        select 1
        from public.applicants a
        where a.applicant_id = applications.applicant_id
          and a.auth_user_id = auth.uid()
    )
    or public.current_user_role() in ('Administrator','HR Staff','HR Officer','Recruiter')
);

-- Keep applicant self-submission, but block applicants from changing or deleting applications.
drop policy if exists "Applicants can submit their own applications" on public.applications;
create policy "Applicants can submit their own applications"
on public.applications
for insert
to authenticated
with check (
    exists (
        select 1
        from public.applicants a
        where a.applicant_id = applications.applicant_id
          and a.auth_user_id = auth.uid()
          and a.status = 'Active'
          and nullif(trim(a.first_name), '') is not null
          and nullif(trim(a.last_name), '') is not null
          and nullif(trim(a.email), '') is not null
          and nullif(trim(a.contact_no), '') is not null
          and nullif(trim(a.address), '') is not null
          and nullif(trim(a.education), '') is not null
          and nullif(trim(a.experience), '') is not null
          and nullif(trim(a.skills), '') is not null
    )
    and exists (
        select 1
        from public.job_postings j
        where j.job_id = applications.job_id
          and j.status = 'Open'
          and j.closing_date >= current_date
    )
);
