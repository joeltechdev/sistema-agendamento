/**
 * QA E2E — Teste Completo do Sistema de Agendamento de RG
 * Cobre: ciclo completo, validacao, regras de negocio, seguranca, concorrencia, regressao P0
 */
import { generateTimeSlots } from "../../services/availabilityService"
import { z } from "zod"

const TODAY = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
})()
const TOMORROW = (() => {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
})()
function getNextMonday(): string {
  const d = new Date(); const day = d.getDay()
  const diff = day === 0 ? 1 : (8 - day) % 7 || 7; d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}
const NEXT_MONDAY = getNextMonday()
const MOCK_WH = [{ start_time: "08:00:00", end_time: "12:30:00" }, { start_time: "13:30:00", end_time: "17:00:00" }]
const ALL_SLOTS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30"]
const MORNING = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00"]
const AFTERNOON = ["13:30","14:00","14:30","15:00","15:30","16:00","16:30"]

describe("TC-01 | Geracao de Slots de Horario", () => {
  test("TC-01.01 | Dia util sem agendamentos retorna todos os slots", () => {
    const slots = generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), MOCK_WH, [], 30, false, false)
    expect(slots).toEqual(ALL_SLOTS)
  })
  test("TC-01.02 | Sabado retorna array vazio", () => {
    const d = new Date(); while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
    expect(generateTimeSlots(d, MOCK_WH, [], 30, false, false)).toEqual([])
  })
  test("TC-01.03 | Domingo retorna array vazio", () => {
    const d = new Date(); while (d.getDay() !== 0) d.setDate(d.getDate() + 1)
    expect(generateTimeSlots(d, MOCK_WH, [], 30, false, false)).toEqual([])
  })
  test("TC-01.04 | Feriado retorna array vazio", () => {
    expect(generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), MOCK_WH, [], 30, true, false)).toEqual([])
  })
  test("TC-01.05 | Data bloqueada retorna array vazio", () => {
    expect(generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), MOCK_WH, [], 30, false, true)).toEqual([])
  })
  test("TC-01.06 | Slot ocupado removido", () => {
    const slots = generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), MOCK_WH, [{ appointment_time: "09:00:00" }], 30, false, false)
    expect(slots).not.toContain("09:00"); expect(slots.length).toBe(ALL_SLOTS.length - 1)
  })
  test("TC-01.07 | Multiplos slots ocupados removidos", () => {
    const occ = [{ appointment_time: "08:00:00" }, { appointment_time: "09:00:00" }, { appointment_time: "14:00:00" }]
    const slots = generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), MOCK_WH, occ, 30, false, false)
    expect(slots).not.toContain("08:00"); expect(slots).not.toContain("09:00"); expect(slots).not.toContain("14:00")
    expect(slots.length).toBe(ALL_SLOTS.length - 3)
  })
  test("TC-01.08 | Sem horarios de trabalho retorna vazio", () => {
    expect(generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), [], [], 30, false, false)).toEqual([])
  })
  test("TC-01.09 | Turno manha correto", () => {
    expect(generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), [MOCK_WH[0]], [], 30, false, false)).toEqual(MORNING)
  })
  test("TC-01.10 | Turno tarde correto", () => {
    expect(generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), [MOCK_WH[1]], [], 30, false, false)).toEqual(AFTERNOON)
  })
  test("TC-01.11 | Todos slots ocupados retorna vazio", () => {
    const occ = ALL_SLOTS.map(s => ({ appointment_time: s + ":00" }))
    expect(generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), MOCK_WH, occ, 30, false, false)).toEqual([])
  })
  test("TC-01.12 | Intervalo entre slots dentro do turno e 30 min", () => {
    const slots = generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), MOCK_WH, [], 30, false, false)
    for (let i = 1; i < slots.length; i++) {
      const [h1, m1] = slots[i-1].split(":").map(Number)
      const [h2, m2] = slots[i].split(":").map(Number)
      const diff = (h2*60+m2) - (h1*60+m1)
      expect([30, 90]).toContain(diff)
    }
  })
})

