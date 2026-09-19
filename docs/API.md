# Documentação de API & Server Actions — Painel de Identificação Civil

> Especificação técnica de todas as interfaces de comunicação da aplicação: Route Handlers (REST / SSE) e Server Actions (Next.js RPC).

---

## 1. Sumário de Endpoints e Ações

- **1. Route Handlers (REST & Streaming)**
  - `GET /api/admin/metrics` — Consulta de Indicadores e Agendamentos Ativos
  - `GET /api/admin/events` — Stream em Tempo Real (Server-Sent Events)
- **2. Server Actions — Módulo Cidadão / Agendamento**
  - `createBooking` — Criar Agendamento Online
  - `fetchAvailableSlots` — Consultar Horários Disponíveis para Data
  - `findNextAvailableDate` — Buscar Próxima Data com Vagas
  - `cancelAppointment` — Cancelar Agendamento (Cidadão)
  - `getUserAppointments` — Listar Agendamentos do Usuário
- **3. Server Actions — Módulo Administrativo & Atendimento**
  - `adminCreateWalkIn` — Criar Agendamento Presencial (Balcão)
  - `adminConfirmAttendance` — Confirmar Comparecimento / Atendido
  - `adminUpdateAppointmentStatus` — Alterar Status de Agendamento por ID
  - `getDashboardMetrics` — Obter Métricas do Painel
  - `getCompletedAppointments` — Listar Histórico de Atendimentos Concluídos
  - `updateSystemSetting` — Atualizar Configuração do Sistema
  - `getAuditLogs` — Consultar Trilha de Auditoria
- **4. Server Actions — Autenticação & Sessão**
  - `login` — Autenticação de Usuário/Atendente
  - `logout` — Encerramento de Sessão

---

## 2. Route Handlers (REST & SSE)

### 2.1. `GET /api/admin/metrics`
Retorna os contadores do painel (hoje, mês, limite e restantes) e a lista de agendamentos ativos para o período solicitado.

- **Autenticação:** Requer perfil `admin` na sessão.
- **Query Parameters:**
  - `startDate` (opcional, string `YYYY-MM-DD`): Data inicial do filtro.
  - `endDate` (opcional, string `YYYY-MM-DD`): Data final do filtro.

**Exemplo de Resposta (200 OK):**
```json
{
  "dailyAppointments": 3,
  "monthlyAppointments": 18,
  "limit": 200,
  "restantes": 182,
  "upcomingAppointments": [
    {
      "id": "apt-00000000-0001",
      "citizen_id": "test",
      "protocol_number": "20260916-HOJE1",
      "full_name": "Maria Ruty Silva",
      "phone": "(88) 98765-4321",
      "sexo": "Feminino",
      "appointment_date": "2026-09-16",
      "appointment_time": "09:00:00",
      "appointment_type": "first_issue",
      "tipo": "PRIMEIRA_VIA",
      "categoria": "1ª Via RG",
      "status": "confirmed",
      "attendant": "Guichê 01 - Dra. Lima",
      "origin": "online",
      "is_walk_in": false
    }
  ]
}
```

---

### 2.2. `GET /api/admin/events` (Server-Sent Events)
Abre conexão persistente HTTP (stream de texto `text/event-stream`) para transmissão em tempo real de eventos do posto.

- **Headers de Resposta:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
- **Eventos Transmitidos:**
  - `new_booking`: Disparado quando um novo agendamento é criado online ou presencialmente.
    ```json
    event: new_booking
    data: {"protocol":"20260916-HBUTHD","full_name":"Bruninha Oliveira","appointment_date":"2026-09-16","appointment_time":"12:00:00","appointment_type":"second_issue","timestamp":"2026-09-16T18:00:00Z"}
    ```
  - `booking_cancelled`: Disparado quando um agendamento é cancelado.
    ```json
    event: booking_cancelled
    data: {"appointmentId":"apt-00000000-0001","protocol":"20260916-HOJE1"}
    ```

---

## 3. Server Actions — Módulo Cidadão / Agendamento

### 3.1. `createBooking(prevState, formData)`
Cria um agendamento no portal do cidadão.

