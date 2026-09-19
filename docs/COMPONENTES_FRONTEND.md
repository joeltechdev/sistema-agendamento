# Inventário de Componentes Frontend — Painel de Identificação Civil

> Catálogo completo dos componentes de interface, mapa de rotas, estados internos e dependências.

---

## 1. Mapa de Rotas e Páginas

| Rota (URL) | Arquivo de Página | Componente Principal | Descrição |
| :--- | :--- | :--- | :--- |
| `/` | `app/page.tsx` | `HomePage` + `InstitutionalContent` | Landing Page pública do posto com CTA de agendamento e orientações. |
| `/agendamento` | `app/agendamento/page.tsx` | `BookingWizard` | Wizard público guiado de agendamento de RG (1ª e 2ª via). |
| `/orientacoes` | `app/orientacoes/page.tsx` | `RequiredDocumentsList` | Guia completo de documentos necessários para emissão. |
| `/admin` | `app/admin/page.tsx` | `AdminDashboardClient` | Dashboard principal com Grade Semanal, Métricas e Ações. |
| `/admin/agendamentos` | `app/admin/agendamentos/page.tsx` | `AppointmentsManagementClient` | Tabela detalhada de agendamentos com filtros avançados. |
| `/admin/cidadaos` | `app/admin/cidadaos/page.tsx` | `CidadaosClient` | Listagem e busca de cidadãos cadastrados. |
| `/admin/relatorios` | `app/admin/relatorios/page.tsx` | `RelatoriosClient` | Relatórios consolidados e gráficos de produtividade. |
| `/admin/configuracoes`| `app/admin/configuracoes/page.tsx` | `ConfiguracoesClient` | Parametrização de limite mensal e avisos do sistema. |
| `/admin/auditoria` | `app/admin/auditoria/page.tsx` | `AuditoriaClient` | Trilha de auditoria e logs de alterações no sistema. |
| `/(auth)/login` | `app/(auth)/login/page.tsx` | `LoginPage` | Tela de autenticação em Dark Theme para operadores. |

---

## 2. Componentes Administrativos (`components/admin/`)

### 2.1. `AdminDashboardClient.tsx`
Componente central e orquestrador do Painel de Identificação Civil.

- **Responsabilidade:** Gerencia a alternância de modos de visualização (`grid` = Grade Semanal, `table` = Lista Ativa, `completed` = Atendimentos Realizados), orquestra o SSE e canais de broadcast para atualizações em tempo real, executa otimismo de status e exibe notificações sonoras/toasts.
- **Props Recebidas:** `initialMetrics` (`DashboardMetrics`).
- **Estados Internos Principais:**
  - `metrics`: Contadores e lista de `upcomingAppointments`.
  - `viewMode`: `'grid' | 'table' | 'completed'`.
  - `toasts`: Fila de notificações instantâneas de novos agendamentos.
  - `walkInModal`: Controle de visibilidade do modal de agendamento presencial.
  - `completedList`: Lista carregada sob demanda para a aba de histórico.
- **Dependências:** `WeeklyCalendarGrid`, `WalkInBookingModal`, `EmptyStateCanvas`, `DarkAppShell`.

---

### 2.2. `WeeklyCalendarGrid.tsx`
Grade operacional de horários em formato de planilha semanal com cards coloridos.

- **Responsabilidade:** Renderiza uma tabela de 7 colunas (Segunda a Domingo) x 16 faixas de horários (08:00 às 16:30). Mapeia agendamentos em seus respectivos slots através de normalização de data/hora, calcula temas visuais (Verde para 1ª Via, Azul para 2ª Via, Vermelho para Atrasados/Não Compareceu), abre modal de detalhes do agendamento com botões de ação ("Confirmar Atendimento" e "Cancelar Agendamento").
- **Props Recebidas:**
  - `appointments`: Lista de `Appointment[]`.
  - `newlyAddedId`: Protocolo em destaque recente.
  - `jumpToDate`: Data de salto rápido.
  - `onWeekChange`: Callback ao navegar entre semanas.
  - `onSlotClick`: Callback ao clicar em um slot vago para agendar.
  - `onAppointmentStatusChange`: Callback para confirmação/cancelamento.