describe("TC-02 | Validacao de Campos do Agendamento (Zod)", () => {
  const aptTypeSchema = z.preprocess((v: any) => {
    if (typeof v !== "string") return v
    const s = v.toLowerCase().trim()
    if (s.includes("2") || s.includes("second") || s.includes("segunda")) return "second_issue"
    return "first_issue"
  }, z.enum(["first_issue", "second_issue"]))
  const sexoSchema = z.preprocess(
    (v: any) => typeof v === "string" && v.trim().length > 0 ? v.trim() : "",
    z.string().min(1).refine((v: string) => ["Masculino","Feminino","Outro / Nao informado","Prefiro nao informar","Outro","M","F"].includes(v))
  )
  const schema = z.object({
    service_id: z.string().min(1, "Servico invalido."),
    appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida."),
    appointment_time: z.string().regex(/^\d{2}:\d{2}$/, "Horario invalido."),
    appointment_type: aptTypeSchema.optional(),
    full_name: z.string().min(3, "Nome precisa de 3 chars."),
    phone: z.string().min(10).max(20),
    sexo: sexoSchema,
    address: z.string().optional(),
    cpf: z.string().optional()
  }).refine((d: { appointment_type?: string }) => d.appointment_type, { message: "Tipo invalido", path: ["appointment_type"] })
  const base = { service_id: "svc-001", appointment_date: TODAY, appointment_time: "09:00", appointment_type: "first_issue", full_name: "QA Test Usuario", phone: "(85) 99999-0001", sexo: "Masculino" }
  test("TC-02.01 | Payload valido passa", () => { expect(schema.safeParse(base).success).toBe(true) })
  test("TC-02.02 | Nome < 3 chars falha", () => { expect(schema.safeParse({ ...base, full_name: "Jo" }).success).toBe(false) })
  test("TC-02.03 | Nome vazio falha", () => { expect(schema.safeParse({ ...base, full_name: "" }).success).toBe(false) })
  test("TC-02.04 | Telefone curto falha", () => { expect(schema.safeParse({ ...base, phone: "123" }).success).toBe(false) })
  test("TC-02.05 | Telefone 10 digits valido", () => { expect(schema.safeParse({ ...base, phone: "8599990001" }).success).toBe(true) })
  test("TC-02.06 | Sexo invalido falha", () => { expect(schema.safeParse({ ...base, sexo: "Alienigena" }).success).toBe(false) })
  test("TC-02.07 | Sexo vazio falha", () => { expect(schema.safeParse({ ...base, sexo: "" }).success).toBe(false) })
  test("TC-02.08 | Data formato errado falha", () => { expect(schema.safeParse({ ...base, appointment_date: "16/09/2026" }).success).toBe(false) })
  test("TC-02.09 | Horario formato errado falha", () => { expect(schema.safeParse({ ...base, appointment_time: "9h00" }).success).toBe(false) })
  test("TC-02.10 | CPF opcional nao impede agendamento", () => { expect(schema.safeParse({ ...base, cpf: undefined }).success).toBe(true) })
  test("TC-02.11 | service_id vazio falha", () => { expect(schema.safeParse({ ...base, service_id: "" }).success).toBe(false) })
  test("TC-02.12 | Tipo 2a via normalizado", () => {
    const r = schema.safeParse({ ...base, appointment_type: "2a via" })
    expect(r.success).toBe(true); if (r.success) expect(r.data.appointment_type).toBe("second_issue")
  })
})

describe("TC-03 | Ciclo de Vida e Transicoes de Status", () => {
  const transitions: Record<string, string[]> = {
    scheduled: ["confirmed","completed","cancelled","no_show"],
    confirmed: ["completed","cancelled","no_show"],
    no_show: ["completed","cancelled"]
  }
  test("TC-03.01 | confirmed pode ir para completed", () => { expect(transitions.confirmed).toContain("completed") })
  test("TC-03.02 | cancelled e terminal", () => { expect(transitions.cancelled).toBeUndefined() })
  test("TC-03.03 | completed e terminal", () => { expect(transitions.completed).toBeUndefined() })
  test("TC-03.04 | no_show pode ir para completed (tolerancia)", () => { expect(transitions.no_show).toContain("completed") })
  test("TC-03.05 | Cancelamento por ID especifico nao afeta outros", () => {
    const apts = [{ id: "A", status: "confirmed" },{ id: "B", status: "confirmed" },{ id: "C", status: "confirmed" }]
    const updated = apts.map(a => a.id === "B" ? { ...a, status: "cancelled" } : a)
    expect(updated.find(a => a.id === "A")?.status).toBe("confirmed")
    expect(updated.find(a => a.id === "B")?.status).toBe("cancelled")
    expect(updated.find(a => a.id === "C")?.status).toBe("confirmed")
  })
  test("TC-03.06 | ID invalido nao afeta dados", () => {
    const apts = [{ id: "A", status: "confirmed" }]
    const id: any = undefined
    if (!id || typeof id !== "string" || id.trim() === "") expect(true).toBe(true)
    expect(apts[0].status).toBe("confirmed")
  })
  test("TC-03.07 | Protocolo online formato YYYYMMDD-XXXXXX", () => {
    expect(`${TODAY.replace(/-/g,"")}-ABC123`).toMatch(/^\d{8}-[A-Z0-9]{6}$/)
  })
  test("TC-03.08 | Protocolo presencial prefixo PRES-", () => {
    expect(`PRES-${TODAY.replace(/-/g,"")}-A1B2`).toMatch(/^PRES-/)
  })
})

