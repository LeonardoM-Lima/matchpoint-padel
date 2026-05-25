# Implementation Plan: Perfil e Ligas Privadas

**Branch**: `002-perfil-e-ligas` | **Date**: 2026-05-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-perfil-e-ligas/spec.md`

## Summary

Estende o MVP do MatchPoint com:

1. **Perfil personalizável**: foto (Supabase Storage) e categoria informativa
   (auto-declarada, coexistindo com o nível calculado por pontos).
2. **Ligas privadas**: jogadores criam ligas; donos adicionam/removem membros;
   ranking interno isolado começando com 0 pontos para cada membro.
3. **Vínculo opcional partida↔liga**: no momento do registro, dropdown lista
   ligas em que todos os 4 jogadores são membros. Quando vinculada, a partida
   atualiza tanto o ranking global quanto o ranking interno da liga em uma
   **transação atômica única** (mantém a garantia FR-021 do MVP).

O cálculo Elo da liga usa **a mesma fórmula e K-factor (32) do global**, mas
com base própria (`league_points_before` das duplas). Isso preserva
consistência matemática e isola a evolução de cada dimensão.

`delete_match` é estendida para reverter ambas as dimensões dentro da janela
de 5 minutos. A exclusão de uma liga preserva o histórico global (`league_id`
em `match_leagues` vira `NULL`).

## Data Access Patterns

### Mutation: Upload de avatar (`src/services/profile.service.ts`)

Upload via Supabase Storage no bucket `avatars`, path `{user_id}/avatar.{ext}`.
A URL pública é gerada com transformação 256×256 on-the-fly. Após o upload,
o path é persistido em `profiles.avatar_url`.

```ts
async function uploadAvatar(userId: string, file: File): Promise<string> {
  // 1. Validar client-side (FR-004)
  if (file.size > IMAGE_UPLOAD_LIMITS.maxBytes) throw new Error('Foto deve ter até 2MB');
  if (!IMAGE_UPLOAD_LIMITS.allowedMimeTypes.includes(file.type as never)) {
    throw new Error('Foto deve ser JPG, PNG ou WebP');
  }

  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${userId}/avatar.${ext}`;

  // 2. Upload (upsert sobrescreve avatar anterior)
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  // 3. Persistir path no profile (a UPDATE policy garante que só o próprio user)
  await supabase
    .from('profiles')
    .update({ avatar_url: path })
    .eq('user_id', userId);

  return path;
}
```

**URL pública com transformação** (gerada on-demand pelo client):

```ts
function getAvatarUrl(path: string, size: number = 256): string {
  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(path, { transform: { width: size, height: size, resize: 'cover' } });
  return data.publicUrl;
}
```

### Query: Ligas do usuário atual (`src/services/league.service.ts`)

Lista todas as ligas em que o usuário é dono ou participante, com contagem de
membros calculada server-side.

```ts
const { data } = await supabase
  .from('leagues')
  .select(`
    id, name, cover_url, owner_id, created_at, updated_at,
    league_players!inner ( profile_id ),
    member_count:league_players ( count )
  `)
  .eq('league_players.profile_id', currentProfileId)
  .order('created_at', { ascending: false });
// is_owner = data[i].owner_id === currentProfileId (calculado no client)
```

### Query: Ranking interno da liga (`src/services/league.service.ts`)

```ts
const { data } = await supabase
  .from('league_players')
  .select(`
    profile_id, points, wins, losses,
    profiles ( name, avatar_url, category )
  `)
  .eq('league_id', leagueId)
  .order('points', { ascending: false })
  .order('wins',   { ascending: false })
  .order('losses', { ascending: true  });

// position e level derivados no client (RANK simples + CASE)
```

### Query: Ligas elegíveis para vincular à partida em registro

Após os 4 jogadores serem selecionados:

```ts
const { data: eligible } = await supabase
  .rpc('get_eligible_leagues_for_match', {
    p_player_ids: selectedPlayerIds, // 4 UUIDs
  });
// Popula o dropdown "Vincular a uma liga"
```

A RPC retorna apenas ligas em que todos os 4 jogadores são participantes
(FR-021). Estado padrão do dropdown: "Nenhuma".

### Mutation: register_match com vínculo de liga

```ts
const payload: RegisterMatchPayloadV2 = {
  teamAScore, teamBScore, players,
  leagueId: selectedLeagueId ?? undefined,
};

const { data: matchId } = await supabase
  .rpc('register_match', toRegisterMatchRPCV2(payload));
```

Em caso de falha por elegibilidade (`Todos os 4 jogadores devem participar da
liga`), o erro é exibido ao usuário e a partida não é registrada — o cliente
deve permitir desfazer o vínculo e tentar de novo, ou remover o vínculo no
formulário.

## Technical Context

**Language/Version**: TypeScript strict, React 18, Node 20+ (dev)
**Primary Dependencies**: stack do MVP + Supabase Storage (já incluso em
`@supabase/supabase-js`). Nenhuma dependência nova.
**Storage**: PostgreSQL (Supabase) + Supabase Storage (buckets `avatars` e
`league-covers`, ambos públicos para read, limite 2MB, MIME types JPG/PNG/WebP).
**Testing**: Vitest + Testing Library; Supabase local com `supabase start` para
testes de integração (mesma stratégia do MVP).
**Target Platform**: Web mobile-first (≤ 390 px); path para React Native preservado.
**Project Type**: web-app (BaaS — sem backend separado).
**Performance Goals**:
  - Edição de perfil refletida em < 5 s (SC-001).
  - Upload de foto em < 3 s em 4G (SC-004).
  - Registro de partida vinculada mantém SC-002 do MVP (< 2 s).
**Constraints**:
  - Mesma estratégia de segurança do MVP (RLS + SECURITY DEFINER para mutações
    sensíveis).
  - Storage policies escopadas por `auth.uid()` para `avatars`.
  - Liga só visível para dono e participantes.
  - Partida vinculada atualiza ambos os contadores em uma única transação.
**Scale/Scope**: incremento do MVP — 50–500 ligas, 5–30 membros por liga,
fotos 50–200 KB cada.

## Constitution Check

| Princípio | Status | Evidência |
|-----------|--------|-----------|
| I. Simplicidade | ✅ PASS | Sem novas dependências; Storage e ligas em PostgreSQL puro |
| II. Spec como Fonte da Verdade | ✅ PASS | FRs cobrem todos os comportamentos; data-model alinhado |
| III. Mobile-First | ✅ PASS | Telas seguem container `max-w-md` e touch targets ≥ 44 px |
| IV. Fluxo Principal Protegido | ✅ PASS | US1+US4 são P1; vínculo de liga não altera fluxo padrão |
| V. Segurança Básica | ✅ PASS | RLS em todas as novas tabelas; Storage policies por owner |
| VI. Testes de Regras Críticas | ✅ PASS | 8 testes de integração cobrindo Storage, ligas e atomicidade |
| VII. Integridade de Dados | ✅ PASS | FKs, UNIQUE (league_id, profile_id), CASCADE controlados |

**Sem violações → Complexity Tracking fica vazio.**

## Project Structure

### Documentation (esta feature)

```text
specs/002-perfil-e-ligas/
├── plan.md              # Este arquivo
├── research.md          # Decisões técnicas (Storage, Elo da liga, etc)
├── data-model.md        # Schema + RPCs (v1 + v2)
├── quickstart.md        # Subir o ambiente e validar
├── contracts/
│   ├── types.ts         # DTOs e payloads (ProfileDTO estendido, LeagueDTO, etc)
│   └── rpc.ts           # Adapters camelCase ↔ snake_case
├── checklists/
│   └── requirements.md  # Revisão de qualidade dos requisitos
└── tasks.md             # Gerado por /speckit-tasks
```

### Source Code (incremento sobre o MVP)

```text
src/
├── services/
│   ├── profile.service.ts          # NOVO: updateProfile, uploadAvatar
│   ├── league.service.ts           # NOVO: CRUD de ligas, members, ranking
│   └── match.service.ts            # ESTENDE: registerMatch agora aceita leagueId
├── hooks/
│   ├── useProfile.ts                # ESTENDE: expõe updateProfile + avatar
│   ├── useLeagues.ts                # NOVO: lista "Minhas Ligas"
│   ├── useLeague.ts                 # NOVO: detalhe + ranking interno
│   └── useEligibleLeagues.ts        # NOVO: dropdown de vínculo na partida
├── screens/
│   ├── ProfileScreen.tsx            # ESTENDE: botão "Editar perfil"
│   ├── EditProfileScreen.tsx        # NOVO: edição de nome/foto/categoria
│   ├── LeaguesScreen.tsx            # NOVO: "Minhas Ligas"
│   ├── LeagueDetailScreen.tsx       # NOVO: detalhe + ranking + admin
│   ├── CreateLeagueScreen.tsx       # NOVO: criar nova liga
│   ├── AddLeagueMemberScreen.tsx    # NOVO: busca de jogador e add à liga
│   └── RegisterMatchScreen.tsx      # ESTENDE: dropdown de liga após 4 jogadores
├── components/
│   ├── Avatar.tsx                   # ESTENDE: aceita avatarUrl além de iniciais
│   ├── ImageUpload.tsx              # NOVO: validação client + upload p/ Supabase
│   ├── LeagueCard.tsx               # NOVO: card da liga em listagens
│   ├── LeagueRankingRow.tsx         # NOVO: linha do ranking interno
│   ├── CategoryBadge.tsx            # NOVO: badge informativo da categoria
│   └── LeagueSelector.tsx           # NOVO: dropdown na tela de partida
└── router/
    └── index.tsx                    # ESTENDE: rotas /leagues, /leagues/:id, /profile/edit

supabase/
└── migrations/
    ├── 008_profile_avatar_category.sql      # CREATE TYPE + ALTER profiles
    ├── 009_create_leagues.sql                # tabela leagues (sem RLS)
    ├── 010_create_league_players.sql         # tabela league_players (sem RLS)
    ├── 011_create_match_leagues.sql          # match_leagues + match_league_players
    ├── 012_league_helper_functions.sql       # is_league_member, is_league_owner
    ├── 013_league_rls_policies.sql           # ENABLE RLS + policies usando helpers
    ├── 014_league_rpcs.sql                   # create/update/add/remove/delete
    ├── 015_get_eligible_leagues.sql          # dropdown da tela de partida
    ├── 016_apply_match_points_v2.sql         # Elo da liga
    ├── 017_register_match_v2.sql             # depende de apply_v2
    ├── 018_delete_match_v2.sql               # depende de apply_v2
    └── 019_storage_buckets.sql               # avatars + league-covers

tests/
└── integration/
    ├── profile.test.ts              # NOVO: avatar upload, edição
    ├── leagues.test.ts              # NOVO: CRUD + members + permissões
    ├── match-league.test.ts         # NOVO: partida vinculada + atomicidade
    └── storage.test.ts              # NOVO: RLS de buckets
```

**Structure Decision**: Mantém a separação `services → hooks → screens` do
MVP. Toda a lógica de domínio (Elo da liga, validação de elegibilidade)
permanece no banco via RPC. Storage é acessado direto pelo client com policies.

## Complexity Tracking

> **Sem violações da constituição — seção vazia.**
