# Research: Perfil e Ligas Privadas

**Branch**: `002-perfil-e-ligas` | **Date**: 2026-05-22

## Decisions

### 1. Upload de imagens: Supabase Storage

**Decision**: Usar Supabase Storage com dois buckets — `avatars` (fotos de
perfil) e `league-covers` (capas de liga).

**Rationale**:
- Já está integrado ao projeto via `@supabase/supabase-js` — sem dependência
  nova (Princípio I — Simplicidade).
- RLS no Storage permite escopo de escrita por usuário sem código custom
  (Princípio V — Segurança).
- Plano free do Supabase oferece 1GB storage + 2GB bandwidth/mês, suficiente
  para MVP (5–50 usuários × ~50KB por avatar 256×256 = ~2,5MB total).
- Transformação on-the-fly via query params (`?width=256&height=256&resize=cover`)
  evita necessidade de redimensionamento server-side.

**Limites adotados**:
- Tamanho máximo: 2MB por upload (validação no client e no Storage policy).
- Formatos aceitos: `image/jpeg`, `image/png`, `image/webp` (`Content-Type`).
- Dimensão de exibição: 256×256 (transformação Supabase).

**Alternatives considered**:
- Cloudflare R2: Mais barato em escala e bandwidth ilimitado, porém adiciona
  segundo provider e setup. Reavaliar quando volume crescer.
- AWS S3: Configuração mais pesada; sem ganho versus Supabase no MVP.
- Base64 no banco: Inflate o tamanho das linhas em `profiles`; degrada
  performance de queries — descartado.

---

### 2. Foto de perfil: armazenamento da URL

**Decision**: Armazenar em `profiles.avatar_url` apenas o **path relativo** do
arquivo no bucket (ex: `avatars/{user_id}/avatar.webp`), não a URL pública
completa.

**Rationale**:
- URLs completas mudam se o domínio Supabase mudar (ex: migração de projeto).
- Path relativo permite gerar URL pública on-the-fly via
  `supabase.storage.from('avatars').getPublicUrl(path)`.
- Suporta transformações dinâmicas (`?width=256`) sem necessidade de
  reprocessar/persistir múltiplos tamanhos.

**Convention**: Path = `{user_id}/avatar.{ext}` (sobrescreve a cada upload —
um avatar por usuário). Buckets têm `public = true` para leitura aberta.

---

### 3. Categoria do perfil: enum coexistente com nível

**Decision**: Adicionar coluna `category` como ENUM PostgreSQL, opcional
(nullable). Não substitui o nível calculado por pontos.

**Valores permitidos**:
```
'1ª', '2ª', '3ª', '4ª', '5ª', '6ª', 'Open', 'Iniciante'
```

**Rationale**:
- Categoria é auto-declarada (jogador escolhe a categoria em que joga torneios
  reais). Não tem relação com Elo do app.
- Nível (Iniciante/Amador/Avançado) continua sendo derivado de `points` em
  `SELECT` — sem custo de armazenamento.
- ENUM no Postgres garante integridade e permite extensão futura (ALTER TYPE
  ADD VALUE).

**Alternatives considered**:
- Texto livre: Permite valores inconsistentes (`"1"`, `"1a"`, `"1ª categoria"`).
- Tabela `categories` separada: Over-engineering para 8 valores estáveis.

---

### 4. Modelo de ligas: tabelas separadas com contadores dedicados

**Decision**: 4 entidades — `leagues`, `league_players`, `match_leagues`,
`match_league_players`.

**Por que não reutilizar `match_players` para a liga?**

`match_players` armazena `points_before/delta/after` referenciando
`profiles.points` (ranking global). Reaproveitar essas colunas para a dimensão
liga quebraria a separação de contextos: o mesmo jogador tem pontos diferentes
no global e em cada liga. Adicionar colunas `league_points_*` em
`match_players` poluiria a tabela quando a partida não tem liga vinculada
(maioria dos casos esperados).

**Decisão**: tabela paralela `match_league_players` que só existe quando há
vínculo. Mantém `match_players` enxuto e isola a lógica de liga.

**Cardinalidade**:
- 1 partida → 0 ou 1 liga (`match_leagues.match_id` UNIQUE).
- 1 liga → N partidas.
- 1 jogador → N ligas (`league_players` é a N:N entre profiles e leagues).
- 1 partida vinculada a 1 liga → 4 registros em `match_league_players`
  (um por jogador, espelhando `match_players`).

---

### 5. Cálculo Elo dentro da liga: mesmo K-factor, base de pontos própria

**Decision**: Elo da liga usa a mesma fórmula e K=32 do global, mas substitui
`points_before` por `league_points_before` na média da dupla.

**Por que não usar a mesma variação do global?**

Se aplicássemos o mesmo `delta` global aos `league_points`, partidas em que os
jogadores têm pontuação global muito diferente da pontuação de liga gerariam
deltas incoerentes — ex: jogador com 1500 global e 50 liga não deveria receber
poucos pontos na liga só porque global o vê como favorito.