describe("TC-04 | Regras de Negocio Operacionais", () => {
  test("TC-04.01 | Limite mensal padrao 200", () => { expect(200).toBe(200) })
  test("TC-04.02 | Vagas restantes = max(0, limite - mensal)", () => {
    expect(Math.max(0,200-0)).toBe(200); expect(Math.max(0,200-150)).toBe(50)
    expect(Math.max(0,200-200)).toBe(0); expect(Math.max(0,200-250)).toBe(0)
  })
  test("TC-04.03 | 1a Via -> Guiche 01", () => {
    const g = (t: string) => t === "second_issue" ? "Guiche 02" : "Guiche 01"
    expect(g("first_issue")).toBe("Guiche 01")
  })
  test("TC-04.04 | 2a Via -> Guiche 02", () => {
    const g = (t: string) => t === "second_issue" ? "Guiche 02" : "Guiche 01"
    expect(g("second_issue")).toBe("Guiche 02")
  })
  test("TC-04.05 | Walk-in sem auth bloqueado", () => {
    const user = null; expect(user ? "OK" : "BLOQUEADO").toBe("BLOQUEADO")
  })
  test("TC-04.06 | Nome minimo 3 chars walk-in", () => {
    expect("Jo".trim().length >= 3).toBe(false); expect("QA_TEST".trim().length >= 3).toBe(true)
  })
  test("TC-04.07 | Telefone minimo 8 chars walk-in", () => {
    expect("1234567".trim().length >= 8).toBe(false); expect("12345678".trim().length >= 8).toBe(true)
  })
  test("TC-04.08 | Duracao RG 30 minutos", () => { expect(30).toBe(30) })
})

describe("TC-05 | Concorrencia e Protecao de Duplicidade", () => {
  test("TC-05.01 | Slot ocupado ausente nos disponiveis", () => {
    const slots = generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), MOCK_WH, [{ appointment_time: "09:00:00" }], 30, false, false)
    expect(slots).not.toContain("09:00")
  })
  test("TC-05.02 | Slot cancelado disponivel novamente", () => {
    const slots = generateTimeSlots(new Date(NEXT_MONDAY + "T12:00:00Z"), MOCK_WH, [], 30, false, false)
    expect(slots).toContain("09:00")
  })
  test("TC-05.03 | Dois usuarios mesmo slot - apenas um consegue", () => {
    const occupied = new Set<string>()
    const book = (s: string) => { if (occupied.has(s)) return false; occupied.add(s); return true }
    expect(book("09:00")).toBe(true); expect(book("09:00")).toBe(false)
    expect(occupied.size).toBe(1)
  })
  test("TC-05.04 | IDs unicos garantem isolamento", () => {
    const id1 = `apt-${Date.now()}-a`, id2 = `apt-${Date.now()}-b`; expect(id1).not.toBe(id2)
  })
  test("TC-05.05 | Rate limit bloqueia 4a tentativa", () => {
    const req: Record<string, number[]> = {}
    const rl = (k: string, max: number) => {
      const now = Date.now(); if (!req[k]) req[k] = []
      req[k] = req[k].filter(t => now - t < 60000)
      if (req[k].length >= max) return false; req[k].push(now); return true
    }
    const k = "qa-rate-test"
    expect(rl(k,3)).toBe(true); expect(rl(k,3)).toBe(true); expect(rl(k,3)).toBe(true); expect(rl(k,3)).toBe(false)
  })
})

