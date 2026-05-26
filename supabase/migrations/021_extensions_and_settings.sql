create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

comment on extension pg_net is 'Used by PadelUP push and cleanup jobs to call Supabase Edge Functions.';
comment on extension pg_cron is 'Used by PadelUP daily video retention cleanup.';
