# Sistema de Agendamento de RG — Painel de Identificação Civil

> Documentação Oficial do Sistema de Atendimento e Agendamento da Carteira de Identidade Nacional / Registro Geral (RG).

---

## 1. Visão Geral e Propósito

O **Sistema de Agendamento de RG / Painel de Identificação Civil** é uma plataforma web desenvolvida para modernizar, agilizar e organizar o fluxo de emissão de Carteiras de Identidade (1ª e 2ª via) em postos municipais de atendimento ao cidadão.

O sistema atende a dois grandes ecossistemas:
1. **Portal Público do Cidadão:** Interface direta, sem necessidade de criação de conta, onde qualquer cidadão pode consultar orientações documentais, escolher data e horário disponíveis, preencher seus dados básicos e emitir seu comprovante com protocolo.
2. **Painel de Identificação Civil (Admin / Balcão):** Dashboard administrativo em Dark Theme com Grade Semanal de Horários (estilo planilha operacional), Lista de Atendimentos, controle de Atendimentos Realizados (histórico), fila de atendimentos iminentes, métricas de capacidade mensal e modal de agendamento presencial imediato (balcão).

---

## 2. Perfis de Usuários (Público-Alvo)

| Perfil | Nível de Acesso | Responsabilidades no Sistema |
| :--- | :--- | :--- |
| **Cidadão** | Público (sem login prévio) | Agendamento online de 1ª e 2ª via, visualização de documentos necessários e geração de protocolo. |
| **Atendente de Balcão** | Autenticado (`admin`/`attendant`) | Realização de agendamentos presenciais rápidos, consulta da grade semanal, confirmação de comparecimento ("Atendido"), cancelamentos pontuais e gestão de fila. |
| **Administrador / Gestor** | Autenticado (`admin`) | Gestão de limites mensais de emissão, visualização de métricas e gráficos consolidados, consulta de logs de auditoria e configurações de atendimento. |

---

## 3. Principais Funcionalidades

### 3.1. Portal do Cidadão
- **Agendamento Online Guiado (Wizard):** Seleção de tipo de emissão (1ª ou 2ª via), seleção de data no calendário com busca automática do próximo dia disponível, escolha de horário em grade de slots (08:00 às 16:30) e formulário simplificado de dados pessoais com campo Sexo.
- **Orientações Documentais Institucionais:** Exibição clara de regras para 1ª via (certidão de nascimento/casamento) e 2ª via (guia DAE paga ou isenção).
- **Emissão Instantânea de Comprovante:** Tela de confirmação com número de protocolo formatado, data, hora, endereço do posto e botão direto para retorno à página inicial ou novo agendamento.

### 3.2. Painel de Identificação Civil (Módulo Administrativo)
- **Grade Semanal (Planilha Operacional):** Visualização em tabela com 7 dias da semana e 16 faixas de horários, exibindo cards coloridos por tipo de atendimento (Verde = 1ª Via, Azul = 2ª Via, Vermelho = Atrasado/Não Compareceu).
- **Agendamento Presencial (Balcão):** Modal rápido para atendentes registrarem cidadãos presentes no balcão sem travar o fluxo.
- **Controle de Ciclo de Vida do Atendimento:**
  - Destaque automático em vermelho para atendimentos com horário ultrapassado sem confirmação.
  - Ação **"Confirmar Atendimento"** que move o registro para a aba **"Atendimentos Realizados"** (histórico) e libera o card da grade.
  - Ação **"Cancelar Agendamento"** isolada por ID com proteção contra cancelamento em massa.
- **Deck de Indicadores e Métricas:** Contadores em tempo real de agendamentos do dia, vagas restantes no mês, atrasados e atendimentos concluídos.
- **Sincronização em Tempo Real (Multi-Tier):** Atualização instantânea da grade via Server-Sent Events (SSE) e canais de broadcast locais ao entrar novo agendamento.

---

## 4. Stack Tecnológica