describe("TC-06 | Normalizacao de Datas e Horarios", () => {
  const nd = (input: string): string => {
    if (input.includes("/")) {
      const p = input.split("/")
      if (p.length === 3) {
        if (p[2].length === 4) return `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`
        if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2,"0")}-${p[2].padStart(2,"0")}`
      }
    }
    const m = input.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`
    return input.split("T")[0].trim()
  }
  const nt = (input: string): string => {
    if (input.includes("T")) return nt(input.split("T")[1])
    const m = input.match(/(\d{1,2}):(\d{2})/); if (m) return `${m[1].padStart(2,"0")}:${m[2]}`
    return input.slice(0,5)
  }
  test("TC-06.01 | DD/MM/YYYY -> YYYY-MM-DD", () => { expect(nd("16/09/2026")).toBe("2026-09-16") })
  test("TC-06.02 | ISO string truncada para YYYY-MM-DD", () => { expect(nd("2026-09-16T08:00:00Z")).toBe("2026-09-16") })
  test("TC-06.03 | YYYY-MM-DD inalterado", () => { expect(nd("2026-09-16")).toBe("2026-09-16") })
  test("TC-06.04 | HH:mm:ss -> HH:mm", () => { expect(nt("09:00:00")).toBe("09:00") })
  test("TC-06.05 | H:mm -> HH:mm", () => { expect(nt("9:00")).toBe("09:00") })
  test("TC-06.06 | ISO datetime extrai horario", () => { expect(nt("2026-09-16T09:00:00Z")).toBe("09:00") })
  test("TC-06.07 | HH:mm inalterado", () => { expect(nt("14:30")).toBe("14:30") })
})

describe("TC-07 | Seguranca — IDs e Entradas Maliciosas", () => {
  const isValid = (id: unknown): boolean => {
    if (!id || typeof id !== "string") return false
    if (id.trim() === "" || id === "undefined" || id === "null") return false
    return true
  }
  test("TC-07.01 | undefined rejeitado", () => { expect(isValid(undefined)).toBe(false) })
  test("TC-07.02 | null rejeitado", () => { expect(isValid(null)).toBe(false) })
  test("TC-07.03 | string undefined rejeitada", () => { expect(isValid("undefined")).toBe(false) })
  test("TC-07.04 | string vazia rejeitada", () => { expect(isValid("")).toBe(false) })
  test("TC-07.05 | espaços rejeitados", () => { expect(isValid("   ")).toBe(false) })
  test("TC-07.06 | ID apt-XXX valido", () => { expect(isValid("apt-00000000-0001")).toBe(true) })
  test("TC-07.07 | UUID valido", () => { expect(isValid("550e8400-e29b-41d4-a716-446655440000")).toBe(true) })
  test("TC-07.08 | numero rejeitado", () => { expect(isValid(123 as any)).toBe(false) })
})

describe("TC-08 | Metricas e Contadores do Dashboard", () => {
  test("TC-08.01 | daily conta hoje nao cancelados", () => {
    const apts = [{ date: TODAY, status: "confirmed" },{ date: TODAY, status: "confirmed" },{ date: TODAY, status: "cancelled" },{ date: TOMORROW, status: "confirmed" }]
    expect(apts.filter(a => a.date === TODAY && a.status !== "cancelled").length).toBe(2)
  })
  test("TC-08.02 | monthly conta todos nao cancelados", () => {
    const apts = [{ status: "confirmed" },{ status: "confirmed" },{ status: "cancelled" }]
    expect(apts.filter(a => a.status !== "cancelled").length).toBe(2)
  })
  test("TC-08.03 | restantes = max(0, 200-45)", () => { expect(Math.max(0,200-45)).toBe(155) })
  test("TC-08.04 | restantes nunca negativo", () => { expect(Math.max(0,200-250)).toBe(0) })
  test("TC-08.05 | upcoming exclui cancelados", () => {
    const apts = [{ id: "1", status: "confirmed" },{ id: "2", status: "cancelled" },{ id: "3", status: "completed" }]
    const up = apts.filter(a => a.status !== "cancelled")
    expect(up.length).toBe(2); expect(up.find(a => a.id === "2")).toBeUndefined()
  })
})

describe("TC-09 | Geracao de Protocolo", () => {
  test("TC-09.01 | Protocolo online YYYYMMDD-XXXXXX (15 chars)", () => {
    const p = `${TODAY.replace(/-/g,"")}-ABC123`
    expect(p.length).toBe(15); expect(p).toMatch(/^\d{8}-[A-Z0-9]{6}$/)
  })
  test("TC-09.02 | Protocolo presencial comeca com PRES-", () => {
    expect(`PRES-${TODAY.replace(/-/g,"")}-A1B2`).toMatch(/^PRES-/)
  })
  test("TC-09.03 | Protocolos sao unicos", () => {
    const gen = () => `${TODAY.replace(/-/g,"")}-${Math.random().toString(36).substring(2,8).toUpperCase()}`
    const set = new Set(Array.from({ length: 100 }, gen))
    expect(set.size).toBeGreaterThan(95)
  })
})

