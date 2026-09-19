# Changelog — Sistema de Agendamento de RG

> Histórico cronológico de versões, novas funcionalidades, correções de segurança e refinamentos de interface do projeto.

---

## [2.4.0] — 2026-09-16

### ✨ Novas Funcionalidades
- **Controle de Atendimento & Histórico:** Implementada a ação "Confirmar Atendimento" pelo operador, marcando o agendamento como `'completed'`, liberando o slot da Grade Semanal e movendo o registro para a visualização dedicada de **"Atendimentos Realizados"**.
- **Destaque Automático de Atrasados / Não Compareceu:** Marcação visual em vermelho com badge `⏰ Atrasado` para agendamentos cujo horário expirou sem confirmação, mantendo suporte ao atendimento tardio caso o cidadão chegue com atraso.
- **Inclusão do Campo Sexo:** Adicionado campo obrigatório de Sexo (`Masculino`, `Feminino`, `Outro`, `Não informado`) em todos os fluxos de cadastro (portal online do cidadão e modal de agendamento presencial no balcão).

### 🐛 Correções de Bugs Críticos (P0)
- **Correção da Ordem do Query Builder (P0):** Corrigida a execução antecipada de `.update()` no mock do banco de dados que causava cancelamento em lote de todos os registros. As mutações agora são estritamente deferidas e vinculadas ao ID alvo.
- **Correção do Esvaziamento da Grade (P0):** A Grade Semanal (`WeeklyCalendarGrid`) agora permanece renderizada continuamente na tela sem alternar indevidamente para tela vazia ao cancelar um agendamento.
- **Correção do Fluxo de Logout:** Encerramento seguro de sessão com redirecionamento direto para a tela limpa de login (`/login`), eliminando desvios indevidos para a tela de perfil do cidadão.
- **Deduplicação de Ações e Contraste Visual:** Remoção do botão redundante no Header e na barra de pesquisa, e atualização de todos os rótulos de métricas para padrões de alto contraste WCAG AA/AAA.
- **Remoção de Links Desnecessários:** Removido o botão "Ir para Meu Perfil" da tela de confirmação de agendamento do cidadão, mantendo a experiência focada estritamente em agendamento público.

### 🧪 Testes Automatizados
- Expandida a suíte de testes de integração e regressão para **56 testes automatizados** cobrindo isolamento de cancelamento, transições de status e integridade do agendamento.

---

## [2.3.0] — 2026-09-15

### 🎨 Redesign Visual
- **Novo Dark Theme Dashboard (AppShell Wireframe):** Redesenho da interface administrativa com layout de 5 zonas (Sidebar Slate-Navy `#0B1220`, Hero Viewport central, Deck de Métricas empilhadas, Feed de Atendimentos Iminentes e Stack de Guichês em atendimento).
- **Grade Semanal em Planilha Operacional:** Transição da visualização em blocos soltos para tabela semanal estilo planilha com cards coloridos por tipo de emissão (1ª Via em Verde e 2ª Via em Azul).

---

## [2.2.0] — 2026-09-14

### ✨ Funcionalidades
- **Agendamento Presencial Imediato (Balcão):** Criação do componente `WalkInBookingModal` para inclusão rápida de agendamentos no posto de atendimento sem exigência de CPF.
- **Sincronização em Tempo Real (Multi-Tier):** Implementação de stream SSE (`/api/admin/events`) e canais de `BroadcastChannel` para atualização instantânea entre múltiplos terminais e abas.

---

## [2.1.0] — 2026-09-12

### 🔒 Segurança & Banco de Dados
- **Motor Transacional de Agendamento:** Implementação da Stored Procedure `book_appointment` com bloqueio de concorrência (`FOR UPDATE`) para eliminar conflitos de horário em agendamentos simultâneos.
- **Trilha de Auditoria:** Implementação da tabela `audit_logs` gravando histórico de ações operacionais e alterações de configurações.

---

## [1.0.0] — 2026-09-10

### 🚀 Lançamento Inicial
- Estrutura base em Next.js com App Router e integração Supabase.
- Portal público de agendamento online com escolha de data/hora e orientações documentais para emissão de RG.
