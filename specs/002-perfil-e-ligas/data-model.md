# Data Model: Perfil e Ligas Privadas

**Branch**: `002-perfil-e-ligas` | **Date**: 2026-05-22

## Visão geral

Estende o schema do MVP com:
- Novos campos em `profiles`: `avatar_url`, `category`.
- Novas tabelas: `leagues`, `league_players`, `match_leagues`, `match_league_players`.
- Tipo ENUM `player_category`.
- RPCs novas (`create_league`, `add_league_member`, `remove_league_member`,
  `delete_league`, `update_league`, `get_eligible_leagues_for_match`) e v2 das
  RPCs existentes (`register_match`, `delete_match`, `apply_match_points`).
- Buckets de Storage: `avatars` e `league-covers`.

## Entidades

### profiles (estendida)

```sql
-- Migration 008 — ORDEM: CREATE TYPE primeiro, depois ALTER TABLE.
CREATE TYPE player_category AS ENUM (
  '1a', '2a', '3a', '4a', '5a', '6a', 'Open', 'Iniciante'
);

ALTER TABLE profiles
  ADD COLUMN avatar_url text,
  ADD COLUMN category   player_category;
```

> Valores do ENUM usam ordinais ASCII (`1a`, `2a`, ...) ao invés do caractere
> Unicode `ª` (U+00AA) para evitar problemas de encoding em arquivos `.sql`
> salvos em Windows (latin1/CP1252) e em handlers HTTP. A camada de
> apresentação mapeia para a forma humana ("1ª", "2ª", ...) no client.

`avatar_url` armazena o **path relativo** dentro do bucket `avatars`
(ex: `{user_id}/avatar.webp`). A URL pública é gerada on-the-fly pelo client
via `supabase.storage.from('avatars').getPublicUrl(path, { transform: ... })`.

---

### leagues

Representa uma liga privada. O criador (`owner_id`) tem privilégios
administrativos exclusivos.

```sql
CREATE TABLE leagues (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       text        NOT NULL CHECK (char_length(trim(name)) BETWEEN 3 AND 40),
  cover_url  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leagues_owner_id ON leagues(owner_id);
```

> `cover_url` é opcional (sem cover = exibir placeholder no client). Path
> relativo no bucket `league-covers`, formato `{league_id}/cover.webp`.

---

### league_players

Liga jogadores a ligas com contadores internos isolados do ranking global.

```sql
CREATE TABLE league_players (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  uuid        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  profile_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points     int         NOT NULL DEFAULT 0 CHECK (points >= 0),
  wins       int         NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses     int         NOT NULL DEFAULT 0 CHECK (losses >= 0),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, profile_id)
);

CREATE INDEX idx_league_players_league ON league_players(league_id);
CREATE INDEX idx_league_players_profile ON league_players(profile_id);
```

**Inicialização**: todo participante começa com `points = 0, wins = 0,
losses = 0`. A inserção do dono é feita pela RPC `create_league` (atômico).

**Update direto bloqueado por RLS** — `points/wins/losses` só são alterados
pelas funções SECURITY DEFINER.

---

### match_leagues

Vínculo entre uma partida e uma liga. Cada partida pode estar vinculada a no
máximo 1 liga. **A presença desta linha indica vínculo** — partidas sem liga
NÃO têm linha em `match_leagues` (estado ausente, não NULL).

```sql
CREATE TABLE match_leagues (
  match_id  uuid PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE SET NULL
);

CREATE INDEX idx_match_leagues_league ON match_leagues(league_id);
```

> **Estados possíveis** (mutuamente exclusivos):
> - Sem linha em `match_leagues` para o `match_id` → partida nunca foi vinculada.
> - Linha presente com `league_id NOT NULL` → vínculo ativo.
> - Linha presente com `league_id NULL` → liga foi excluída, mas o vínculo
>   histórico é preservado para auditoria (FR-028). Queries de "ligas ativas"
>   devem filtrar `league_id IS NOT NULL`.
>
> O `NOT NULL` no INSERT é garantido em `register_match` v2 — `league_id NULL`
> só aparece como resultado de `ON DELETE SET NULL` (exclusão da liga).

