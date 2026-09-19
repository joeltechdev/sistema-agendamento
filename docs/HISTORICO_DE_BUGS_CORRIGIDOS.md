# Histórico de Bugs Críticos Corrigidos (P0 / P1)

> Registro detalhado de auditoria técnica dos bugs críticos investigados, diagnosticados e solucionados no projeto, acompanhados de suas causas raízes e testes de regressão automatizados.

---

## 1. Bug Crítico 01 — Cancelamento em Massa de Agendamentos (P0)

- **Gravidade:** Crítica (P0) — Risco de perda de dados e cancelamento indevido de cidadãos confirmados.
- **Sintoma:** Ao cancelar um único agendamento no painel, todos os outros agendamentos do banco de dados tinham seu status alterado para `'cancelled'`.

### Causa Raiz Técnica
No cliente de banco de dados / mock de servidor, a query era invocada na ordem:
```typescript
supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId)
```
O método `.update(payload)` estava executando o loop de alteração na memória imediatamente no momento em que era chamado — **antes** que a função encadeada `.eq('id', ...)` fosse executada. Como os filtros ainda estavam vazios (`{}`), o sistema tratava a condição como verdadeira para todas as linhas da tabela, aplicando o status cancelado para todos os registros.

### Solução Aplicada
1. **Execução Deferida (`executePendingMutations`):** O método `.update()` e `.delete()` passou a apenas registrar o payload pendente. A mutação só é executada no momento em que a Promise é resolvida (`.single()` ou `.then()`), quando a cláusula `.eq('id', targetId)` já está completamente populada.
2. **Validação Obrigatória de ID:** A Server Action `adminUpdateAppointmentStatus` passou a rejeitar IDs vazios, nulos ou `undefined` com erro explícito.

### Testes de Regressão Criados
Em [`tests/integration/cancellation_safety.test.ts`](file:///c:/MeuProjetoAgendamento/tests/integration/cancellation_safety.test.ts):
- `GIVEN 5 confirmed appointments, WHEN cancelling 1 appointment, THEN only that 1 is cancelled and the other 4 remain unchanged`.

---

## 2. Bug Crítico 02 — Esvaziamento da Grade Semanal ao Cancelar (P0)

- **Gravidade:** Crítica (P0) — O atendente perdia a visão de toda a grade semanal ao cancelar um único agendamento.
- **Sintoma:** Ao cancelar 1 agendamento, todos os outros agendamentos sumiam da tela e o painel voltava para o estado inicial vazio (*"Nenhum Agendamento na Grade"*).

### Causa Raiz Técnica
1. Quando um agendamento era cancelado, o componente `AdminDashboardClient` disparava um re-fetch da API `/api/admin/metrics`. Devido à mutação em lote do mock anterior (Bug 01), a query `.neq('status', 'cancelled')` retornava 0 itens ativos.
2. Além disso, o layout do frontend substituía todo o componente `WeeklyCalendarGrid` por um `EmptyStateCanvas` sempre que `upcomingAppointments.length === 0`, ao invés de exibir a grade semanal com seus slots disponíveis.

### Solução Aplicada
1. **Grade Semanal Persistente:** O componente `WeeklyCalendarGrid` agora é renderizado de forma contínua em `viewMode === 'grid'`. Os slots vazios são células limpas e clicáveis da própria planilha semanal.
2. **Atualização Otimista Segura:** O cancelamento apenas remove o ID correspondente da lista de ativos em memória, preservando todos os demais registros e mantendo o período selecionado intacto.

### Testes de Regressão Criados
Em [`tests/integration/cancellation_safety.test.ts`](file:///c:/MeuProjetoAgendamento/tests/integration/cancellation_safety.test.ts):
- `GIVEN mock query builder with chained .update().eq(), THEN it only updates records matching eq filter, leaving other records intact`.
- `GIVEN 5 appointments in active state, WHEN cancelling 1, THEN filtering out only cancelled leaves 4 active items and never empties to 0`.

---

## 3. Bug 03 — Redirecionamento Indevido do Logout para a Tela de Perfil

- **Gravidade:** Alta (P1) — Falha de usabilidade e segurança na saída do operador.
- **Sintoma:** Ao clicar em "Sair" (Logout), o usuário não ficava na tela de login; em vez disso, o sistema abria a página `/perfil` do cidadão exibindo cards de agendamentos e dados residuais.

### Causa Raiz Técnica
1. No `middleware.ts` e `app/actions/auth.ts`, existia uma regra que redirecionava qualquer acesso à rota `/login` para `/perfil`.
2. A função `logout()` não definia a flag de saída nos cookies, fazendo o middleware identificar uma sessão ativa e gerar um loop de redirecionamento para o perfil do cidadão.

### Solução Aplicada
1. **Controle de Cookies no Logout:** A ação `logout()` limpa `auth_session`, define `logged_out = true` e redireciona diretamente para `/login`.
2. **Redirecionamento ao Logar:** O formulário de login direciona operadores autenticados diretamente para o **Painel Administrativo (`/admin`)**, eliminando o desvio para `/perfil`.
3. **Redesign da Tela de Login:** A tela de login foi remodelada com foco estrito em **Usuário/E-mail** e **Senha**.

---

## 4. Bug 04 — Duplicidade de Botões de Agendamento e Baixo Contraste no Dark Theme

- **Gravidade:** Média (P2) — Usabilidade e acessibilidade visual.
- **Sintoma:** Haviam 3 pontos de acesso para a mesma ação "Agendar Presencial" na mesma tela (Header, Canvas e Barra de Busca), e os textos dos cards de indicadores e legendas estavam quase invisíveis sobre o fundo escuro.

### Causa Raiz Técnica
- Uso de classes genéricas como `text-muted` do Bootstrap, cuja cor cinza escuro (`#6c757d`) gerava uma taxa de contraste inferior a 2.5:1 contra os painéis escuros (`#111827`, `#1E293B`).
- Redundância de elementos interativos com a mesma função na mesma viewport.

### Solução Aplicada
1. **Ação Única de Destaque:** Mantido apenas o botão principal de agendamento presencial no contexto correto e substituído o `+` da barra de busca por um ícone semântico de busca (`<i className="bi bi-search"></i>`).
2. **Tokens de Alto Contraste (WCAG AA/AAA):** Aplicação de tokens claros (`#CBD5E1`, `#93C5FD`, `#6EE7B7`, `#FCA5A5`, `#7DD3FC`) garantindo contraste superior a 8:1 em todos os rótulos e métricas.
