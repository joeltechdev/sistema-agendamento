# Guia de Contribuição e Padrões de Código

> Diretrizes para novos desenvolvedores, padrões de projeto, convenções de nomenclatura, fluxo de trabalho com Git e checklist de qualidade antes de deploys.

---

## 1. Padrões de Código e Diretrizes de Engenharia

### 1.1. TypeScript & Tipagem Estrita
- Todo o código deve estar estritamente tipado em TypeScript (`.ts` / `.tsx`).
- Evite o uso de `any` sem justificativa técnica. Crie interfaces claras para novos DTOs, entidades e props de componentes.
- Valide a integridade de tipos antes de qualquer commit com:
  ```bash
  npx tsc --noEmit
  ```

### 1.2. React 19 & Next.js App Router
- **Separação Server vs. Client:**
  - Por padrão, crie componentes como **Server Components (RSC)** para maximizar performance e reduzir código no cliente.
  - Adicione a diretiva `'use client'` apenas quando o componente exigir hooks de estado (`useState`, `useEffect`, `useCallback`), manipulação de eventos do DOM ou acesso a APIs do navegador.
- **Server Actions:**
  - Devem ser declaradas com `'use server'` no topo do arquivo ou da função.
  - Todas as entradas de dados em Server Actions devem ser validadas com schemas **Zod** antes de qualquer interação com o banco.
  - Sempre sanitizar identificadores (ex.: `id.trim()`) e nunca executar queries de `UPDATE` ou `DELETE` sem filtro de ID explícito.

### 1.3. Acessibilidade e Contraste Visual (WCAG)
- Em componentes Dark Theme, nunca utilize classes genéricas de cinza escuro (como `text-muted` padrão) sobre fundos `#111827` ou `#1E293B`.
- Utilize os tokens oficiais de alto contraste do projeto:
  - Textos principais: `#FFFFFF` / `#F8FAFC`
  - Textos secundários e rótulos: `#CBD5E1` (Slate-300) / `#94A3B8` (Slate-400)
  - Destaques temáticos: `#93C5FD` (Azul), `#6EE7B7` (Verde), `#FCA5A5` (Vermelho)

---

## 2. Fluxo de Trabalho com Git

### 2.1. Estrutura de Branches
- `main`: Branch de produção / código estável e auditado.
- `develop`: Branch de integração de novas features.
- `feature/<nome-da-feature>`: Desenvolvimento de novas funcionalidades.
- `fix/<nome-do-bug>`: Correções pontuais e bugs críticos (P0/P1).

### 2.2. Convenção de Mensagens de Commit (Conventional Commits)
- `feat: adiciona campo sexo no cadastro presencial`
- `fix: isola cancelamento de agendamento por ID para evitar mutacao em lote`
- `style: aprimora contraste dos cards de indicadores no tema escuro`
- `test: adiciona teste de regressao para cancelamento de agendamento`
- `docs: adiciona especificacao completa de arquitetura e modelo de dados`

---

## 3. Como Executar e Criar Testes Automatizados

A suíte de testes utiliza **Jest** com suporte a TypeScript.

### 3.1. Execução dos Testes
```bash
# Executar todos os testes
npm test

# Executar testes em modo watch (desenvolvimento)
npx jest --watch

# Executar uma suíte específica
npx jest tests/integration/cancellation_safety.test.ts
```

### 3.2. Estrutura dos Arquivos de Teste
- `tests/unit/`: Testes de lógica pura e funções utilitárias (ex.: validações Zod, cálculo de slots, temas de cards).
- `tests/integration/`: Testes de Server Actions, persistência, concorrência e integridade de mutações de status.

---

## 4. Checklist Pré-Push / Pré-Deploy (Obrigatório)

Antes de abrir um Pull Request ou solicitar deploy em produção, verifique:

- [ ] **TypeScript:** O comando `npx tsc --noEmit` executa com **0 erros**.
- [ ] **Testes Automatizados:** O comando `npm test` executa com **100% de aprovação** em todas as suítes.
- [ ] **Isolamento de Camadas:** Se a tarefa era restrita a front-end, nenhum endpoint ou schema de banco foi alterado indevidamente.
- [ ] **Segurança de Mutação:** Todas as ações de `UPDATE` e `DELETE` possuem cláusula de filtro explícito por ID.
- [ ] **Acessibilidade:** Textos e botões no tema escuro mantêm contraste nítido e legível.
- [ ] **Logs de Auditoria:** Novas ações críticas de operadores gravam evento correspondente na tabela `audit_logs`.
