drop policy if exists "matchmaking_availability_select_active_or_own" on public.matchmaking_availability;

create policy "matchmaking_availability_select_active_or_own"
  on public.matchmaking_availability for select
  to authenticated
  using (
    available_until > now()
    or exists (
      select 1
      from public.profiles
      where profiles.id = matchmaking_availability.profile_id
        and profiles.user_id = auth.uid()
    )
  );