---

### match_league_players

Histórico de pontuação na dimensão liga, espelhando `match_players` para o
contexto interno. Existe APENAS quando há partida vinculada.

```sql
CREATE TABLE match_league_players (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id              uuid NOT NULL REFERENCES matches(id)  ON DELETE CASCADE,
  league_id             uuid          REFERENCES leagues(id)  ON DELETE SET NULL,
  profile_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  league_points_before  int  NOT NULL,
  league_points_delta   int  NOT NULL DEFAULT 0,
  league_points_after   int  NOT NULL DEFAULT 0 CHECK (league_points_after >= 0),
  UNIQUE (match_id, profile_id)
);

CREATE INDEX idx_mlp_league ON match_league_players(league_id);
CREATE INDEX idx_mlp_match  ON match_league_players(match_id);
```

> **Decisão de CASCADE consistente com `match_leagues`**: `league_id` é
> `ON DELETE SET NULL` (não CASCADE) para preservar o histórico de pontuação
> mesmo após exclusão da liga (FR-028 estendido). Quando `delete_match`
> remove a partida (dentro da janela de 5 min), todas as linhas vão embora
> via `ON DELETE CASCADE` em `match_id` — comportamento esperado.

---

## Helper functions (Migration 012)

Funções `SECURITY DEFINER` que **contornam RLS** ao consultar tabelas internas,
evitando recursão em policies. Restritas a `authenticated`.

```sql
-- Verifica se o usuário autenticado é participante da liga.
-- Usado em policies de SELECT (league_players, match_leagues, match_league_players).
CREATE OR REPLACE FUNCTION is_league_member(p_league_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_players lp
     WHERE lp.league_id = p_league_id
       AND lp.profile_id = (
         SELECT id FROM profiles WHERE user_id = auth.uid()
       )
  );
$$;

REVOKE ALL ON FUNCTION is_league_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_league_member(uuid) TO authenticated;

-- Verifica se o usuário autenticado é dono da liga (independe de league_players).
CREATE OR REPLACE FUNCTION is_league_owner(p_league_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM leagues l
     WHERE l.id = p_league_id
       AND l.owner_id = (
         SELECT id FROM profiles WHERE user_id = auth.uid()
       )
  );
$$;

REVOKE ALL ON FUNCTION is_league_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_league_owner(uuid) TO authenticated;
```

> **Por que SECURITY DEFINER?** Sem isso, o `SELECT FROM league_players` dentro
> da policy de `league_players` reinvocaria a mesma policy infinitamente. Com
> `SECURITY DEFINER`, a função roda como `postgres` e bypassa RLS da leitura
> interna, retornando apenas um boolean.

---

## RLS Policies (Migration 013)

### profiles (estendida)

A policy de SELECT pública já existe no MVP. A policy de UPDATE no MVP já
restringia ao próprio user e continua válida — os novos campos
(`avatar_url`, `category`) passam a ser editáveis pelo próprio usuário sem
mudança de policy.

```sql
-- (mantida do MVP) profiles_update_own: WITH CHECK (auth.uid() = user_id)
-- avatar_url e category passam a ser editáveis pelo próprio usuário.
-- points/wins/losses continuam bloqueados via RPC SECURITY DEFINER.
```

### leagues

```sql
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

-- SELECT: somente dono OU participantes (usa helpers para evitar recursão)
CREATE POLICY leagues_select ON leagues
  FOR SELECT TO authenticated
  USING (
    is_league_owner(id)
    OR is_league_member(id)
  );

-- INSERT/UPDATE/DELETE: somente via RPC SECURITY DEFINER (sem policy direta)
```

### league_players

```sql
ALTER TABLE league_players ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer participante da mesma liga (via helper SECURITY DEFINER)
CREATE POLICY league_players_select ON league_players
  FOR SELECT TO authenticated
  USING (is_league_member(league_id));

-- INSERT/UPDATE/DELETE: somente via RPC SECURITY DEFINER
```

