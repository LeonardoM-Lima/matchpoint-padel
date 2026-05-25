# Data Model: Feed de Jogadas e Notificações Push

**Branch**: `003-feed-e-push` | **Date**: 2026-05-22

## Visão geral

Adiciona ao schema:
- ENUM `video_category` com 8 valores.
- Tabelas: `videos`, `video_likes`, `push_subscriptions`.
- RPC `get_feed(p_limit int, p_offset int)` para listagem paginada.
- Função e cron job de retenção `cleanup_expired_videos()`.
- 3 triggers de notificação push.
- Bucket de Storage `videos` com policies.

## Entidades

### ENUM video_category

```sql
-- Migration 020 — criar TYPE antes da tabela
CREATE TYPE video_category AS ENUM (
  'smash', 'bandeja', 'vibora', 'saque',
  'tombo', 'furada', 'engracado', 'outras'
);
```

> Mesma convenção da feature 002: valores em ASCII, mapeamento humanizado
> ("Smash", "Bandeja", "Víbora", "Saque", "Tombo", "Furada", "Engraçado",
> "Outras") no client.

---

### videos

```sql
CREATE TABLE videos (
  id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     uuid           NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text           NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 80),
  category      video_category NOT NULL,
  storage_path  text           NOT NULL,
  created_at    timestamptz    NOT NULL DEFAULT now(),
  expires_at    timestamptz    NOT NULL DEFAULT (now() + interval '60 days')
);

CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_videos_expires_at ON videos(expires_at);
CREATE INDEX idx_videos_author     ON videos(author_id);
```

> `storage_path` é o path relativo no bucket `videos`, formato
> `{user_id}/{video_id}.{ext}`. URL pública obtida via
> `supabase.storage.from('videos').getPublicUrl(path)`.

---

### video_likes

```sql
CREATE TABLE video_likes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   uuid        NOT NULL REFERENCES videos(id)   ON DELETE CASCADE,
  profile_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, profile_id)
);

CREATE INDEX idx_video_likes_video ON video_likes(video_id);
```

---

### push_subscriptions

```sql
CREATE TABLE push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL UNIQUE,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_profile ON push_subscriptions(profile_id);
```

> `endpoint` é UNIQUE globalmente — cada device tem seu próprio endpoint.
> `p256dh` e `auth` são as keys de criptografia da subscription (Base64).

---

## RLS Policies (Migration 023)

### videos

```sql
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- SELECT: público para autenticados, mas apenas vídeos não-expirados via RPC.
-- Para acesso direto, dono vê tudo dele.
CREATE POLICY videos_select ON videos
  FOR SELECT TO authenticated
  USING (
    expires_at > now()
    OR author_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- INSERT: usuário só insere com author_id = próprio perfil
CREATE POLICY videos_insert_own ON videos
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- UPDATE: bloqueado (sem edição de vídeo no MVP da feature)
-- DELETE: apenas autor
CREATE POLICY videos_delete_own ON videos
  FOR DELETE TO authenticated
  USING (
    author_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
```

### video_likes

```sql
ALTER TABLE video_likes ENABLE ROW LEVEL SECURITY;

-- SELECT: usuário só vê suas próprias curtidas (privacidade — FR-011)
CREATE POLICY video_likes_select_own ON video_likes
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- INSERT: só insere com profile_id = próprio perfil
CREATE POLICY video_likes_insert_own ON video_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- DELETE: só remove curtida própria
CREATE POLICY video_likes_delete_own ON video_likes
  FOR DELETE TO authenticated
  USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- UPDATE: bloqueado (sem edição de curtida)
```

> **Importante**: a contagem agregada de curtidas é exposta via
> `get_feed()` SECURITY DEFINER, que faz `COUNT(*)` bypassando RLS. Sem
> isso, o COUNT do client retornaria apenas a curtida do próprio usuário
> (0 ou 1).

### push_subscriptions