| Componente | Tecnologia | Versão | Função |
| :--- | :--- | :--- | :--- |
| **Framework Full-Stack** | Next.js (App Router, Turbopack) | `16.3.5` | Estrutura de rotas, Server Actions, SSR e Route Handlers |
| **Biblioteca de UI** | React | `19.2.8` | Camada de componentes reativos e hooks |
| **Linguagem** | TypeScript | `^5.0` | Tipagem estática e segurança de tipos |
| **Estilização** | Bootstrap + Custom CSS | `^5.3.8` | Grid responsivo, componentes base e tokens Dark Theme |
| **Ícones** | Bootstrap Icons | `^1.13.1` | Biblioteca de ícones vetoriais |
| **Validação** | Zod | `^4.6.5` | Schemas de validação de formulários e payloads |
| **Banco & Autenticação** | Supabase (PostgreSQL 15+) | `@supabase/ssr ^0.12.7` | Banco relacional, RLS, triggers e sessão |
| **Testes** | Jest + ts-jest | `^30.5.1` | Testes unitários e de integração |

---

## 5. Como Rodar o Projeto Localmente

### 5.1. Pré-requisitos
- **Node.js:** Versão `>= 20.x` (LTS recomendada).
- **NPM:** Versão `>= 10.x`.
- **Git:** Instalado na máquina.

### 5.2. Instalação e Configuração

1. **Clonar o Repositório:**
   ```bash
   git clone <URL_DO_REPOSITORIO> MeuProjetoAgendamento
   cd MeuProjetoAgendamento
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   ```

3. **Configurar Variáveis de Ambiente:**
   Copie o arquivo de exemplo e configure suas chaves do Supabase (se for utilizar banco em nuvem):
   ```bash
   cp .env.example .env.local
   ```

   Estrutura do `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
   SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-aqui
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   > ℹ️ **Observação:** O projeto possui um mock in-memory persistente em `lib/supabase/server.ts` que permite execução e testes visuais completos mesmo sem credenciais ativas do Supabase.

4. **Executar em Modo de Desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse a aplicação em: [http://localhost:3000](http://localhost:3000).

5. **Executar a Suíte de Testes Automatizados:**
   ```bash
   npm test
   ```

---

## 6. Estrutura de Pastas do Projeto

```
MeuProjetoAgendamento/
├── app/                          # Rotas e páginas (Next.js App Router)
│   ├── (auth)/                   # Rotas de autenticação (login, cadastro, recuperar-senha)
│   ├── actions/                  # Server Actions (admin, appointments, auth, booking, etc.)
│   ├── admin/                    # Módulo administrativo (dashboard, agendamentos, relatórios, etc.)
│   ├── agendamento/              # Rota pública do wizard de agendamento
│   ├── api/                      # Route Handlers / Endpoints de API (events SSE, metrics)
│   ├── orientacoes/              # Página institucional de documentos
│   ├── perfil/                   # Página legada de perfil do cidadão
│   ├── globals.css               # Estilos globais e tokens de cores
│   └── layout.tsx                # Layout raiz da aplicação
├── components/                   # Componentes React reutilizáveis
│   ├── admin/                    # Componentes do dashboard (WeeklyCalendarGrid, AdminSidebar, etc.)
│   ├── calendar/                 # Componentes do calendário público do cidadão
│   ├── forms/                    # Formulários auxiliares
│   └── ui/                       # Componentes de interface (BookingWizard, AppointmentCard, etc.)
├── docs/                         # Documentação Técnica Oficial do Sistema
├── lib/                          # Utilitários, conexões e helpers
│   ├── events/                   # EventEmitter para tempo real SSE
│   ├── supabase/                 # Clientes Supabase (server, client, middleware)
│   └── rateLimit.ts              # Utilitário de rate limit em memória
├── public/                       # Arquivos estáticos (imagens, ícones)
├── services/                     # Camada de serviços institucionais e disponibilidade
├── supabase/                     # Migrations SQL e seeds do banco de dados
│   └── migrations/               # Arquivos SQL cronológicos
├── tests/                        # Suíte de testes automatizados (Jest)
│   ├── integration/              # Testes de integração (booking, admin, realtime, cancellation)
│   └── unit/                     # Testes unitários (validation, availability, grid)
├── middleware.ts                 # Middleware de autenticação e proteção RBAC
├── package.json                  # Manifesto de dependências e scripts
└── tsconfig.json                 # Configurações do TypeScript
```