### match_leagues e match_league_players

```sql
ALTER TABLE match_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_league_players ENABLE ROW LEVEL SECURITY;

-- SELECT: somente participantes da liga (helper bypassa recursão)
CREATE POLICY match_leagues_select ON match_leagues
  FOR SELECT TO authenticated
  USING (
    league_id IS NULL  -- preserva visibilidade após exclusão da liga
    OR is_league_member(league_id)
  );

CREATE POLICY mlp_select ON match_league_players
  FOR SELECT TO authenticated
  USING (is_league_member(league_id));

-- INSERT/UPDATE/DELETE: somente via RPC SECURITY DEFINER
```

### Storage buckets

```sql
-- Bucket avatars: público para leitura, escrita apenas no próprio "diretório"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Bucket league-covers: público para leitura, escrita apenas pelo dono da liga.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'league-covers', 'league-covers', true, 2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Path convencional: league-covers/{league_id}/cover.{ext}
-- A policy valida que o caller é dono da liga indicada pelo primeiro segmento
-- do path via helper SECURITY DEFINER is_league_owner().

CREATE POLICY league_covers_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'league-covers'
    AND is_league_owner( ((storage.foldername(name))[1])::uuid )
  );

CREATE POLICY league_covers_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'league-covers'
    AND is_league_owner( ((storage.foldername(name))[1])::uuid )
  );

CREATE POLICY league_covers_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'league-covers'
    AND is_league_owner( ((storage.foldername(name))[1])::uuid )
  );
```

> **Por que helper `is_league_owner`?** A policy direta `SELECT FROM leagues
> WHERE owner_id = ...` exigiria que a tabela `leagues` permitisse SELECT pela
> RLS, o que ela faz apenas para dono/membro. O helper `SECURITY DEFINER`
> bypassa essa restrição e retorna apenas o boolean. Path inválido (primeiro
> segmento não-UUID) faz o cast `::uuid` lançar erro → INSERT rejeitado.

---

## RPCs

### create_league(p_name text, p_cover_url text) → uuid

```sql
CREATE OR REPLACE FUNCTION create_league(p_name text, p_cover_url text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_league_id uuid;
  v_owner_id  uuid;
BEGIN
  SELECT id INTO v_owner_id FROM profiles WHERE user_id = auth.uid();
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem perfil';
  END IF;

  IF char_length(trim(p_name)) < 3 OR char_length(trim(p_name)) > 40 THEN
    RAISE EXCEPTION 'Nome da liga deve ter entre 3 e 40 caracteres';
  END IF;

  INSERT INTO leagues (owner_id, name, cover_url)
  VALUES (v_owner_id, trim(p_name), p_cover_url)
  RETURNING id INTO v_league_id;

  -- Dono entra automaticamente como participante com 0 pontos
  INSERT INTO league_players (league_id, profile_id)
  VALUES (v_league_id, v_owner_id);

  RETURN v_league_id;
END;
$$;
```

---

### update_league(p_league_id uuid, p_name text, p_cover_url text) → void

```sql
CREATE OR REPLACE FUNCTION update_league(
  p_league_id uuid,
  p_name      text DEFAULT NULL,
  p_cover_url text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner uuid;
  v_caller uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM leagues WHERE id = p_league_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Liga não encontrada'; END IF;

  SELECT id INTO v_caller FROM profiles WHERE user_id = auth.uid();
  IF v_caller <> v_owner THEN
    RAISE EXCEPTION 'Apenas o dono da liga pode realizar esta ação';
  END IF;

  UPDATE leagues SET
    name       = COALESCE(NULLIF(trim(p_name), ''), name),
    cover_url  = COALESCE(p_cover_url, cover_url),
    updated_at = now()
  WHERE id = p_league_id;
END;
$$;
```

---

### add_league_member(p_league_id uuid, p_profile_id uuid) → void

