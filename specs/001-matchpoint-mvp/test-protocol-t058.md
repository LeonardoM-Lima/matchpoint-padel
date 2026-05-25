# Protocolo de teste — T058 (5 jogadores reais)

**Objetivo**: validar SC-004 — "Em teste com 5 jogadores reais, todos completam
o fluxo cadastro → registrar partida → ver ranking **sem ajuda externa**".

**Quando rodar**: após T057 (migrations aplicadas no hosted) e T052 (validação
de DevTools mobile).

---

## Setup (você, antes da sessão)

1. **App disponível em URL pública**. Local (`localhost:5173`) não serve —
   testadores precisam acessar do próprio celular. Opções:
   - Deploy na Vercel/Netlify (preferível — replica produção).
   - `vite --host` + ngrok / tailscale (rápido, mas não é produção).
2. **5 voluntários** que NÃO conhecem o app. Ideal: amigos jogadores de padel.
   Cada um precisa do próprio celular com Chrome ou Safari.
3. **WhatsApp aberto** com o link do app pronto para enviar.
4. **Folha de observação** (impressa ou no notebook) — modelo abaixo.

---

## Roteiro (ler ANTES de cada testador começar)

Diga em voz alta, exatamente isto:

> "Você vai testar um app de ranking de padel. Eu **não vou te ajudar**.
> Se você travar, fala em voz alta o que está pensando — eu só vou anotar.
> Se ficar perdido por mais de 2 minutos numa etapa, podemos pular.
>
> **Sua missão**: criar uma conta, registrar uma partida de padel fictícia
> entre 4 jogadores, e me mostrar a sua nova posição no ranking. Pode
> começar."

Em seguida:
- **Não responda perguntas** até o teste acabar.
- **Não toque no celular** do testador.
- Anote tudo que ele perguntar, hesitar ou errar.

---

## Folha de observação (1 por testador)

```
Testador #_____  Nome:_________________  Idade:____  Joga padel: [ ]Sim [ ]Não

⏱️  Tempo total (cadastro → ranking visto):  ___ min ___ s

Etapas (marque ✓ se concluiu sozinho, ✗ se travou):

[ ] Achou a tela de cadastro
[ ] Preencheu email, senha e nickname sem ajuda
[ ] Navegou até "Registrar Partida"
[ ] Selecionou 4 jogadores (entendeu que precisa de outros usuários)
[ ] Atribuiu times A e B sem confusão
[ ] Preencheu placar válido na primeira tentativa
[ ] Clicou em "Salvar partida"
[ ] Encontrou sua posição no ranking sem perguntar

Pontos de fricção observados (literal):
─────────────────────────────────────────────────────────────────────
1.

2.

3.

Pergunta inesperada / mal-entendido:
─────────────────────────────────────────────────────────────────────


Comentário final do testador ("o que você achou?"):
─────────────────────────────────────────────────────────────────────



Sucesso? [ ]Sim, sem ajuda  [ ]Sim, com 1 dica  [ ]Não conseguiu
```

---

## Critério de aprovação (SC-004)

- **PASS**: 5/5 testadores marcam "Sim, sem ajuda" OU "Sim, com 1 dica".
- **NEEDS WORK**: 4/5 com sucesso e fricções recorrentes anotadas.
- **FAIL**: 3/5 ou menos. Repensar UX antes de qualquer feature nova.

---

## O que fazer com os resultados

1. **Agregue as fricções** em 3-5 categorias (ex: "não entendeu seleção de
   jogadores", "placar inválido sem explicação").
2. **Cada categoria com 3+ ocorrências** vira issue de UX para resolver
   antes de implementar feature 002 ou 003.
3. **Marque T058 como ✅** apenas se 5/5 conseguiram.

---

## Checklist final da T058

- [ ] App deployado em URL pública
- [ ] 5 testadores convidados e disponíveis
- [ ] Folhas de observação preparadas
- [ ] Sessões executadas (estime 15 min por testador)
- [ ] Resultados agregados em um doc
- [ ] Critério SC-004 avaliado → PASS / NEEDS WORK / FAIL
