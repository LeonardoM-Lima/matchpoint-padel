create or replace function public.create_league(p_name text, p_cover_url text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
  v_owner_id uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select id into v_owner_id from public.profiles where user_id = auth.uid();
  if v_owner_id is null then
    raise exception 'Usuario sem perfil';
  end if;

  if char_length(v_name) < 3 or char_length(v_name) > 40 then
    raise exception 'Nome da liga deve ter entre 3 e 40 caracteres';
  end if;

  insert into public.leagues (owner_id, name, cover_url)
  values (v_owner_id, v_name, p_cover_url)
  returning id into v_league_id;

  insert into public.league_players (league_id, profile_id)
  values (v_league_id, v_owner_id);

  return v_league_id;
end;
$$;

grant execute on function public.create_league(text, text) to authenticated;

create or replace function public.update_league(
  p_league_id uuid,
  p_name text default null,
  p_cover_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_caller_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  select owner_id into v_owner_id
    from public.leagues
    where id = p_league_id
    for update;

  if not found then
    raise exception 'Liga nao encontrada';
  end if;

  select id into v_caller_id from public.profiles where user_id = auth.uid();
  if v_caller_id is distinct from v_owner_id then
    raise exception 'Apenas o dono da liga pode realizar esta acao';
  end if;

  if v_name is not null and (char_length(v_name) < 3 or char_length(v_name) > 40) then
    raise exception 'Nome da liga deve ter entre 3 e 40 caracteres';
  end if;

  update public.leagues
    set
      name = coalesce(v_name, name),
      cover_url = coalesce(p_cover_url, cover_url)
    where id = p_league_id;
end;
$$;

grant execute on function public.update_league(uuid, text, text) to authenticated;

create or replace function public.add_league_member(p_league_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_caller_id uuid;
begin
  select owner_id into v_owner_id from public.leagues where id = p_league_id;
  if not found then
    raise exception 'Liga nao encontrada';
  end if;

  select id into v_caller_id from public.profiles where user_id = auth.uid();
  if v_caller_id is distinct from v_owner_id then
    raise exception 'Apenas o dono da liga pode realizar esta acao';
  end if;

  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Jogador nao encontrado';
  end if;

  if exists (
    select 1 from public.league_players
    where league_id = p_league_id and profile_id = p_profile_id
  ) then
    raise exception 'Jogador ja participa desta liga';
  end if;

  insert into public.league_players (league_id, profile_id)
  values (p_league_id, p_profile_id);
end;
$$;

grant execute on function public.add_league_member(uuid, uuid) to authenticated;

create or replace function public.remove_league_member(p_league_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_caller_id uuid;
begin
  select owner_id into v_owner_id from public.leagues where id = p_league_id;
  if not found then
    raise exception 'Liga nao encontrada';
  end if;

  select id into v_caller_id from public.profiles where user_id = auth.uid();
  if v_caller_id is distinct from v_owner_id and v_caller_id is distinct from p_profile_id then
    raise exception 'Apenas o dono da liga pode realizar esta acao';
  end if;

  if p_profile_id = v_owner_id then
    raise exception 'O dono nao pode sair da liga; exclua a liga';
  end if;

  delete from public.league_players
    where league_id = p_league_id and profile_id = p_profile_id;

  if not found then
    raise exception 'Jogador nao participa desta liga';
  end if;
end;
$$;

grant execute on function public.remove_league_member(uuid, uuid) to authenticated;

create or replace function public.delete_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_caller_id uuid;
begin
  select owner_id into v_owner_id from public.leagues where id = p_league_id;
  if not found then
    raise exception 'Liga nao encontrada';
  end if;

  select id into v_caller_id from public.profiles where user_id = auth.uid();
  if v_caller_id is distinct from v_owner_id then
    raise exception 'Apenas o dono da liga pode realizar esta acao';
  end if;

  delete from public.leagues where id = p_league_id;
end;
$$;

grant execute on function public.delete_league(uuid) to authenticated;