```sql
CREATE OR REPLACE FUNCTION add_league_member(
  p_league_id  uuid,
  p_profile_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner  uuid;
  v_caller uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM leagues WHERE id = p_league_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Liga não encontrada'; END IF;

  SELECT id INTO v_caller FROM profiles WHERE user_id = auth.uid();
  IF v_caller <> v_owner THEN
    RAISE EXCEPTION 'Apenas o dono da liga pode realizar esta ação';
  END IF;

  -- Verifica duplicata explicitamente para mensagem amigável
  IF EXISTS (
    SELECT 1 FROM league_players
     WHERE league_id = p_league_id AND profile_id = p_profile_id
  ) THEN
    RAISE EXCEPTION 'Jogador já participa desta liga';
  END IF;

  INSERT INTO league_players (league_id, profile_id)
  VALUES (p_league_id, p_profile_id);
END;
$$;
```

---

### remove_league_member(p_league_id uuid, p_profile_id uuid) → void

```sql
CREATE OR REPLACE FUNCTION remove_league_member(
  p_league_id  uuid,
  p_profile_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner uuid;
  v_caller uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM leagues WHERE id = p_league_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Liga não encontrada'; END IF;

  SELECT id INTO v_caller FROM profiles WHERE user_id = auth.uid();

  -- Caller deve ser o dono OU o próprio membro (self-remove permitido)
  IF v_caller <> v_owner AND v_caller <> p_profile_id THEN
    RAISE EXCEPTION 'Apenas o dono ou o próprio jogador podem realizar esta ação';
  END IF;

  -- Dono não pode se remover sozinho — usar delete_league
  IF p_profile_id = v_owner THEN
    RAISE EXCEPTION 'O dono não pode sair da liga — exclua a liga';
  END IF;

  DELETE FROM league_players
   WHERE league_id = p_league_id AND profile_id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jogador não participa desta liga';
  END IF;
END;
$$;
```

---

### delete_league(p_league_id uuid) → void

```sql
CREATE OR REPLACE FUNCTION delete_league(p_league_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner uuid;
  v_caller uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM leagues WHERE id = p_league_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Liga não encontrada'; END IF;

  SELECT id INTO v_caller FROM profiles WHERE user_id = auth.uid();
  IF v_caller <> v_owner THEN
    RAISE EXCEPTION 'Apenas o dono da liga pode realizar esta ação';
  END IF;

  -- CASCADE remove league_players e match_league_players;
  -- match_leagues.league_id vira NULL (ON DELETE SET NULL).
  DELETE FROM leagues WHERE id = p_league_id;
END;
$$;
```

---

### get_eligible_leagues_for_match(p_player_ids uuid[]) → SETOF leagues

Lista ligas em que TODOS os jogadores informados são participantes ativos.
Usada para popular o dropdown da tela de registrar partida.

```sql
CREATE OR REPLACE FUNCTION get_eligible_leagues_for_match(p_player_ids uuid[])
RETURNS TABLE (id uuid, name text, cover_url text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT l.id, l.name, l.cover_url
    FROM leagues l
   WHERE NOT EXISTS (
     SELECT pid FROM unnest(p_player_ids) AS pid
      WHERE NOT EXISTS (
        SELECT 1 FROM league_players lp
         WHERE lp.league_id = l.id AND lp.profile_id = pid
      )
   )
   ORDER BY l.name;
$$;
```

> Liga elegível ⟺ não existe nenhum jogador fora dela.

---

### register_match v2 (com league_id opcional)