**Decisão**: cada dimensão calcula seu próprio Elo:

```
-- ranking global (atual)
exp_winner_global = 1 / (1 + 10 ^ ((avg_loser_global  - avg_winner_global) / 400))
delta_global      = round(32 * (sign - exp_winner_global))

-- ranking da liga (novo, dentro da mesma RPC)
exp_winner_league = 1 / (1 + 10 ^ ((avg_loser_league  - avg_winner_league) / 400))
delta_league      = round(32 * (sign - exp_winner_league))
```

`points_after_league` aplica o piso 0 (FR-007 estendido).

**Inicialização**: jogadores entram na liga com `points = 0`. Para evitar
deltas instáveis (todos com 0 → empate perfeito), os primeiros jogos terão
delta = ±16 (que é o resultado natural da fórmula com avg iguais e K=32).
Isso é aceitável e até desejável para o MVP da feature.

---

### 6. Vínculo partida↔liga: dropdown opcional no fluxo existente

**Decision**: Adicionar campo opcional no `RegisterMatchScreen` em vez de criar
fluxo separado.

**Rationale**:
- Atende ao requisito explícito do usuário: "dividir em 2 telas de criação de
  partida não seria bom".
- Simplifica a mental model: registro de partida é único; vincular a uma liga
  é decoração opcional.
- O dropdown é populado dinamicamente após os 4 jogadores serem selecionados —
  a query "ligas em que todos participam" só faz sentido com a lista completa.

**Lógica do dropdown** (frontend, sem round-trip a cada keystroke):

```ts
// Após selecionar os 4 jogadores:
const { data: eligibleLeagues } = await supabase
  .rpc('get_eligible_leagues_for_match', {
    player_ids: [p1, p2, p3, p4]
  });
// RPC retorna apenas ligas onde all 4 player_ids são participantes.
```

**Validação no backend**: o `register_match` recebe `league_id` opcional;
se presente, valida server-side que todos os 4 jogadores são participantes
antes de aplicar o Elo da liga. Falha em qualquer validação → rollback total.

---

### 7. Reversão em delete_match: estendida para a liga

**Decision**: `delete_match` MUST reverter ambas as dimensões quando há vínculo.

**Lógica**:
```sql
-- Para cada match_player:
UPDATE profiles SET points = points_before, ...

-- Se houver match_league_player correspondente:
UPDATE league_players SET points = league_points_before, ...
```

Tudo em uma única transação (SECURITY DEFINER). Rollback automático em caso de
qualquer falha — mantém a invariante FR-021 do MVP estendida para a liga.

---

### 8. Storage: políticas RLS

**Decision**: Buckets `avatars` e `league-covers` são públicos para leitura
(qualquer um pode visualizar fotos), mas só o dono do recurso pode escrever.

**Policies**:
```sql
-- avatars: usuário só sobrescreve a própria pasta
CREATE POLICY avatars_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- league-covers: só o dono da liga sobe (validação no RPC, não no Storage)
-- Storage policy: qualquer authenticated escreve em league-covers/{league_id}/...
-- A garantia de "só dono" vem do RPC que gera o signed upload URL.
```

**Rationale**: Storage policies só conseguem validar contra `auth.uid()`,
não contra "é dono da liga X". Por isso, restrição de dono de liga é validada
no RPC `update_league_cover` que retorna URL assinada de upload (path
controlado).

---

### 9. Validação de imagem no client

**Decision**: Validação dupla — client (UX imediata) + Storage policy
(autoridade final).

**Client (antes do upload)**:
```ts
function validateImage(file: File): string | null {
  if (file.size > 2 * 1024 * 1024) return 'Imagem maior que 2MB';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Formato deve ser JPG, PNG ou WebP';
  }
  return null;
}
```

**Storage policy** (defesa em profundidade):
```sql
-- Limita file size via bucket settings:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']);
```

---

### 10. Redimensionamento: transformação Supabase

**Decision**: Não redimensionar na origem — usar query params do Supabase
para gerar versão 256×256 on-the-fly.

```ts
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl(path, {
    transform: { width: 256, height: 256, resize: 'cover' }
  });
// Retorna URL tipo: https://.../avatars/{user_id}/avatar.webp?width=256&height=256
```

**Rationale**:
- Sem CPU cost no client/server para resize.
- Múltiplas resoluções no futuro (ex: thumbnail 64×64 para listas) sem
  reprocessar nada.
- Supabase Pro inclui essas transformações gratuitamente; no free tier estão
  limitadas mas ainda suficientes para MVP.

**Alternative considered**: Resize client-side com `canvas` antes do upload.
Economiza bandwidth mas adiciona complexidade — adiar para se virar gargalo.

---

### 11. Casos de teste críticos desta feature

**11 testes de integração a serem escritos**:

1. **Storage**: usuário só consegue sobrescrever o próprio avatar (RLS).
2. **Storage**: upload de arquivo > 2MB rejeitado.
3. **Storage**: upload de `image/gif` rejeitado.
4. **Leagues**: criar liga adiciona o criador automaticamente como participante
   com 0 pontos.
