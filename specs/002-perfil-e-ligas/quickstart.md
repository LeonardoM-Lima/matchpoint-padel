# Quickstart: Perfil e Ligas Privadas

## Pré-requisitos

Mesmos do MVP (Node 20+, pnpm 8+, Docker Desktop, Supabase CLI 1.x+).

---

## 1. Atualizar dependências

Nenhuma dependência nova nesta feature — `@supabase/supabase-js` já inclui o
client de Storage.

```bash
pnpm install
```

---

## 2. Aplicar novas migrations

```bash
# Garantir que o Supabase local está rodando
supabase start

# Aplicar todas as migrations (inclui 008–017 desta feature)
supabase db push

# (Opcional) Repopular dados de teste — seed.sql pode ser atualizado para
# incluir 1–2 ligas de exemplo, mas não é obrigatório.
supabase db seed
```

> Caso já tenha o banco do MVP rodando, basta `supabase db push` — as
> migrations 008+ são incrementais.

---

## 3. Variáveis de ambiente

Sem alterações em relação ao MVP. As mesmas `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` cobrem Storage automaticamente (mesma origem).

---

## 4. Iniciar o frontend

```bash
pnpm dev
# Disponível em http://localhost:5173
```

---

## 5. Executar testes da feature

```bash
# Testes específicos desta feature
pnpm test tests/integration/profile.test.ts
pnpm test tests/integration/leagues.test.ts
pnpm test tests/integration/match-league.test.ts
pnpm test tests/integration/storage.test.ts

# Suite completa (mantém compatibilidade com MVP)
pnpm test
```

---

## 6. Validar fluxos principais

### 6.1 Edição de perfil (US1)

1. Login com um jogador existente
2. Acessar **Perfil** no menu inferior
3. Clicar em **"Editar perfil"**
4. Alterar nickname, fazer upload de uma foto JPG/PNG/WebP (até 2MB), selecionar categoria
5. Salvar — confirmar que o avatar aparece nos cards de matchmaking e ranking

> **Critério (SC-001)**: alterações refletidas em < 5 s após salvar.

### 6.2 Criar liga e adicionar membros (US2 + US3)

1. Acessar **"Minhas Ligas"** no menu inferior
2. Clicar em **"Criar nova liga"**, informar nome e (opcional) foto de capa
3. Na tela da liga, clicar em **"Adicionar membro"**
4. Buscar outros jogadores pelo nickname e adicionar
5. Verificar que cada participante começa com **0 pontos** no ranking interno

> **Critério (SC-003)**: criar liga + adicionar 3 membros + 1ª partida em < 5 min.

### 6.3 Registrar partida vinculada a uma liga (US4)

1. Acessar **"Registrar Partida"**
2. Selecionar os 4 jogadores (todos da mesma liga)
3. O dropdown **"Vincular a uma liga"** deve aparecer ativo com a liga listada
4. Selecionar a liga e informar placar válido (ex: 6–4)
5. Após salvar, verificar:
   - Ranking global atualizado (`profiles.points` mudou)
   - Ranking interno da liga atualizado (`league_players.points` mudou)
   - Ambos com o **mesmo `delta` Elo** (mesma fórmula, K=32)

> **Critério (SC-002)**: ranking global + da liga atualizados em < 2 s.

### 6.4 Excluir partida vinculada dentro de 5 min

1. Após registrar a partida do passo anterior, clicar em **"Desfazer"** (countdown)
2. Confirmar que ambos os rankings reverteram para os valores anteriores

---

## 7. Supabase Studio — queries úteis

```sql
-- Verificar ranking interno de uma liga
SELECT
  p.name,
  lp.points,
  lp.wins,
  lp.losses,
  RANK() OVER (ORDER BY lp.points DESC, lp.wins DESC, lp.losses ASC) AS pos
FROM league_players lp
JOIN profiles p ON p.id = lp.profile_id
WHERE lp.league_id = '<uuid-da-liga>'
ORDER BY lp.points DESC;

-- Verificar histórico de pontuação numa liga
SELECT
  p.name, mlp.league_points_before, mlp.league_points_delta, mlp.league_points_after
FROM match_league_players mlp
JOIN profiles p ON p.id = mlp.profile_id
WHERE mlp.league_id = '<uuid-da-liga>'
ORDER BY mlp.match_id;

-- Verificar storage objects do bucket avatars
SELECT name, bucket_id, owner, created_at
FROM storage.objects
WHERE bucket_id = 'avatars'
ORDER BY created_at DESC;
```

---

## 8. Cenários de falha esperados (negative testing)

| Cenário | Resultado esperado |
|---------|-------------------|
| Upload de PNG com 3MB | Rejeitado: "Foto deve ser JPG, PNG ou WebP com até 2MB" |
| Upload de GIF | Rejeitado: MIME type não permitido |
| Não-dono adiciona membro | Erro RPC: "Apenas o dono da liga pode realizar esta ação" |
| Vincular partida com jogador não-membro | Erro RPC: "Todos os 4 jogadores devem participar da liga" |
| Acessar `/leagues/:id` sem ser participante | Tela mostra estado vazio/erro 403 |
| Dono tenta sair da própria liga | Erro: "O dono não pode sair da liga — exclua a liga" |

---

## 9. Estrutura de migrations adicionada

> **Ordem crítica**: `apply_match_points` v2 (016) precisa vir ANTES de
> `register_match` v2 (017) e `delete_match` v2 (018), pois ambos a chamam.

```
supabase/migrations/
├── 008_profile_avatar_category.sql      -- CREATE TYPE primeiro, depois ALTER profiles
├── 009_create_leagues.sql               -- tabela leagues (sem RLS)
├── 010_create_league_players.sql        -- tabela league_players (sem RLS)
├── 011_create_match_leagues.sql         -- match_leagues + match_league_players
├── 012_league_helper_functions.sql      -- is_league_member, is_league_owner (SECURITY DEFINER)
├── 013_league_rls_policies.sql          -- ENABLE RLS + policies que usam os helpers
├── 014_league_rpcs.sql                  -- create/update/add/remove/delete
├── 015_get_eligible_leagues.sql         -- RPC do dropdown
├── 016_apply_match_points_v2.sql        -- DROP + CREATE com Elo da liga
├── 017_register_match_v2.sql            -- depende de 016
├── 018_delete_match_v2.sql              -- depende de 016
└── 019_storage_buckets.sql              -- avatars + league-covers + policies
```

---

## 10. Deploy (produção)

```bash
# 1. Aplicar migrations no projeto hosted
supabase db push --project-ref <project-ref>

# 2. Confirmar buckets criados em Storage no painel do Supabase
# 3. Build e deploy (sem novas envs)
pnpm build
vercel deploy --prod
```

> **Atenção**: o plano free do Supabase tem limite de 1GB no Storage e 2GB de
> bandwidth/mês. Monitorar conforme os usuários começarem a fazer upload de
> fotos. Migrar para R2 caso bandwidth se torne gargalo.
