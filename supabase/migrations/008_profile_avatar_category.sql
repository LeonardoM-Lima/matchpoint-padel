do $$
begin
  if not exists (select 1 from pg_type where typname = 'player_category') then
    create type public.player_category as enum (
      '1a',
      '2a',
      '3a',
      '4a',
      '5a',
      '6a',
      'Open',
      'Iniciante'
    );
  end if;
end $$;

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists category public.player_category;