```sql
DROP FUNCTION IF EXISTS register_match(jsonb);

CREATE OR REPLACE FUNCTION register_match(payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match_id  uuid;
  v_winner    char(1);
  v_ta        int := (payload->>'team_a_score')::int;
  v_tb        int := (payload->>'team_b_score')::int;
  v_creator   uuid;
  v_player    jsonb;
  v_pts       int;
  v_league_id uuid := NULLIF(payload->>'league_id', '')::uuid;
  v_league_pts int;
BEGIN
  SELECT id INTO v_creator FROM profiles WHERE user_id = auth.uid();

  -- (mesma validação de 4 jogadores e placar do MVP)
  IF jsonb_array_length(payload->'players') != 4 THEN
    RAISE EXCEPTION 'Partida requer exatamente 4 jogadores';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(payload->'players') p
      WHERE p->>'team' = 'A') != 2 THEN
    RAISE EXCEPTION 'Cada time deve ter exatamente 2 jogadores';
  END IF;

  IF NOT (
    (GREATEST(v_ta, v_tb) = 6 AND ABS(v_ta - v_tb) >= 2 AND LEAST(v_ta, v_tb) <= 4)
    OR (GREATEST(v_ta, v_tb) = 7 AND LEAST(v_ta, v_tb) IN (5, 6))
  ) THEN
    RAISE EXCEPTION 'Placar inválido: %–%', v_ta, v_tb;
  END IF;

  v_winner := CASE WHEN v_ta > v_tb THEN 'A' ELSE 'B' END;

  -- Validação de elegibilidade da liga (se vinculada)
  IF v_league_id IS NOT NULL THEN
    IF EXISTS (
      SELECT p FROM jsonb_array_elements(payload->'players') p
       WHERE NOT EXISTS (
         SELECT 1 FROM league_players lp
          WHERE lp.league_id = v_league_id
            AND lp.profile_id = (p->>'profile_id')::uuid
       )
    ) THEN
      RAISE EXCEPTION 'Todos os 4 jogadores devem participar da liga';
    END IF;
  END IF;

  INSERT INTO matches (created_by, team_a_score, team_b_score, winner_team)
  VALUES (v_creator, v_ta, v_tb, v_winner)
  RETURNING id INTO v_match_id;

  -- Vínculo opcional com liga
  IF v_league_id IS NOT NULL THEN
    INSERT INTO match_leagues (match_id, league_id) VALUES (v_match_id, v_league_id);
  END IF;

  -- match_players: snapshot global
  FOR v_player IN SELECT * FROM jsonb_array_elements(payload->'players') LOOP
    SELECT points INTO v_pts FROM profiles
     WHERE id = (v_player->>'profile_id')::uuid;

    INSERT INTO match_players (
      match_id, profile_id, team, result, points_before, points_delta, points_after
    ) VALUES (
      v_match_id,
      (v_player->>'profile_id')::uuid,
      v_player->>'team',
      CASE WHEN v_player->>'team' = v_winner THEN 'W' ELSE 'L' END,
      v_pts, 0, v_pts
    );

    -- Snapshot da liga (se vinculada)
    IF v_league_id IS NOT NULL THEN
      SELECT points INTO v_league_pts FROM league_players
       WHERE league_id = v_league_id
         AND profile_id = (v_player->>'profile_id')::uuid;

      INSERT INTO match_league_players (
        match_id, league_id, profile_id,
        league_points_before, league_points_delta, league_points_after
      ) VALUES (
        v_match_id, v_league_id, (v_player->>'profile_id')::uuid,
        v_league_pts, 0, v_league_pts
      );
    END IF;
  END LOOP;

  -- Aplica Elo em ambas as dimensões
  PERFORM apply_match_points(v_match_id);

  RETURN v_match_id;
END;
$$;
```

---

### apply_match_points v2 (com dimensão liga)