- **Funções Utilitárias Exportadas:**
  - `isAppointmentOverdue(date, time)`: Determina se o horário ultrapassou o relógio local.
  - `getAppointmentCardTheme(apt)`: Define a cor do card (`'green'`, `'blue'`, `'orange'`, `'red'`).
  - `normalizeDateStringToYMD(dateInput)`: Conversor padronizador de datas.
  - `normalizeTimeStringToHHMM(timeInput)`: Conversor padronizador de horários.

---

### 2.3. `WalkInBookingModal.tsx`
Modal de Agendamento Presencial (Balcão).

- **Responsabilidade:** Permitir que o atendente realize agendamentos imediatos no balcão para cidadãos sem CPF ou com atendimento presencial urgente, escolhendo dia, horário e guichê.
- **Props Recebidas:** `isOpen` (`boolean`), `initialDate`, `initialTime`, `onClose`, `onSuccess`.
- **Validações:** Campos obrigatórios (Nome Completo, Telefone, Sexo, Tipo de RG).

---

### 2.4. `AppointmentsManagementClient.tsx`
Visualização detalhada em tabela da lista de agendamentos com abas de status.

- **Responsabilidade:** Renderiza tabela paginada com abas rápidas ("Todos", "Confirmados", "⏰ Atrasados", "Concluídos", "Cancelados"), campo de busca textual e botões de ação em linha.
- **Props Recebidas:** `initialAppointments` (`AppointmentItem[]`).

---

### 2.5. `AdminSidebar.tsx` & `DarkAppShell.tsx`
Casca de layout no tema Dark Slate-Navy (`#0B1220`).

- **Responsabilidade:** Barra lateral com identificação do posto (escudo com gradiente), agrupamento de itens de navegação operacional, badge de contagem do dia, avatar com iniciais do operador logado e botão de logout seguro.

---

### 2.6. `CancellationDetailsModal.tsx`
Modal de Visualização do Histórico e Detalhes do Cancelamento (Somente Leitura).

- **Responsabilidade:** Exibir os dados do cancelamento ao atendente (timestamp de cancelamento, ator responsável, motivo, dados originais do agendamento, guichê e canal de origem) em formato somente leitura para auditoria e histórico.
- **Props Recebidas:** `isOpen` (`boolean`), `onClose` (`() => void`), `appointment` (`AppointmentItem | null`).

---

## 3. Componentes Públicos do Cidadão (`components/ui/` & `components/calendar/`)

### 3.1. `BookingWizard.tsx`
Wizard guiado passo a passo de agendamento online.

- **Responsabilidade:** Conduz o cidadão através de 3 etapas limpas:
  1. **Etapa 1:** Escolha do Tipo de Serviço (1ª Via gratuita vs 2ª Via com DAE).
  2. **Etapa 2:** Escolha da Data no calendário com exibição dos slots de horário disponíveis.
  3. **Etapa 3:** Preenchimento de dados pessoais (Nome, Telefone, Sexo, Endereço — Sem CPF obrigatório).
  4. **Etapa 4 (Confirmação):** Exibição do comprovante com número de protocolo formatado e botões diretos "Início" e "Novo Agendamento".
- **Dependências:** `Calendar.tsx`, `fetchAvailableSlots`, `createBooking`.

---

### 3.2. `Calendar.tsx` & `TimeSlot.tsx`
Componente de calendário mensal e seletor de horários.

- **Responsabilidade:** Exibe grade mensal de dias, desabilitando finais de semana e feriados passados, permitindo seleção interativa do dia e carregamento dos horários livres.
- **Props do Calendar:** `selectedDate`, `onDateSelect`, `availableSlots`, `onSlotSelect`, `isLoadingSlots`.

---

### 3.3. `RequiredDocumentsList.tsx` & `InstitutionalContent.tsx`
Componentes informativos sobre requisitos legais de emissão de RG.

- **Responsabilidade:** Apresenta checklist de documentos obrigatórios (Certidão de Nascimento/Casamento original em bom estado, Comprovante de Residência, CPF e Guia DAE paga para 2ª via).
