-- Fix for: column screenings.criteria_scores does not exist
-- Safe to run more than once. Existing screening rows receive an empty rubric.

alter table public.screenings
  add column if not exists criteria_scores jsonb not null default '[]'::jsonb;

-- Refresh PostgREST's schema cache so the browser API recognizes the new column.
notify pgrst, 'reload schema';
