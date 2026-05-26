# Data Model: MVP EvoPadel

**Branch**: `001-matchpoint-mvp` | **Date**: 2026-05-04

## Entidades

### profiles

Armazena o perfil público de cada jogador. Criado automaticamente via trigger
após signup no Supabase Auth.

```sql
CREATE TABLE profiles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,           -- nickname (exibição pública)
  email      text,
  points     int         NOT NULL DEFAULT 1000 CHECK (points >= 0),
  wins       int         NOT NULL DEFAULT 0    CHECK (wins >= 0),
  losses     int         NOT NULL DEFAULT 0    CHECK (losses >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Campo derivado — nível** (calculado em queries, não armazenado):
```sql
CASE
  WHEN points < 800  THEN 'Iniciante'
  WHEN points < 1300 THEN 'Amador'
  ELSE                    'Avançado'
END AS level
```

**Trigger de criação automática após signup**:
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (user_id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

### matches

Registro de uma partida 2x2. No MVP há exatamente 1 set por partida — campos
de set 2 não existem. `winner_team` é derivado server-side pelo RPC (nunca
enviado pelo cliente). `played_at` é gerado pelo servidor via `DEFAULT now()`
— o cliente não envia esse valor (CHK018).

```sql
CREATE TABLE matches (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by        uuid        NOT NULL REFERENCES profiles(id),
  team_a_score      int         NOT NULL CHECK (team_a_score >= 0),
  team_b_score      int         NOT NULL CHECK (team_b_score >= 0),
  winner_team       char(1)     NOT NULL CHECK (winner_team IN ('A', 'B')),
  played_at         timestamptz NOT NULL DEFAULT now(),  -- server-generated
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

**Regra de placar válido** (validada no RPC `register_match` — FR-005a–d):
```
Set válido ⟺
  (winner = 6 AND loser ∈ {0, 1, 2, 3, 4})    -- ex: 6–4, 6–0
  OR (winner = 7 AND loser ∈ {5, 6})            -- ex: 7–5, 7–6 (tiebreak)

winner_team = CASE WHEN team_a_score > team_b_score THEN 'A' ELSE 'B' END
-- Derivado server-side; cliente envia apenas team_a_score e team_b_score.
```

---

### match_players

Liga cada jogador a uma partida. Armazena o histórico de pontuação (antes,
variação, depois) conforme FR-006g.

```sql
CREATE TABLE match_players (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      uuid    NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  profile_id    uuid    NOT NULL REFERENCES profiles(id),
  team          char(1) NOT NULL CHECK (team IN ('A', 'B')),
  result        char(1) NOT NULL CHECK (result IN ('W', 'L')),
  points_before int     NOT NULL,
  points_delta  int     NOT NULL DEFAULT 0,
  points_after  int     NOT NULL DEFAULT 0 CHECK (points_after >= 0),
  UNIQUE (match_id, profile_id)
);
```

---

## RLS Policies

```sql
-- profiles: leitura pública para autenticados
--           update restrito ao próprio perfil (points/wins/losses só via RPC)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select"
  ON profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- Nota: as colunas points, wins, losses não podem ser atualizadas diretamente
-- pelo cliente pois o RPC (SECURITY DEFINER) é a única via de escrita.

-- matches: leitura pública; insert por autenticados
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_select"
  ON matches FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "matches_insert"
  ON matches FOR INSERT TO authenticated
  WITH CHECK (true);

-- match_players: leitura pública; insert somente via RPC SECURITY DEFINER
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_players_select"
  ON match_players FOR SELECT TO authenticated
  USING (true);
-- Sem policy de INSERT direta — inserção ocorre somente via RPC.
```

---

## RPCs

### apply_match_points(p_match_id uuid)

Calcula e persiste as variações de pontuação Elo para todos os jogadores de
uma partida. Chamada internamente por `register_match`.

```sql
CREATE OR REPLACE FUNCTION apply_match_points(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner  char(1);
  v_avg_a   numeric;
  v_avg_b   numeric;
  v_exp_w   numeric;
  v_k       int := 32;
  v_delta_w int;
  v_delta_l int;
  r         RECORD;
BEGIN
  -- 1. Time vencedor
  SELECT winner_team INTO v_winner FROM matches WHERE id = p_match_id;

  -- 2. Médias de pontos antes da partida
  SELECT
    AVG(points_before) FILTER (WHERE team = 'A'),
    AVG(points_before) FILTER (WHERE team = 'B')
  INTO v_avg_a, v_avg_b
  FROM match_players WHERE match_id = p_match_id;

  -- 3. Probabilidade esperada (Elo)
  IF v_winner = 'A' THEN
    v_exp_w := 1.0 / (1.0 + power(10, (v_avg_b - v_avg_a) / 400.0));
  ELSE
    v_exp_w := 1.0 / (1.0 + power(10, (v_avg_a - v_avg_b) / 400.0));
  END IF;

  -- 4. Deltas
  v_delta_w := round(v_k * (1 - v_exp_w));
  v_delta_l := round(v_k * (0 - v_exp_w));  -- negativo

  -- 5. Aplica individualmente a cada jogador
  FOR r IN SELECT * FROM match_players WHERE match_id = p_match_id LOOP
    DECLARE
      v_delta int := CASE WHEN r.team = v_winner THEN v_delta_w ELSE v_delta_l END;
      v_after int := GREATEST(0, r.points_before + v_delta);
    BEGIN
      UPDATE match_players
        SET points_delta = v_delta, points_after = v_after
        WHERE id = r.id;

      UPDATE profiles
        SET
          points     = v_after,
          wins       = wins   + CASE WHEN r.team = v_winner THEN 1 ELSE 0 END,
          losses     = losses + CASE WHEN r.team = v_winner THEN 0 ELSE 1 END,
          updated_at = now()
        WHERE id = r.profile_id;
    END;
  END LOOP;
END;
$$;
```

---

### register_match(payload jsonb) → uuid

Orquestra o registro de uma partida em **transação atômica única** (FR-015,
CHK010, CHK039). Qualquer falha — validação, inserção ou cálculo Elo — causa
rollback completo: nenhuma alteração parcial persiste em `matches`,
`match_players` ou `profiles`. `apply_match_points` é chamada dentro da mesma
transação implícita do PostgreSQL.

O cliente envia apenas `team_a_score`, `team_b_score` e os jogadores.
`winner_team` e `played_at` são derivados/gerados server-side.

```sql
CREATE OR REPLACE FUNCTION register_match(payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match_id uuid;
  v_winner   char(1);
  v_ta       int := (payload->>'team_a_score')::int;
  v_tb       int := (payload->>'team_b_score')::int;
  v_creator  uuid;
  v_player   jsonb;
  v_pts      int;
BEGIN
  -- Resolve o profile do criador
  SELECT id INTO v_creator FROM profiles WHERE user_id = auth.uid();

  -- Validação: exatamente 4 jogadores, 2 por time
  IF jsonb_array_length(payload->'players') != 4 THEN
    RAISE EXCEPTION 'Partida requer exatamente 4 jogadores';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(payload->'players') p
      WHERE p->>'team' = 'A') != 2 THEN
    RAISE EXCEPTION 'Cada time deve ter exatamente 2 jogadores';
  END IF;

  -- Validação de placar (FR-005a–c)
  IF NOT (
    (GREATEST(v_ta, v_tb) = 6 AND ABS(v_ta - v_tb) >= 2 AND LEAST(v_ta, v_tb) <= 4)
    OR
    (GREATEST(v_ta, v_tb) = 7 AND LEAST(v_ta, v_tb) IN (5, 6))
  ) THEN
    RAISE EXCEPTION 'Placar inválido: %–%', v_ta, v_tb;
  END IF;

  -- Determina winner_team server-side (FR-005d)
  v_winner := CASE WHEN v_ta > v_tb THEN 'A' ELSE 'B' END;

  -- Insere match (played_at via DEFAULT now() — não vem do cliente)
  INSERT INTO matches (created_by, team_a_score, team_b_score, winner_team)
  VALUES (v_creator, v_ta, v_tb, v_winner)
  RETURNING id INTO v_match_id;

  -- Insere match_players com snapshot atômico de points_before (CHK010)
  FOR v_player IN SELECT * FROM jsonb_array_elements(payload->'players') LOOP
    SELECT points INTO v_pts
      FROM profiles WHERE id = (v_player->>'profile_id')::uuid;

    INSERT INTO match_players (
      match_id, profile_id, team, result, points_before, points_delta, points_after
    ) VALUES (
      v_match_id,
      (v_player->>'profile_id')::uuid,
      v_player->>'team',
      CASE WHEN v_player->>'team' = v_winner THEN 'W' ELSE 'L' END,
      v_pts, 0, v_pts
    );
  END LOOP;

  -- Aplica Elo dentro da mesma transação (CHK039 — rollback total se falhar)
  PERFORM apply_match_points(v_match_id);

  RETURN v_match_id;
END;
$$;
```

---

### delete_match(p_match_id uuid) → void

Exclui uma partida dentro da janela de 5 minutos e reverte a pontuação de
todos os jogadores envolvidos.

```sql
CREATE OR REPLACE FUNCTION delete_match(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_created_by uuid;
  v_created_at timestamptz;
  v_caller     uuid;
  r            RECORD;
BEGIN
  SELECT created_by, created_at INTO v_created_by, v_created_at
    FROM matches WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada';
  END IF;

  SELECT id INTO v_caller FROM profiles WHERE user_id = auth.uid();

  IF v_caller != v_created_by THEN
    RAISE EXCEPTION 'Apenas o criador pode excluir a partida';
  END IF;

  IF now() - v_created_at > interval '5 minutes' THEN
    RAISE EXCEPTION 'Prazo de exclusão expirado (5 minutos)';
  END IF;

  -- Reverte pontuação de cada jogador
  FOR r IN SELECT * FROM match_players WHERE match_id = p_match_id LOOP
    UPDATE profiles SET
      points     = r.points_before,
      wins       = wins   - CASE WHEN r.result = 'W' THEN 1 ELSE 0 END,
      losses     = losses - CASE WHEN r.result = 'L' THEN 1 ELSE 0 END,
      updated_at = now()
    WHERE id = r.profile_id;
  END LOOP;

  DELETE FROM matches WHERE id = p_match_id;
  -- match_players deletados via ON DELETE CASCADE
END;
$$;
```

---

## Queries principais

### Ranking (com nível derivado e desempate)

```sql
SELECT
  p.id,
  p.name,
  p.points,
  p.wins,
  p.losses,
  p.wins + p.losses                                    AS total_matches,
  CASE
    WHEN p.points < 800  THEN 'Iniciante'
    WHEN p.points < 1300 THEN 'Amador'
    ELSE                      'Avançado'
  END                                                  AS level,
  RANK() OVER (
    ORDER BY p.points DESC, (p.wins + p.losses) DESC
  )                                                    AS position
FROM profiles p
ORDER BY p.points DESC, (p.wins + p.losses) DESC;
```

### Matchmaking (por proximidade de pontos, excluindo o usuário atual)

```sql
SELECT
  p.id,
  p.name,
  p.points,
  p.wins,
  p.losses,
  CASE
    WHEN p.points < 800  THEN 'Iniciante'
    WHEN p.points < 1300 THEN 'Amador'
    ELSE                      'Avançado'
  END                                       AS level,
  ABS(p.points - :current_user_points)      AS point_diff
FROM profiles p
WHERE p.user_id != auth.uid()
ORDER BY ABS(p.points - :current_user_points) ASC;
```