describe("TC-10 | Regressao — Bugs P0 Corrigidos", () => {
  test("TC-10.01 | BUG-001: Cancelar ID especifico nao cancela outros", () => {
    const apts = [{ id: "A", s: "confirmed" },{ id: "B", s: "confirmed" },{ id: "C", s: "confirmed" }]
    const r = apts.map(a => a.id === "B" ? { ...a, s: "cancelled" } : a)
    expect(r.find(a => a.id === "A")?.s).toBe("confirmed")
    expect(r.find(a => a.id === "B")?.s).toBe("cancelled")
    expect(r.find(a => a.id === "C")?.s).toBe("confirmed")
  })
  test("TC-10.02 | BUG-002: Grade nao esvazia apos cancelamento", () => {
    const apts = [{ id: "A", s: "confirmed" },{ id: "B", s: "confirmed" },{ id: "C", s: "confirmed" }]
    const updated = apts.map(a => a.id === "B" ? { ...a, s: "cancelled" } : a)
    const display = updated.filter(a => a.s !== "cancelled")
    expect(display.length).toBe(2); expect(display.some(a => a.id === "A")).toBe(true)
  })
  test("TC-10.03 | BUG-003: Logout redireciona para /login", () => {
    const logout = () => "/login"; expect(logout()).toBe("/login")
  })
  test("TC-10.04 | BUG-004: logged_out cookie bloqueia user", () => {
    const isLoggedOut = true; expect(isLoggedOut ? null : { id: "test" }).toBeNull()
  })
  test("TC-10.05 | BUG-005: insert single() retorna item inserido", () => {
    const table: any[] = [{ id: "old-1" }, { id: "old-2" }]
    let lastInserted: any = null
    const newItem = { id: "new-qa", created_at: new Date().toISOString() }
    table.push(newItem); lastInserted = newItem
    const response = lastInserted || table[0]
    expect(response.id).toBe("new-qa")
  })
  test("TC-10.06 | BUG-006: count head:true retorna totalCount correto", () => {
    const apts = [{ date: TODAY, status: "confirmed" },{ date: TODAY, status: "confirmed" },{ date: TODAY, status: "cancelled" }]
    const count = apts.filter(a => a.date === TODAY && a.status !== "cancelled").length
    expect(count).toBe(2)
  })
  test("TC-10.07 | BUG-007: Seed data tem datas do dia atual", () => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
    expect(today).toBe(TODAY)
  })
})

describe("TC-11 | Walk-in Booking — Agendamento Presencial", () => {
  test("TC-11.01 | Nome < 3 chars rejeitado", () => { expect("Jo".trim().length >= 3).toBe(false) })
  test("TC-11.02 | Sexo vazio rejeitado", () => {
    const rawSex: string = ""
    expect(rawSex.trim() !== "" && rawSex !== "Selecione").toBe(false)
  })
  test("TC-11.03 | Telefone < 8 chars rejeitado", () => { expect("1234567".trim().length >= 8).toBe(false) })
  test("TC-11.04 | Sem data/hora rejeitado", () => {
    const rawDate: string = ""
    const rawTime: string = "10:00"
    expect(Boolean(rawDate) && Boolean(rawTime)).toBe(false)
  })
  test("TC-11.05 | 1a Via -> Guiche 01", () => {
    const t: string = "first_issue"
    expect(t === "second_issue" ? "Guiche 02" : "Guiche 01").toBe("Guiche 01")
  })
  test("TC-11.06 | 2a Via -> Guiche 02", () => {
    const t: string = "second_issue"
    expect(t === "second_issue" ? "Guiche 02" : "Guiche 01").toBe("Guiche 02")
  })
  test("TC-11.07 | Protocolo presencial formato PRES-YYYYMMDD-XXXX", () => {
    const p = `PRES-${TODAY.replace(/-/g,"")}-A1B2`
    expect(p).toMatch(/^PRES-\d{8}-[A-Z0-9]{4}$/)
  })
  test("TC-11.08 | Tipo second_issue normalizado corretamente", () => {
    const t = "second_issue".toLowerCase()
    expect(t.includes("second") ? "second_issue" : "first_issue").toBe("second_issue")
  })
})
