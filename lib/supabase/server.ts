import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import fs from 'fs'
import path from 'path'
import { verifySessionToken, SESSION_COOKIE_NAME, LEGACY_AUTH_COOKIES } from '@/lib/security/session'

function assertNotProductionWithoutSupabase() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PRODUCTION !== 'true') {
    const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)
    const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
    if (!hasUrl || !hasAnonKey) {
      throw new Error(
        'Execução em produção sem credenciais válidas do Supabase configuradas. O uso do mock_db_store é estritamente proibido em ambiente de produção.'
      )
    }
  }
}

function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getBusinessDayDateString(dayOffsetFromMonday: number, weekOffset = 0): string {
  const d = new Date()
  const day = d.getDay()
  // On Saturday (6) or Sunday (0), the operational week starts on the upcoming Monday
  let mondayOffset = d.getDate() - day + 1
  if (day === 6) mondayOffset = d.getDate() + 2
  if (day === 0) mondayOffset = d.getDate() + 1

  const target = new Date(d.getFullYear(), d.getMonth(), mondayOffset + (weekOffset * 7) + dayOffsetFromMonday)
  return formatLocalDate(target)
}

function getTodayDateString(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return formatLocalDate(d)
}

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
const MOCK_DB_FILE = isServerless
  ? path.join('/tmp', 'mock_db_store.json')
  : path.join(process.cwd(), '.next', 'mock_db_store.json')
let lastDiskMtime = 0