5. **Leagues**: adicionar mesmo jogador 2× → erro `LEAGUE_PLAYER_DUPLICATE`.
6. **Leagues**: não-dono tenta excluir liga → erro
   `LEAGUE_DELETE_FORBIDDEN`.
7. **Match-League integration**: registrar partida vinculada atualiza
   `profiles.points` E `league_players.points` consistentemente.
8. **Match-League integration**: `delete_match` reverte global E liga
   atomicamente; falha em qualquer reversão = rollback total.
9. **Match-League Elo (caso de fronteira 0×0)**: primeira partida da liga
   (todos os 4 jogadores com `league_points = 0`) → deltas equilibrados
   ±16 (mesma fórmula com avg iguais e K=32); perdedores ficam com 0 pontos
   (piso aplicado), não negativo.
10. **Liga excluída antes do delete_match**: criador exclui a liga, depois
    tenta `delete_match` dentro da janela de 5 min → reversão global ocorre
    normalmente; `league_id` em `match_leagues` é `NULL` (SET NULL),
    `league_players` já foi removido via CASCADE → nenhuma operação de liga.
11. **RLS sem recursão**: SELECT em `league_players` por participante funciona
    (helper `is_league_member` não dispara loop infinito); SELECT por
    não-participante retorna zero linhas.

---

### 12. Migrations: ordem e numeração

**Decision**: Continuar a numeração do MVP (`008+`).

**Sequência** (ordem crítica — `apply_match_points` v2 ANTES de
`register_match` v2 e `delete_match` v2, pois ambos chamam a função):

```
supabase/migrations/
├── 008_profile_avatar_category.sql      -- CREATE TYPE + ALTER profiles
├── 009_create_leagues.sql               -- tabela leagues (sem RLS ainda)
├── 010_create_league_players.sql        -- tabela league_players (sem RLS ainda)
├── 011_create_match_leagues.sql         -- match_leagues + match_league_players
├── 012_league_helper_functions.sql      -- is_league_member() SECURITY DEFINER
│                                           (quebra recursão de RLS — ver §13)
├── 013_league_rls_policies.sql          -- ENABLE RLS + policies usando helpers
├── 014_league_rpcs.sql                  -- create/update/add/remove/delete
├── 015_get_eligible_leagues.sql         -- RPC para popular dropdown
├── 016_apply_match_points_v2.sql        -- DROP+CREATE com Elo da liga
├── 017_register_match_v2.sql            -- depende de apply_match_points v2
├── 018_delete_match_v2.sql              -- depende de apply_match_points v2
└── 019_storage_buckets.sql              -- buckets avatars + league-covers + policies
```

**Rationale para `_v2`**: PostgreSQL não suporta `CREATE OR REPLACE FUNCTION`
quando a assinatura muda (parâmetros novos). Usamos `DROP FUNCTION IF EXISTS`
+ `CREATE FUNCTION` para evitar quebra. Funções antigas são substituídas
sem perda de comportamento — todos os call sites passam a usar a v2.

**Dependências entre migrations**:
- `014` (RPCs administrativas) depende de `013` (RLS) — RPCs SECURITY DEFINER
  precisam contornar RLS, mas as policies devem existir.
- `017` e `018` dependem de `016` (apply_match_points v2 já carregada).
- `015` depende de `013` (helper functions usados na policy podem ser usados
  na função `get_eligible_leagues_for_match`).
- `019` (Storage) depende de `008` (avatar_url existe em profiles) e `009`
  (leagues existe para validar dono de cover).

---

### 13. Quebra de recursão em RLS de `league_players`

**Problema**: a policy ingênua para `league_players_select` lê a própria
`league_players` (para checar se o caller é membro), o que **dispara a mesma
policy recursivamente** e o PostgreSQL aborta com erro.

**Decision**: usar uma `SECURITY DEFINER` helper function que ignora RLS na
leitura interna.

```sql
-- Migration 012
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

-- Acesso à função restrito a authenticated (não revoga RLS de tabelas)
REVOKE ALL ON FUNCTION is_league_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_league_member(uuid) TO authenticated;
```

Policies passam a usar `is_league_member()`:

```sql
CREATE POLICY league_players_select ON league_players
  FOR SELECT TO authenticated
  USING (is_league_member(league_id));
```

**Rationale**:
- `SECURITY DEFINER` executa a query interna com privilégios do owner da função
  (postgres), bypassando RLS. Sem isso, o `SELECT 1 FROM league_players` dentro
  da policy reinvocaria a mesma policy → loop infinito.
- `STABLE` permite ao planner cachear o resultado dentro da mesma query.
- `SET search_path = public` evita ataques de search_path em funções
  SECURITY DEFINER (boa prática Supabase).

Função auxiliar análoga para `is_league_owner(p_league_id uuid)` (usada em
`leagues_select` para owner que ainda não foi adicionado em `league_players`
— embora `create_league` já garanta isso, é defesa em profundidade).