```sql
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- SELECT: usuário só vê suas próprias subscriptions
CREATE POLICY push_subs_select_own ON push_subscriptions
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- INSERT: só insere com profile_id = próprio perfil
CREATE POLICY push_subs_insert_own ON push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- DELETE: só remove subscription própria (ou via Edge Function com service_role)
CREATE POLICY push_subs_delete_own ON push_subscriptions
  FOR DELETE TO authenticated
  USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- UPDATE: bloqueado (subscription é imutável; em caso de mudança, delete+insert)
```

### Storage bucket `videos`

> **Compromisso de segurança aceito (MVP)**: o bucket é público para
> leitura. A obscuridade do path (`{user_uuid_v4}/{video_uuid_v4}.ext`)
> oferece ~244 bits de entropia, tornando enumeração inviável. **Riscos
> aceitos**:
> 1. URLs vazadas (compartilhamento, screenshots, logs) permanecem
>    acessíveis até o arquivo ser deletado.
> 2. Listagem do bucket via API pública não é possível pela
>    configuração padrão do Supabase (`object listing` requer auth), mas
>    qualquer pessoa com a URL completa acessa o conteúdo.
>
> **Mitigação pós-MVP**: trocar para bucket privado + signed URLs (TTL
> 1h) geradas pela `get_feed()`. Decisão postergada até validar o produto.

```sql
-- Migration 027
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos', 'videos', true, 31457280,  -- 30 MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
);

CREATE POLICY videos_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY videos_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY videos_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## RPC: get_feed (Migration 024)

```sql
CREATE OR REPLACE FUNCTION get_feed(p_limit int DEFAULT 20, p_offset int DEFAULT 0)
RETURNS TABLE (
  id            uuid,
  author_id     uuid,
  author_name   text,
  author_avatar text,
  title         text,
  category      video_category,
  storage_path  text,
  created_at    timestamptz,
  like_count    int,
  viewer_liked  boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH viewer AS (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  SELECT
    v.id,
    v.author_id,
    p.name        AS author_name,
    p.avatar_url  AS author_avatar,
    v.title,
    v.category,
    v.storage_path,
    v.created_at,
    COALESCE(lc.cnt, 0)::int          AS like_count,
    EXISTS (
      SELECT 1 FROM video_likes vl
       WHERE vl.video_id = v.id
         AND vl.profile_id = (SELECT id FROM viewer)
    )                                 AS viewer_liked
  FROM videos v
  JOIN profiles p ON p.id = v.author_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt FROM video_likes WHERE video_id = v.id
  ) lc ON TRUE
  WHERE v.expires_at > now()
  ORDER BY v.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50))   -- clamp [1, 50]
  OFFSET GREATEST(0, p_offset);
$$;

REVOKE ALL ON FUNCTION get_feed(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_feed(int, int) TO authenticated;
```

> A função roda como `postgres` (definer), bypassando RLS para fazer
> `COUNT(*)` real em `video_likes`. Sem isso, a contagem retornaria apenas
> a curtida do próprio usuário.

---

## RPC: get_my_videos (Migration 024)

Lista vídeos do próprio usuário **incluindo expirados** (perfil → "Meus
vídeos"). Análoga a `get_feed` mas filtra por autor e remove o predicado
de expiração.

```sql
CREATE OR REPLACE FUNCTION get_my_videos(p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE (
  id            uuid,
  title         text,
  category      video_category,
  storage_path  text,
  created_at    timestamptz,
  expires_at    timestamptz,
  like_count    int
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    v.id,
    v.title,
    v.category,
    v.storage_path,
    v.created_at,
    v.expires_at,
    COALESCE(lc.cnt, 0)::int AS like_count
  FROM videos v
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt FROM video_likes WHERE video_id = v.id
  ) lc ON TRUE
  WHERE v.author_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  ORDER BY v.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100))
  OFFSET GREATEST(0, p_offset);
$$;

