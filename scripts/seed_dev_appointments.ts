/**
 * Script de Seed para Ambiente de Desenvolvimento
 * NUNCA EXECUTAR EM PRODUÇÃO.
 * 
 * Uso: npx ts-node --compiler-options "{\"module\":\"commonjs\"}" scripts/seed_dev_appointments.ts
 * Ou via npm run seed:dev
 */

import fs from 'fs'
import path from 'path'

if (process.env.NODE_ENV === 'production') {
  console.error('[ERRO CRÍTICO] O script de seed de desenvolvimento nunca deve ser executado em ambiente de produção!')
  process.exit(1)
}

const MOCK_DB_FILE = path.join(process.cwd(), '.next', 'mock_db_store.json')

function getBusinessDayDateString(dayOffsetFromMonday: number, weekOffset = 0): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday of current week
  const target = new Date(d.getFullYear(), d.getMonth(), diff + (weekOffset * 7) + dayOffsetFromMonday)
  const y = target.getFullYear()
  const m = String(target.getMonth() + 1).padStart(2, '0')
  const dayStr = String(target.getDate()).padStart(2, '0')
  return `${y}-${m}-${dayStr}`
}

function generateDevAppointments() {
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

function runSeed() {
  console.log('🌱 Inicializando seed de agendamentos para desenvolvimento...')
  
  let store: Record<string, unknown> = {}
  try {
    if (fs.existsSync(MOCK_DB_FILE)) {
      const raw = fs.readFileSync(MOCK_DB_FILE, 'utf-8')
      store = JSON.parse(raw)
    }
  } catch {
    store = {}
  }

  const appointments = generateDevAppointments()
  store.appointments = appointments
  store.__seedDate = new Date().toISOString()

  const dir = path.dirname(MOCK_DB_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(store, null, 2), 'utf-8')

  console.log(`✅ ${appointments.length} agendamentos ativos gerados com sucesso nos dias úteis!`)
  console.log(`📅 Semana Atual: ${getBusinessDayDateString(0, 0)} a ${getBusinessDayDateString(4, 0)}`)
  console.log(`📅 Próxima Semana: ${getBusinessDayDateString(0, 1)} a ${getBusinessDayDateString(4, 1)}`)
  appointments.forEach(apt => {
    console.log(`   - [${apt.appointment_date} ${apt.appointment_time}] ${apt.full_name} (${apt.tipo}) -> ${apt.attendant}`)
  })
}

runSeed()