```sql
DROP FUNCTION IF EXISTS apply_match_points(uuid);

CREATE OR REPLACE FUNCTION apply_match_points(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner    char(1);
  v_avg_a_g   numeric;
  v_avg_b_g   numeric;
  v_avg_a_l   numeric;
  v_avg_b_l   numeric;
  v_exp_w_g   numeric;
  v_exp_w_l   numeric;
  v_k         int := 32;
  v_delta_w_g int;
  v_delta_l_g int;
  v_delta_w_l int;
  v_delta_l_l int;
  v_league_id uuid;
  v_has_league boolean;
  r           RECORD;
BEGIN
  SELECT winner_team INTO v_winner FROM matches WHERE id = p_match_id;
  SELECT league_id INTO v_league_id FROM match_leagues WHERE match_id = p_match_id;
  v_has_league := v_league_id IS NOT NULL;

  -- Médias globais
  SELECT
    AVG(points_before) FILTER (WHERE team = 'A'),
    AVG(points_before) FILTER (WHERE team = 'B')
  INTO v_avg_a_g, v_avg_b_g
  FROM match_players WHERE match_id = p_match_id;

  -- Médias da liga (se houver)
  IF v_has_league THEN
    SELECT
      AVG(mlp.league_points_before) FILTER (WHERE mp.team = 'A'),
      AVG(mlp.league_points_before) FILTER (WHERE mp.team = 'B')
    INTO v_avg_a_l, v_avg_b_l
    FROM match_league_players mlp
    JOIN match_players mp
      ON mp.match_id = mlp.match_id AND mp.profile_id = mlp.profile_id
    WHERE mlp.match_id = p_match_id;
  END IF;

  -- Deltas globais
  IF v_winner = 'A' THEN
    v_exp_w_g := 1.0 / (1.0 + power(10, (v_avg_b_g - v_avg_a_g) / 400.0));
  ELSE
    v_exp_w_g := 1.0 / (1.0 + power(10, (v_avg_a_g - v_avg_b_g) / 400.0));
  END IF;
  v_delta_w_g := round(v_k * (1 - v_exp_w_g));
  v_delta_l_g := round(v_k * (0 - v_exp_w_g));

  -- Deltas da liga (independentes)
  IF v_has_league THEN
    IF v_winner = 'A' THEN
      v_exp_w_l := 1.0 / (1.0 + power(10, (v_avg_b_l - v_avg_a_l) / 400.0));
    ELSE
      v_exp_w_l := 1.0 / (1.0 + power(10, (v_avg_a_l - v_avg_b_l) / 400.0));
    END IF;
    v_delta_w_l := round(v_k * (1 - v_exp_w_l));
    v_delta_l_l := round(v_k * (0 - v_exp_w_l));
  END IF;

  -- Aplica para cada jogador
  FOR r IN SELECT * FROM match_players WHERE match_id = p_match_id LOOP
    DECLARE
      v_delta_g int := CASE WHEN r.team = v_winner THEN v_delta_w_g ELSE v_delta_l_g END;
      v_after_g int := GREATEST(0, r.points_before + v_delta_g);
    BEGIN
      UPDATE match_players
        SET points_delta = v_delta_g, points_after = v_after_g
       WHERE id = r.id;

      UPDATE profiles SET
        points     = v_after_g,
        wins       = wins   + CASE WHEN r.team = v_winner THEN 1 ELSE 0 END,
        losses     = losses + CASE WHEN r.team = v_winner THEN 0 ELSE 1 END,
        updated_at = now()
      WHERE id = r.profile_id;
    END;

    -- Liga: análogo, isolado
    IF v_has_league THEN
      DECLARE
        v_delta_l_player int := CASE WHEN r.team = v_winner THEN v_delta_w_l ELSE v_delta_l_l END;
        v_lp_before      int;
        v_after_l        int;
      BEGIN
        SELECT league_points_before INTO v_lp_before
          FROM match_league_players
         WHERE match_id = p_match_id AND profile_id = r.profile_id;

        v_after_l := GREATEST(0, v_lp_before + v_delta_l_player);

        UPDATE match_league_players
          SET league_points_delta = v_delta_l_player,
              league_points_after = v_after_l
         WHERE match_id = p_match_id AND profile_id = r.profile_id;

        UPDATE league_players SET
          points = v_after_l,
          wins   = wins   + CASE WHEN r.team = v_winner THEN 1 ELSE 0 END,
          losses = losses + CASE WHEN r.team = v_winner THEN 0 ELSE 1 END
        WHERE league_id = v_league_id AND profile_id = r.profile_id;
      END;
    END IF;
  END LOOP;
END;
$$;
```

---

### delete_match v2 (com reversão da liga)