- **Arquivo:** [`app/actions/booking.ts`](file:///c:/MeuProjetoAgendamento/app/actions/booking.ts)
- **Campos do `formData`:**
  - `full_name` (string, mín. 3 caracteres) — Obrigatório.
  - `phone` (string, formato `(XX) XXXXX-XXXX` ou numérico 10-11 dígitos) — Obrigatório.
  - `sexo` (string, opções `'Masculino'`, `'Feminino'`, `'Outro'`, `'Não informado'`) — Obrigatório.
  - `service_id` (número/string) — Obrigatório.
  - `appointment_date` (string `YYYY-MM-DD`) — Obrigatório.
  - `appointment_time` (string `HH:mm`) — Obrigatório.
  - `appointment_type` (`'first_issue'` | `'second_issue'`) — Obrigatório.
  - `address` (string) — Opcional.

**Retorno de Sucesso:**
```json
{
  "status": "success",
  "protocol": "20260916-HBUTHD",
  "appointment_id": "apt-1726510000-XYZ",
  "appointment_date": "2026-09-16",
  "appointment_time": "12:00"
}
```

---

### 3.2. `fetchAvailableSlots(dateStr, durationMinutes)`
Consulta as faixas de horário livres para a data indicada.

- **Arquivo:** [`app/actions/availability.ts`](file:///c:/MeuProjetoAgendamento/app/actions/availability.ts)
- **Parâmetros:**
  - `dateStr` (`string` formato `YYYY-MM-DD`): Data a consultar.
  - `durationMinutes` (`number`, padrão `30`): Duração do serviço.
- **Retorno:** Array de strings no formato `["08:00", "08:30", "09:00", "13:30", "14:00", ...]`.

---

### 3.3. `cancelAppointment(appointmentId)`
Permite ao cidadão cancelar seu próprio agendamento.

- **Arquivo:** [`app/actions/appointments.ts`](file:///c:/MeuProjetoAgendamento/app/actions/appointments.ts)
- **Parâmetros:** `appointmentId` (`string`, obrigatório e sanitizado).
- **Garantia de Segurança:** Restringe a alteração exclusivamente ao registro correspondente ao `id` e `citizen_id` da sessão via cláusula `.eq('id', appointmentId)`.
- **Retorno:** `{ "success": true }` ou `{ "success": false, "error": "Mensagem de erro" }`.

---

## 4. Server Actions — Módulo Administrativo & Balcão

### 4.1. `adminCreateWalkIn(formData)`
Realiza agendamento presencial imediato direto do balcão (sem travar por CPF).

- **Arquivo:** [`app/actions/booking.ts`](file:///c:/MeuProjetoAgendamento/app/actions/booking.ts)
- **Campos:** `full_name`, `phone`, `sexo`, `appointment_type`, `appointment_date`, `appointment_time`, `cpf` (opcional), `notes` (opcional).
- **Retorno:**
  ```json
  {
    "success": true,
    "protocol": "PRES-20260916-A1B2",
    "appointmentId": "apt-presencial-123"
  }
  ```

---

### 4.2. `adminConfirmAttendance(appointmentId)`
Confirma que o cidadão compareceu e foi atendido no posto.

- **Arquivo:** [`app/actions/admin.ts`](file:///c:/MeuProjetoAgendamento/app/actions/admin.ts)
- **Transição de Status:** Altera `status` para `'completed'`.
- **Comportamento na UI:** Remove o card da Grade Semanal e direciona para a lista de **Atendimentos Realizados**.
- **Retorno:** `{ "success": true, "data": { ... } }`.

---

### 4.3. `adminUpdateAppointmentStatus(appointmentId, status)`
Altera o status de um agendamento de forma isolada e segura.

- **Arquivo:** [`app/actions/admin.ts`](file:///c:/MeuProjetoAgendamento/app/actions/admin.ts)
- **Parâmetros:**
  - `appointmentId` (`string`): ID único obrigatório.
  - `status`: `'confirmed'` | `'completed'` | `'cancelled'` | `'scheduled'` | `'no_show'`.
- **Garantia de Não-Regressão (P0):** Requer obrigatoriamente ID preenchido e executa mutação deferida pontual `.eq('id', appointmentId.trim())`.
- **Auditoria:** Grava automaticamente entrada na tabela `audit_logs`.

---

### 4.4. `getCompletedAppointments(dateFilter?)`
Recupera o histórico de atendimentos com status `'completed'`.

- **Arquivo:** [`app/actions/admin.ts`](file:///c:/MeuProjetoAgendamento/app/actions/admin.ts)
- **Parâmetros:** `dateFilter` (opcional `YYYY-MM-DD`).
- **Retorno:** Lista de agendamentos contendo protocolo, nome, sexo, serviço, data/hora, guichê e horário de conclusão.

---

### 4.5. `updateSystemSetting(key, value, description)`
Altera parâmetros institucionais (ex.: `monthly_limit`).

- **Arquivo:** [`app/actions/admin.ts`](file:///c:/MeuProjetoAgendamento/app/actions/admin.ts)
- **Auditoria:** Registra a alteração em `audit_logs` e revalida `/admin/configuracoes`.