REVOKE ALL ON FUNCTION get_my_videos(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_videos(int, int) TO authenticated;
```

> Para o cliente, a presença de `expires_at <= now()` indica que o vídeo
> está aguardando o próximo job de retenção — pode ser exibido com badge
> "Expirando em breve" para feedback ao autor.

---

## RPC: delete_video (Migration 024 ou 026)

Atomicamente apaga linha + arquivo do Storage. Chamada via Edge Function
porque Storage delete só está disponível pela API HTTP, não SQL.

**Decisão simplificada para MVP**: o client faz 2 chamadas sequenciais
(delete do Storage, depois DELETE da linha). Se a primeira falhar, o
usuário vê erro e nada é alterado. Se a segunda falhar após a primeira ter
sucesso, fica um arquivo órfão — o cron de retenção limpa
periodicamente arquivos sem linha correspondente.

```ts
// services/feed.service.ts (client-side)
async function deleteVideo(videoId: string, storagePath: string) {
  const { error: storageErr } = await supabase.storage
    .from('videos').remove([storagePath]);
  if (storageErr) throw storageErr;

  const { error: dbErr } = await supabase
    .from('videos').delete().eq('id', videoId);
  if (dbErr) throw dbErr;  // arquivo já foi; órfão será coletado depois
}
```

---

## Cron: cleanup_expired_videos (Migration 025)

```sql
-- Função de cleanup (lote único — ver research §16)
CREATE OR REPLACE FUNCTION cleanup_expired_videos()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_count int;
BEGIN
  -- Agrega TODOS os vídeos expirados em um único array jsonb.
  SELECT jsonb_agg(jsonb_build_object(
           'video_id', id,
           'storage_path', storage_path
         )), count(*)
    INTO v_items, v_count
    FROM videos
   WHERE expires_at <= now();

  IF v_count = 0 OR v_items IS NULL THEN
    RETURN 0;
  END IF;

  -- 1 chamada HTTP para a Edge Function (vs N chamadas).
  PERFORM net.http_post(
    url := current_setting('app.edge_function_url') || '/cleanup-video',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.edge_function_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('items', v_items)
  );

  RETURN v_count;
END;
$$;

-- Agendamento diário às 03:00 UTC
SELECT cron.schedule(
  'cleanup-expired-videos',
  '0 3 * * *',
  $$ SELECT cleanup_expired_videos(); $$
);
```

> A Edge Function `cleanup-video` recebe `{ items: [{video_id, storage_path}] }`
> e executa em lote: `storage.remove(paths[])` + `DELETE FROM videos WHERE id
> IN (ids[])`. Ver research §4 e §16 para o código completo da função.

---

## Push de eventos (Migration 026)

> **Decisão de design**: para os eventos de **partida registrada** e
> **mudança de ranking**, push é disparado por **chamada explícita** dentro
> do `register_match` v3 (uma única vez ao final da transação), e não por
> triggers granulares em `match_players`/`profiles`.
>
> **Razão**: triggers AFTER UPDATE em `match_players` ou `profiles`
> disparam **4 vezes por partida** (1 por jogador), e o cálculo de posição
> via subconsulta veria valores parcialmente atualizados dos outros
> jogadores da mesma transação — gerando posições erradas e notificações
> inconsistentes.
>
> Para o evento de **liga**, mantemos trigger AFTER INSERT em
> `league_players` (é uma única linha por evento, sem efeito cruzado).

### Pré-requisitos

- Extensões habilitadas: `pg_net`, `pg_cron`.
- Settings configurados: `app.edge_function_url`, `app.edge_function_key`.
- Helper `is_league_member` da feature 002 (não usado aqui, mas referência).

### Helper compartilhado

```sql
-- Helper interno: dispara push (idempotente) se houver subscription ativa.
-- Usado pelo register_match v3 e pelo trigger de liga.
CREATE OR REPLACE FUNCTION enqueue_push_notification(
  p_profile_ids uuid[],
  p_title       text,
  p_body        text,
  p_url         text,
  p_tag         text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filtered uuid[];
BEGIN
  -- Mantém apenas profile_ids com subscription ativa (otimização HTTP).
  SELECT array_agg(DISTINCT ps.profile_id) INTO v_filtered
    FROM push_subscriptions ps
   WHERE ps.profile_id = ANY(p_profile_ids);

  IF v_filtered IS NULL OR cardinality(v_filtered) = 0 THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := current_setting('app.edge_function_url') || '/send-push-notification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.edge_function_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'profile_ids', to_jsonb(v_filtered),
      'title', p_title,
      'body',  p_body,
      'url',   p_url,
      'tag',   p_tag
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION enqueue_push_notification(uuid[], text, text, text, text) FROM PUBLIC;
-- Sem GRANT para authenticated: chamada apenas via SECURITY DEFINER de outras
-- funções (register_match v3, trigger de liga).
```

### (a) Partida registrada + (b) Mudança no ranking — `register_match` v3

Refatoração da RPC de registro de partida (substitui v2 da feature 002).
Após calcular o Elo, captura snapshot das posições antigas (do snapshot de
`points_before`) e novas, e dispara push **uma única vez**.

```sql
-- Migration 026 (parte da feature 003) — substitui register_match v2.
DROP FUNCTION IF EXISTS register_match(jsonb);

CREATE OR REPLACE FUNCTION register_match(payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
  r           RECORD;
  v_old_pos   int;
  v_new_pos   int;
  v_pos_delta int;
  v_dir       text;
BEGIN
  -- … (toda a lógica de validação e inserção da feature 002 v2 mantida) …
  -- Ver feature 002 / data-model.md → register_match v2 para o corpo completo.

  -- Após PERFORM apply_match_points(v_match_id):

  -- (a) Push de partida registrada — para cada participante não-criador
  FOR r IN
    SELECT mp.profile_id, mp.points_delta
      FROM match_players mp
     WHERE mp.match_id = v_match_id
       AND mp.profile_id <> v_creator
  LOOP
    PERFORM enqueue_push_notification(
      ARRAY[r.profile_id],
      'Nova partida registrada',
      CASE WHEN r.points_delta >= 0
           THEN 'Você ganhou ' || r.points_delta || ' pontos!'
           ELSE 'Você perdeu ' || abs(r.points_delta) || ' pontos.'
      END,
      '/profile/history',
      'match-' || v_match_id::text || '-' || r.profile_id::text
    );
  END LOOP;

  -- (b) Push de mudança no ranking ≥ 3 — para cada um dos 4 jogadores
  -- A posição "antes" é calculada usando o snapshot de points_before:
  --   contar quantos OUTROS perfis tinham (points, wins, losses) que
  --   ficariam à frente da DUPLA antes da partida.
  --
  -- IMPORTANTE: depois do apply_match_points, profiles.points/wins/losses
  -- já refletem os valores novos dos 4 jogadores desta partida. Para
  -- comparar "antes vs depois" sem viés de transação, contamos
  -- considerando o snapshot do match_player (points_before/wins_before/
  -- losses_before) só para os 4 desta partida; demais jogadores usam os
  -- valores atuais (que não mudaram nesta transação).
  FOR r IN
    SELECT
      mp.profile_id,
      mp.points_before,
      (p.wins   - CASE WHEN mp.result = 'W' THEN 1 ELSE 0 END) AS wins_before,
      (p.losses - CASE WHEN mp.result = 'L' THEN 1 ELSE 0 END) AS losses_before,
      p.points  AS points_after,
      p.wins    AS wins_after,
      p.losses  AS losses_after
    FROM match_players mp
    JOIN profiles p ON p.id = mp.profile_id
    WHERE mp.match_id = v_match_id
  LOOP
    -- Posição ANTES: 1 + quantos outros ficariam à frente dele
    -- usando o snapshot reconstruído + valores atuais dos demais.
    SELECT 1 + count(*) INTO v_old_pos
      FROM profiles other
      WHERE other.id <> r.profile_id
        AND NOT (other.id IN (
          SELECT profile_id FROM match_players WHERE match_id = v_match_id
        ))
        AND (other.points, other.wins, -other.losses)
            > (r.points_before, r.wins_before, -r.losses_before);

    -- Adicionar concorrentes da MESMA partida cujo "antes" estava à frente
    SELECT v_old_pos + count(*) INTO v_old_pos
      FROM match_players mp2
      JOIN profiles p2 ON p2.id = mp2.profile_id
      WHERE mp2.match_id = v_match_id
        AND mp2.profile_id <> r.profile_id
        AND (
              mp2.points_before,
              (p2.wins   - CASE WHEN mp2.result = 'W' THEN 1 ELSE 0 END),
              -(p2.losses - CASE WHEN mp2.result = 'L' THEN 1 ELSE 0 END)
            )
            > (r.points_before, r.wins_before, -r.losses_before);

    -- Posição DEPOIS: usa valores atuais (já refletem o resultado)
    SELECT 1 + count(*) INTO v_new_pos
      FROM profiles other
      WHERE other.id <> r.profile_id
        AND (other.points, other.wins, -other.losses)
            > (r.points_after, r.wins_after, -r.losses_after);

    v_pos_delta := v_old_pos - v_new_pos;
    IF abs(v_pos_delta) >= 3 THEN
      v_dir := CASE WHEN v_pos_delta > 0 THEN 'subiu' ELSE 'caiu' END;
      PERFORM enqueue_push_notification(
        ARRAY[r.profile_id],
        CASE WHEN v_pos_delta > 0 THEN 'Você subiu no ranking!'
             ELSE 'Mudança no ranking' END,
        'De ' || v_old_pos || 'º para ' || v_new_pos
          || 'º (' || v_dir || ' ' || abs(v_pos_delta) || ' posições)',
        '/ranking',
        'ranking-' || r.profile_id::text || '-' || v_match_id::text
      );
    END IF;
  END LOOP;

  RETURN v_match_id;
END;
$$;
```

> **Observação importante sobre `delete_match`**: a versão v2 da feature 002
> permanece válida — ela reverte pontos sem disparar push (não há requisito
> de push em exclusão de partida). Se quiséssemos, adicionaríamos chamada
> `enqueue_push_notification` análoga no final do `delete_match`.

### (c) Adicionado a liga — trigger AFTER INSERT

Diferente dos eventos de partida/ranking, este é um `AFTER INSERT` em uma
única linha — sem loop, sem snapshot. Trigger é seguro.

```sql
CREATE OR REPLACE FUNCTION notify_league_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_league_name text;
BEGIN
  SELECT owner_id, name INTO v_owner, v_league_name
    FROM leagues WHERE id = NEW.league_id;

  -- Não notifica autoadição do dono em create_league
  IF NEW.profile_id = v_owner THEN RETURN NEW; END IF;

  PERFORM enqueue_push_notification(
    ARRAY[NEW.profile_id],
    'Convite para liga',
    'Você foi adicionado à liga "' || v_league_name || '"',
    '/leagues/' || NEW.league_id::text,
    'league-' || NEW.league_id::text || '-' || NEW.profile_id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_league_added
  AFTER INSERT ON league_players
  FOR EACH ROW EXECUTE FUNCTION notify_league_added();
```

---

## Queries principais

### Feed paginado (uso normal pelo client)

```ts
const { data } = await supabase
  .rpc('get_feed', { p_limit: 20, p_offset: 0 });
// retorna 20 vídeos com author info, like count e viewer_liked
```

### Vídeos do próprio usuário (perfil → "Meus vídeos")

```sql
-- Aproveita a policy videos_select que inclui vídeos do próprio user
-- mesmo quando expirados.
SELECT v.*, COALESCE(lc.cnt, 0) AS like_count
FROM videos v
LEFT JOIN LATERAL (
  SELECT count(*) AS cnt FROM video_likes WHERE video_id = v.id
) lc ON TRUE
WHERE v.author_id = :current_profile_id
ORDER BY v.created_at DESC;
```

### Estado de subscription do usuário atual

```ts
const { data: subs } = await supabase
  .from('push_subscriptions')
  .select('id, endpoint, user_agent, created_at')
  .order('created_at', { ascending: false });
// Se subs.length > 0 → user tem ao menos 1 device com push ativo.
```