```sql
DROP FUNCTION IF EXISTS delete_match(uuid);

CREATE OR REPLACE FUNCTION delete_match(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_created_by uuid;
  v_created_at timestamptz;
  v_caller     uuid;
  v_league_id  uuid;
  r            RECORD;
BEGIN
  SELECT created_by, created_at INTO v_created_by, v_created_at
    FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;

  SELECT id INTO v_caller FROM profiles WHERE user_id = auth.uid();
  IF v_caller <> v_created_by THEN
    RAISE EXCEPTION 'Apenas o criador pode excluir a partida'
      USING ERRCODE = 'P0403', HINT = 'MATCH_DELETE_FORBIDDEN';
  END IF;

  IF now() - v_created_at > interval '5 minutes' THEN
    RAISE EXCEPTION 'Prazo de exclusão expirado (5 minutos)';
  END IF;

  -- league_id pode ser NULL se a liga foi excluída entre o registro e a tentativa de delete.
  -- Nesse caso, league_players já foi removida via CASCADE e não há o que reverter na liga.
  SELECT league_id INTO v_league_id
    FROM match_leagues WHERE match_id = p_match_id;

  -- Reverte global (igual ao MVP)
  FOR r IN SELECT * FROM match_players WHERE match_id = p_match_id LOOP
    UPDATE profiles SET
      points     = r.points_before,
      wins       = wins   - CASE WHEN r.result = 'W' THEN 1 ELSE 0 END,
      losses     = losses - CASE WHEN r.result = 'L' THEN 1 ELSE 0 END,
      updated_at = now()
    WHERE id = r.profile_id;
  END LOOP;

  -- Reverte liga apenas se ela ainda existe.
  -- Se a liga foi deletada, league_id está NULL em match_leagues (e em
  -- match_league_players via ON DELETE SET NULL); league_players já não existe.
  IF v_league_id IS NOT NULL THEN
    FOR r IN
      SELECT mlp.*, mp.result
        FROM match_league_players mlp
        JOIN match_players mp
          ON mp.match_id = mlp.match_id AND mp.profile_id = mlp.profile_id
       WHERE mlp.match_id  = p_match_id
         AND mlp.league_id = v_league_id  -- defesa em profundidade
    LOOP
      UPDATE league_players SET
        points = r.league_points_before,
        wins   = wins   - CASE WHEN r.result = 'W' THEN 1 ELSE 0 END,
        losses = losses - CASE WHEN r.result = 'L' THEN 1 ELSE 0 END
      WHERE league_id = v_league_id AND profile_id = r.profile_id;
    END LOOP;
  END IF;

  DELETE FROM matches WHERE id = p_match_id;
  -- match_players, match_leagues, match_league_players removidos via CASCADE
END;
$$;
```

> **Edge case (criador não-membro)**: o criador pode chamar `delete_match` mesmo
> que tenha sido removido da liga entre o registro e a exclusão (FR-019 só
> valida `created_by`, não membership atual). A reversão da liga acontece
> normalmente — é o comportamento desejado, pois a partida originalmente afetou
> o ranking da liga e precisa voltar ao estado consistente.

---

## Queries principais

### Listar minhas ligas

```sql
SELECT
  l.id, l.name, l.cover_url,
  l.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) AS is_owner,
  (SELECT count(*) FROM league_players WHERE league_id = l.id)      AS member_count
FROM leagues l
JOIN league_players lp
  ON lp.league_id  = l.id
 AND lp.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
ORDER BY l.created_at DESC;
```

### Ranking interno da liga

```sql
SELECT
  lp.profile_id,
  p.name,
  p.avatar_url,
  p.category,
  lp.points,
  lp.wins,
  lp.losses,
  CASE
    WHEN lp.points < 800  THEN 'Iniciante'
    WHEN lp.points < 1300 THEN 'Amador'
    ELSE                       'Avançado'
  END AS level,
  RANK() OVER (
    ORDER BY lp.points DESC, lp.wins DESC, lp.losses ASC
  ) AS position
FROM league_players lp
JOIN profiles p ON p.id = lp.profile_id
WHERE lp.league_id = :league_id
ORDER BY lp.points DESC, lp.wins DESC, lp.losses ASC;
```

> Nota: o "nível" exibido no ranking da liga ainda é derivado dos `lp.points`
> (pontos internos da liga). Não usa os pontos globais.
