# Quickstart: MVP EvoPadel

## Pré-requisitos

| Ferramenta | Versão mínima | Instalação |
|------------|--------------|------------|
| Node.js | 20+ | nodejs.org |
| pnpm | 8+ | `npm i -g pnpm` |
| Docker Desktop | qualquer | docker.com |
| Supabase CLI | 1.x+ | `npm i -g supabase` |

---

## 1. Clonar e instalar dependências

```bash
git clone <repo-url>
cd evopadel
pnpm install
```

---

## 2. Supabase local

```bash
# Iniciar PostgreSQL + Auth + PostgREST localmente
supabase start
```

A saída exibirá as credenciais locais — anote a `API URL` e o `anon key`:

```
API URL:     http://localhost:54321
anon key:    eyJ...
Studio URL:  http://localhost:54323
```

```bash
# Aplicar todas as migrations
supabase db push

# (Opcional) Popullar com jogadores de teste
supabase db seed
```

---

## 3. Variáveis de ambiente

Crie o arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<anon key exibido pelo supabase start>
```

---

## 4. Iniciar o frontend

```bash
pnpm dev
# App disponível em: http://localhost:5173
```

---

## 5. Executar testes

```bash
# Garantir que o Supabase local está rodando antes de rodar os testes
supabase start

# Rodar todos os testes
pnpm test

# Rodar apenas testes de integração (Elo, partida, ranking, auth)
pnpm test tests/integration/

# Rodar em modo watch
pnpm test --watch
```

---

## 6. Validar o fluxo principal (US1 — Core Flow)

1. Abrir **http://localhost:5173**
2. Clicar em **"Criar conta"** → inserir email, senha e nickname
3. Na home, clicar em **"Registrar Partida"**
4. Selecionar 4 jogadores (crie contas adicionais para testar)
5. Informar placar de ao menos 1 set válido (ex: **6–4**)
6. Confirmar e verificar pontos atualizados na **home** e no **ranking**

> **Critério de sucesso (SC-001)**: fluxo completo em < 3 minutos no celular.

---

## 7. Supabase Studio (GUI do banco)

```
http://localhost:54323
```

Use para inspecionar tabelas, executar queries SQL, testar RLS policies e
verificar o conteúdo de `match_players` após um registro.

**Queries úteis para validação**:

```sql
-- Verificar ranking com desempate
SELECT name, points, wins, losses,
  CASE WHEN points < 800 THEN 'Iniciante'
       WHEN points < 1300 THEN 'Amador'
       ELSE 'Avançado' END AS level,
  RANK() OVER (ORDER BY points DESC, wins + losses DESC) AS position
FROM profiles ORDER BY points DESC;

-- Verificar histórico de pontuação de uma partida
SELECT p.name, mp.team, mp.result,
  mp.points_before, mp.points_delta, mp.points_after
FROM match_players mp
JOIN profiles p ON p.id = mp.profile_id
WHERE mp.match_id = '<uuid da partida>';
```

---

## 8. Estrutura de migrations

```
supabase/migrations/
├── 001_create_profiles.sql         -- tabela + trigger de signup
├── 002_create_matches.sql          -- tabela de partidas
├── 003_create_match_players.sql    -- histórico de participação/pontuação
├── 004_rls_policies.sql            -- RLS em todas as tabelas
├── 005_apply_match_points.sql      -- função Elo (SECURITY DEFINER)
├── 006_register_match.sql          -- RPC principal (SECURITY DEFINER)
└── 007_delete_match.sql            -- RPC de exclusão com reversão
```

---

## 9. Deploy (produção)

### Supabase hosted

```bash
# 1. Criar projeto em supabase.com e copiar o Project Ref
# 2. Aplicar migrations ao projeto hosted
supabase db push --project-ref <project-ref>
```

### Vercel

```bash
# Build de produção
pnpm build

# Definir variáveis de ambiente no painel da Vercel:
# VITE_SUPABASE_URL  =  https://<project-ref>.supabase.co
# VITE_SUPABASE_ANON_KEY  =  <anon key do projeto hosted>

# Deploy
vercel deploy --prod
```