function loadDiskData(): any {
  try {
    if (fs.existsSync(MOCK_DB_FILE)) {
      const stats = fs.statSync(MOCK_DB_FILE)
      const raw = fs.readFileSync(MOCK_DB_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.appointments)) {
        lastDiskMtime = stats.mtimeMs
        if (!Array.isArray(parsed.services) || parsed.services.length === 0) {
          parsed.services = [
            { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Emissão de RG', description: 'Emissão da Carteira de Identidade Nacional', duration_minutes: 30, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ]
        }
        if (!Array.isArray(parsed.system_settings) || parsed.system_settings.length === 0) {
          parsed.system_settings = [
            { key: 'monthly_limit', value: '200' },
            { key: 'second_issue_warning', value: 'Para emissão de 2ª via, é necessário apresentar o comprovante de pagamento da taxa DAE ou declaração de isenção.' },
            { key: 'available_days', value: '[1,2,3,4,5]' },
            { key: 'operating_hours', value: JSON.stringify({ morning: { start: '08:00', end: '12:00', enabled: true }, afternoon: { start: '13:00', end: '17:00', enabled: true } }) }
          ]
        }
        return parsed
      }
    }
  } catch {}
  return null
}

export function saveDiskData(data: any) {
  try {
    const dir = path.dirname(MOCK_DB_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(data, null, 2), 'utf-8')
    const stats = fs.statSync(MOCK_DB_FILE)
    lastDiskMtime = stats.mtimeMs
  } catch {}
}

// Define mockData no globalThis para persistir dados na memória entre Server Actions, Route Handlers e SSR
const globalAny = globalThis as any

// Seed inicial de agendamentos distribuídos nos dias úteis da semana atual e da próxima semana
export function buildSeedAppointments() {
  return [
    // Semana Atual: Segunda-feira
    {
      id: 'apt-00000000-0001',
      citizen_id: 'test',
      appointment_date: getBusinessDayDateString(0, 0),
      appointment_time: '09:00:00',
      appointment_type: 'first_issue',
      tipo: '1_VIA',
      type: 'first_issue',
      status: 'confirmed',
      protocol_number: `${getBusinessDayDateString(0, 0).replace(/-/g, '')}-1VIA01`,
      created_at: new Date().toISOString(),
      services: { name: 'Emissão de RG' },
      full_name: 'Maria Ruty Silva',
      phone: '(88) 98765-4321',
      sexo: 'Feminino',
      attendant: 'Guichê 01 - Dra. Lima'
    },
    {
      id: 'apt-00000000-0002',
      citizen_id: 'test',
      appointment_date: getBusinessDayDateString(0, 0),
      appointment_time: '09:30:00',
      appointment_type: 'second_issue',
      tipo: '2_VIA',
      type: 'second_issue',
      status: 'confirmed',
      protocol_number: `${getBusinessDayDateString(0, 0).replace(/-/g, '')}-2VIA02`,
      created_at: new Date().toISOString(),
      services: { name: 'Emissão de RG' },
      full_name: 'Carlos Eduardo Santos',
      phone: '(88) 91234-5678',
      sexo: 'Masculino',
      attendant: 'Guichê 02 - Dr. Silva'
    },
    // Semana Atual: Quarta-feira
    {
      id: 'apt-00000000-0003',
      citizen_id: 'test',
      appointment_date: getBusinessDayDateString(2, 0),
      appointment_time: '10:00:00',
      appointment_type: 'first_issue',
      tipo: '1_VIA',
      type: 'first_issue',
      status: 'confirmed',
      protocol_number: `${getBusinessDayDateString(2, 0).replace(/-/g, '')}-1VIA03`,
      created_at: new Date().toISOString(),
      services: { name: 'Emissão de RG' },
      full_name: 'Bruninha Oliveira',
      phone: '(88) 99956-2345',
      sexo: 'Feminino',
      attendant: 'Guichê 01 - Dra. Lima'
    },
    {
      id: 'apt-00000000-0004',
      citizen_id: 'test',
      appointment_date: getBusinessDayDateString(2, 0),
      appointment_time: '14:30:00',
      appointment_type: 'second_issue',
      tipo: '2_VIA',
      type: 'second_issue',
      status: 'confirmed',
      protocol_number: `${getBusinessDayDateString(2, 0).replace(/-/g, '')}-2VIA04`,
      created_at: new Date().toISOString(),
      services: { name: 'Emissão de RG' },
      full_name: 'Francisco Valdir Souza',
      phone: '(88) 98888-7777',
      sexo: 'Masculino',
      attendant: 'Guichê 02 - Dr. Silva'
    },
    // Semana Atual: Sexta-feira
    {
      id: 'apt-00000000-0005',
      citizen_id: 'test',
      appointment_date: getBusinessDayDateString(4, 0),
      appointment_time: '08:30:00',
      appointment_type: 'first_issue',
      tipo: '1_VIA',
      type: 'first_issue',
      status: 'confirmed',
      protocol_number: `${getBusinessDayDateString(4, 0).replace(/-/g, '')}-1VIA05`,
      created_at: new Date().toISOString(),
      services: { name: 'Emissão de RG' },
      full_name: 'Ana Carolina Ferreira',
      phone: '(88) 97777-8888',
      sexo: 'Feminino',
      attendant: 'Guichê 01 - Dra. Lima'
    },
    {
      id: 'apt-00000000-0006',
      citizen_id: 'test',
      appointment_date: getBusinessDayDateString(4, 0),
      appointment_time: '11:00:00',
      appointment_type: 'second_issue',
      tipo: '2_VIA',
      type: 'second_issue',
      status: 'confirmed',
      protocol_number: `${getBusinessDayDateString(4, 0).replace(/-/g, '')}-2VIA06`,
      created_at: new Date().toISOString(),
      services: { name: 'Emissão de RG' },
      full_name: 'Lucas Mendes Oliveira',
      phone: '(88) 96666-5555',
      sexo: 'Masculino',
      attendant: 'Guichê 02 - Dr. Silva'
    },
    // Próxima Semana: Segunda-feira
    {
      id: 'apt-00000000-0007',
      citizen_id: 'test',
      appointment_date: getBusinessDayDateString(0, 1),
      appointment_time: '10:00:00',
      appointment_type: 'first_issue',
      tipo: '1_VIA',
      type: 'first_issue',
      status: 'confirmed',
      protocol_number: `${getBusinessDayDateString(0, 1).replace(/-/g, '')}-1VIA07`,
      created_at: new Date().toISOString(),
      services: { name: 'Emissão de RG' },
      full_name: 'Juliana Ramos Peixoto',
      phone: '(88) 99111-2222',
      sexo: 'Feminino',
      attendant: 'Guichê 01 - Dra. Lima'
    },
    {
      id: 'apt-00000000-0008',
      citizen_id: 'test',
      appointment_date: getBusinessDayDateString(0, 1),
      appointment_time: '14:00:00',
      appointment_type: 'second_issue',
      tipo: '2_VIA',
      type: 'second_issue',
      status: 'confirmed',
      protocol_number: `${getBusinessDayDateString(0, 1).replace(/-/g, '')}-2VIA08`,
      created_at: new Date().toISOString(),
      services: { name: 'Emissão de RG' },
      full_name: 'Roberto Carlos Almeida',
      phone: '(88) 99333-4444',
      sexo: 'Masculino',
      attendant: 'Guichê 02 - Dr. Silva'
    },
    // Próxima Semana: Quarta-feira
    {
      id: 'apt-00000000-0009',
      citizen_id: 'test',
      appointment_date: getBusinessDayDateString(2, 1),
      appointment_time: '09:00:00',
      appointment_type: 'first_issue',
      tipo: '1_VIA',
      type: 'first_issue',
      status: 'confirmed',
      protocol_number: `${getBusinessDayDateString(2, 1).replace(/-/g, '')}-1VIA09`,
      created_at: new Date().toISOString(),
      services: { name: 'Emissão de RG' },
      full_name: 'Daniela Farias Castro',
      phone: '(88) 99555-6666',
      sexo: 'Feminino',
      attendant: 'Guichê 01 - Dra. Lima'
    }
  ]
}

export function resetMockStoreAppointments(): Record<string, any[]> {
  assertNotProductionWithoutSupabase()
  const store = getMockStore()
  store.appointments = buildSeedAppointments()
  saveDiskData(store)
  return store
}

export function getMockStore(): Record<string, any[]> {
  assertNotProductionWithoutSupabase()

  if (process.env.NODE_ENV === 'test' && globalAny.__schedulingMockData__) {
    return globalAny.__schedulingMockData__
  }

  // Always check if disk data is newer than in-memory cache (cross-process / worker sync)
  if (fs.existsSync(MOCK_DB_FILE)) {
    try {
      const stats = fs.statSync(MOCK_DB_FILE)
      if (!globalAny.__schedulingMockData__ || stats.mtimeMs > lastDiskMtime) {
        const diskData = loadDiskData()
        if (diskData && typeof diskData === 'object' && Array.isArray(diskData.appointments)) {
          globalAny.__schedulingMockData__ = diskData
          return globalAny.__schedulingMockData__
        }
      }
    } catch {}
  }

  if (globalAny.__schedulingMockData__) {
    return globalAny.__schedulingMockData__
  }

  const diskData = loadDiskData()
  if (diskData && typeof diskData === 'object' && Array.isArray(diskData.appointments)) {
    globalAny.__schedulingMockData__ = diskData
    return diskData
  }

  if (!globalAny.__schedulingMockData__) {
    globalAny.__schedulingMockData__ = {
      services: [
        { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Emissão de RG', description: 'Emissão da Carteira de Identidade Nacional', duration_minutes: 30, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ],
      system_settings: [
        { key: 'monthly_limit', value: '200' },
        { key: 'second_issue_warning', value: 'Para emissão de 2ª via, é necessário apresentar o comprovante de pagamento da taxa DAE ou declaração de isenção.' },
        { key: 'available_days', value: '[1,2,3,4,5]' },
        { key: 'operating_hours', value: JSON.stringify({ morning: { start: '08:00', end: '12:00', enabled: true }, afternoon: { start: '13:00', end: '17:00', enabled: true } }) }
      ],
      working_hours: [
        // Segunda a Sexta — manhã
        { day_of_week: 1, start_time: '08:00:00', end_time: '12:30:00', is_active: true },
        { day_of_week: 2, start_time: '08:00:00', end_time: '12:30:00', is_active: true },
        { day_of_week: 3, start_time: '08:00:00', end_time: '12:30:00', is_active: true },
        { day_of_week: 4, start_time: '08:00:00', end_time: '12:30:00', is_active: true },
        { day_of_week: 5, start_time: '08:00:00', end_time: '12:30:00', is_active: true },
        // Segunda a Sexta — tarde
        { day_of_week: 1, start_time: '13:30:00', end_time: '17:00:00', is_active: true },
        { day_of_week: 2, start_time: '13:30:00', end_time: '17:00:00', is_active: true },
        { day_of_week: 3, start_time: '13:30:00', end_time: '17:00:00', is_active: true },
        { day_of_week: 4, start_time: '13:30:00', end_time: '17:00:00', is_active: true },
        { day_of_week: 5, start_time: '13:30:00', end_time: '17:00:00', is_active: true },
      ],
      holidays: [],
      blocked_dates: [],
      appointments: buildSeedAppointments(),
      audit_logs: [
        {
          id: 'mock-log-1',
          user_id: 'test',
          action: 'LOGIN',
          resource: 'auth',
          details: 'Login administrativo com sucesso (Simulado)',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          profiles: { full_name: 'Administrador', email: 'admin@prefeitura.gov.br' }
        }
      ],
      profiles: [
        {
          id: 'test',
          role: 'admin',
          full_name: 'Administrador',
          email: 'admin@prefeitura.gov.br',
          cpf: '000.000.000-00',
          phone: '(11) 00000-0000',
          monthly_limit: 200,
          password_hash: '$2b$10$hket2Y5rNVt.mE1/jHQPjunjA330nKO8zlESghVQbVBAYhKcMQGOu' // '123456'
        }
      ],
      __seedDate: getTodayDateString(0)  // Tracks when seed was last generated
    }
    saveDiskData(globalAny.__schedulingMockData__)
  }
  return globalAny.__schedulingMockData__
}




export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isRealSupabase = Boolean(supabaseUrl && supabaseKey && process.env.NODE_ENV !== 'test')

  let isLoggedOut = false
  let sessionToken: string | null = null

  try {
    const cookieStore = await cookies()
    isLoggedOut = cookieStore.get('logged_out')?.value === 'true'
    sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value || null
  } catch {
    // Context outside request
  }

  interface ServerAuthUser {
    id: string
    email: string
    user_metadata: {
      full_name: string
      role: string
    }
    role: string
  }

  let authenticatedUser: ServerAuthUser | null = null

  if (isRealSupabase) {
    const realClient = createSupabaseClient(supabaseUrl!, supabaseKey!, {
      auth: { persistSession: false }
    })

    if (!isLoggedOut && sessionToken) {
      try {
        const session = await verifySessionToken(sessionToken)
        if (session?.sub) {
          let resolvedRole = session.role
          let resolvedEmail = session.email
          let resolvedName = session.full_name

          try {
            const { data: profile } = await realClient
              .from('profiles')
              .select('id, email, full_name, role, status')
              .eq('id', session.sub)
              .single()

            if (profile && profile.status !== 'inactive') {
              resolvedRole = profile.role || resolvedRole
              resolvedEmail = profile.email || resolvedEmail
              resolvedName = profile.full_name || resolvedName
            }
          } catch {}

          if (!resolvedRole) {
            if (session.sub === '00000000-0000-0000-0000-000000000001' || session.sub === 'test' || session.sub.includes('admin') || session.email?.includes('admin')) {
              resolvedRole = 'admin'
            } else {
              resolvedRole = 'citizen'
            }
          }

          authenticatedUser = {
            id: session.sub,
            email: resolvedEmail || (resolvedRole === 'admin' ? 'admin@prefeitura.gov.br' : ''),
            user_metadata: {
              full_name: resolvedName || (resolvedRole === 'admin' ? 'Administrador Geral' : 'Cidadão'),
              role: resolvedRole
            },
            role: resolvedRole
          }
        }
      } catch {}
    }

    return {
      auth: {
        getUser: async () => {
          if (!authenticatedUser) {
            return { data: { user: null }, error: { message: 'Not authenticated' } }
          }
          return {
            data: { user: authenticatedUser },
            error: null
          }
        },
        signOut: async () => {
          try {
            const cookieStore = await cookies()
            cookieStore.set('logged_out', 'true', { path: '/' })
            cookieStore.delete(SESSION_COOKIE_NAME)
            for (const legacy of LEGACY_AUTH_COOKIES) {
              cookieStore.delete(legacy)
            }
          } catch {}
          return { error: null }
        }
      },
      rpc: (fn: string, params: any) => realClient.rpc(fn, params),
      from: (table: string) => realClient.from(table)
    } as any
  }

  assertNotProductionWithoutSupabase()

  const mockStore = getMockStore()

  if (!isLoggedOut && sessionToken) {
    const session = await verifySessionToken(sessionToken)
    if (session?.sub) {
      // Papel e status ativo são obtidos estritamente do banco de dados (profiles)
      const profile = mockStore.profiles?.find((p: { id: string; status?: string; email?: string; full_name?: string; role?: string }) => p.id === session.sub)
      if (profile && profile.status !== 'inactive') {
        authenticatedUser = {
          id: profile.id,
          email: profile.email || '',
          user_metadata: {
            full_name: profile.full_name || '',
            role: profile.role || 'citizen'
          },
          role: profile.role || 'citizen'
        }
      }
    }
  }

  return {
    auth: {
      getUser: async () => {
        if (!authenticatedUser) {
          return { data: { user: null }, error: { message: 'Not authenticated' } }
        }
        return {
          data: { user: authenticatedUser },
          error: null
        }
      },
      signOut: async () => {
        try {
          const cookieStore = await cookies()
          cookieStore.set('logged_out', 'true', { path: '/' })
          cookieStore.delete(SESSION_COOKIE_NAME)
          for (const legacy of LEGACY_AUTH_COOKIES) {
            cookieStore.delete(legacy)
          }
        } catch {}
        return { error: null }
      }
    },
    rpc: async (fn: string, params: any) => {
      const mockStore = getMockStore()
      if (fn === 'book_appointment') {
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase()
        const datePrefix = (params.p_appointment_date || formatLocalDate()).replace(/-/g, '')
        const protocol = `${datePrefix}-${randomSuffix}`

        const rawType = (params.p_appointment_type || 'first_issue').toString().toLowerCase()
        const isSecond = rawType.includes('second') || rawType.includes('2') || rawType.includes('segunda')
        const normType = isSecond ? 'second_issue' : 'first_issue'

        const novoAgendamento = {
          id: `apt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          citizen_id: params.p_citizen_id || 'test',
          service_id: params.p_service_id || 1,
          appointment_date: params.p_appointment_date,
          appointment_time: params.p_appointment_time,
          appointment_type: normType,
          tipo: normType,
          type: normType,
          status: 'confirmed',
          protocol_number: protocol,
          created_at: new Date().toISOString(),
          services: { name: 'Emissão de RG' },
          full_name: params.p_full_name,
          cpf: params.p_cpf,
          phone: params.p_phone,
          sexo: params.p_sexo || 'Não informado',
          attendant: normType === 'first_issue' ? 'Guichê 01 - Dra. Lima' : 'Guichê 02 - Dr. Silva'
        };
        
        mockStore.appointments.push(novoAgendamento);
        saveDiskData(mockStore);
        
        return { 
          data: { 
            success: true,
            appointment_id: novoAgendamento.id,
            protocol: novoAgendamento.protocol_number 
          }, 
          error: null 
        }
      }
      return { data: null, error: null }
    },
    from: (table: string) => {
      const mockStore = getMockStore()
      if (!mockStore[table]) {
        mockStore[table] = []
      }
      const tableData = mockStore[table]
      const eqFilters: Record<string, any> = {}
      const neqFilters: Record<string, any> = {}
      const gteFilters: Record<string, any> = {}
      const lteFilters: Record<string, any> = {}
      const inFilters: Record<string, any[]> = {}
      const sortOrders: Array<{ column: string; ascending: boolean }> = []
      let limitCount: number | null = null
      let rangeOffset: number = 0
      let rangeLimit: number | null = null
      let pendingUpdatePayload: any = null
      let pendingDelete = false
      let isHeadMode = false       // true when { head: true } is passed to select()
      let isCountMode = false      // true when { count: 'exact' } is passed to select()
      let lastInsertedItem: any = null  // tracks the most recently inserted item
      let lastDeletedItems: any[] | null = null  // tracks items removed during delete

      const executePendingMutations = () => {
        let mutated = false
        if (pendingUpdatePayload && tableData) {
          for (let i = 0; i < tableData.length; i++) {
            let match = true
            for (const key in eqFilters) {
              if (tableData[i][key] !== eqFilters[key]) {
                match = false
                break
              }
            }
            if (match && Object.keys(eqFilters).length > 0) {
              tableData[i] = { ...tableData[i], ...pendingUpdatePayload }
              mutated = true
            }
          }
          pendingUpdatePayload = null
        }

        if (pendingDelete && tableData) {
          lastDeletedItems = []
          for (let i = tableData.length - 1; i >= 0; i--) {
            let match = true
            for (const key in eqFilters) {
              if (tableData[i][key] !== eqFilters[key]) {
                match = false
                break
              }
            }
            if (match && Object.keys(eqFilters).length > 0) {
              lastDeletedItems.push(tableData[i])
              tableData.splice(i, 1)
              mutated = true
            }
          }
          pendingDelete = false
        }

        if (mutated) {
          saveDiskData(mockStore)
        }
      }

      const applyFilters = (items: any[]) => {
        let result = [...items]

        // Apply eq filters
        for (const [key, val] of Object.entries(eqFilters)) {
          result = result.filter(item => item[key] === val)
        }

        // Apply neq filters
        for (const [key, val] of Object.entries(neqFilters)) {
          result = result.filter(item => item[key] !== val)
        }

        // Apply gte filters
        for (const [key, val] of Object.entries(gteFilters)) {
          result = result.filter(item => item[key] >= val)
        }

        // Apply lte filters
        for (const [key, val] of Object.entries(lteFilters)) {
          result = result.filter(item => item[key] <= val)
        }

        // Apply in filters
        for (const [key, val] of Object.entries(inFilters)) {
          result = result.filter(item => val.includes(item[key]))
        }

        // Apply ordering
        if (sortOrders.length > 0) {
          result.sort((a, b) => {
            for (const { column, ascending } of sortOrders) {
              if (a[column] < b[column]) return ascending ? -1 : 1
              if (a[column] > b[column]) return ascending ? 1 : -1
            }
            return 0
          })
        }

        return result
      }

      const chain: any = {
        select: (_cols?: string, options?: { count?: string; head?: boolean }) => {
          if (options?.head) isHeadMode = true
          if (options?.count) isCountMode = true
          return chain
        },
        eq: (col: string, val: any) => { eqFilters[col] = val; return chain },
        not: () => chain,
        order: (col: string, options?: { ascending?: boolean }) => {
          sortOrders.push({ column: col, ascending: options?.ascending !== false })
          return chain
        },
        limit: (n: number) => { limitCount = n; return chain },
        in: (col: string, vals: any[]) => { inFilters[col] = vals; return chain },
        neq: (col: string, val: any) => { neqFilters[col] = val; return chain },
        gte: (col: string, val: any) => { gteFilters[col] = val; return chain },
        lte: (col: string, val: any) => { lteFilters[col] = val; return chain },
        range: (from: number, to: number) => { 
          rangeOffset = from
          rangeLimit = to - from + 1
          return chain 
        },
        or: () => chain,
        ilike: () => chain,
        filter: () => chain,
        update: (payload: any) => {
          pendingUpdatePayload = payload
          return chain
        },
        insert: (payload: any) => {
          if (tableData) {
            const items = Array.isArray(payload) ? payload : [payload]
            for (const p of items) {
              const newItem = { 
                id: p.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, 
                created_at: new Date().toISOString(), 
                ...p 
              }
              tableData.push(newItem)
              lastInsertedItem = newItem  // track the last inserted item
            }
            saveDiskData(mockStore)
          }
          return chain
        },
        delete: () => {
          pendingDelete = true
          return chain
        },
        upsert: (payload: any) => {
          if (tableData) {
            const items = Array.isArray(payload) ? payload : [payload]
            for (const p of items) {
              const conflictKey = p.key !== undefined ? 'key' : 'id'
              const existingIdx = tableData.findIndex((item: any) => item[conflictKey] === p[conflictKey])
              if (existingIdx >= 0) {
                tableData[existingIdx] = { ...tableData[existingIdx], ...p }
              } else {
                tableData.push({ ...p })
              }
            }
            saveDiskData(mockStore)
          }
          return chain
        },
        single: async () => {
          executePendingMutations()
          const filtered = applyFilters(tableData)
          let responseData = null

          if (lastDeletedItems !== null) {
            responseData = lastDeletedItems[0] ?? null
          } else if (table === 'profiles') {
            responseData = filtered[0] || null
          } else if (table === 'system_settings') {
            const key = eqFilters['key'] || 'monthly_limit'
            const found = mockStore.system_settings.find((s: any) => s.key === key)
            if (found) {
              responseData = found
            } else if (key === 'available_days') {
              responseData = { key: 'available_days', value: '[1,2,3,4,5]' }
            } else if (key === 'operating_hours') {
              responseData = { key: 'operating_hours', value: JSON.stringify({ morning: { start: '08:00', end: '12:00', enabled: true }, afternoon: { start: '13:00', end: '17:00', enabled: true } }) }
            } else {
              responseData = { key, value: '200' }
            }
          } else if (table === 'holidays' || table === 'blocked_dates') {
            responseData = null
          } else if (lastInsertedItem) {
            // After an insert().select().single(), return the inserted item
            responseData = lastInsertedItem
          } else {
            responseData = filtered[0] ?? null
          }

          return { data: responseData, error: null }
        },
        then: (resolve: any, _reject?: any) => {
          executePendingMutations()

          if (lastDeletedItems !== null) {
            const result = { data: lastDeletedItems, count: lastDeletedItems.length, error: null }
            resolve(result)
            return Promise.resolve(result)
          }

          let filtered = applyFilters(tableData)
          const totalCount = filtered.length

          // head:true means count-only query — return no data rows
          if (isHeadMode) {
            resolve({ data: null, count: totalCount, error: null })
            return Promise.resolve({ data: null, count: totalCount, error: null })
          }

          if (rangeLimit !== null) {
            filtered = filtered.slice(rangeOffset, rangeOffset + rangeLimit)
          } else if (limitCount !== null) {
            filtered = filtered.slice(0, limitCount)
          }

          const result = { data: filtered, count: isCountMode ? totalCount : undefined, error: null }
          resolve(result)
          return Promise.resolve(result)
        }
      }
      return chain
    },
  } as any
}
