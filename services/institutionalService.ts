import { createClient } from '@/lib/supabase/server'
import { AppointmentType, RequiredDocument, Service } from '@/types/institutional'

export const DEFAULT_SERVICE: Service = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Emissão de RG',
  description: 'Emissão da Carteira de Identidade Nacional (1ª e 2ª Via)',
  duration_minutes: 30,
  is_active: true,
  created_at: '2026-09-21T02:23:32.521675+00:00',
  updated_at: '2026-09-21T02:23:32.521675+00:00'
}

export const DEFAULT_SETTINGS: Record<string, string> = {
  monthly_limit: '200',
  available_days: '[1,2,3,4,5]',
  second_issue_warning: 'Para emissão de 2ª via, é necessário apresentar o comprovante de pagamento da taxa DAE ou declaração de isenção.'
}

export async function getRequiredDocuments(type: AppointmentType): Promise<RequiredDocument[]> {
  try {
    const supabase = await createClient()

    // Buscar os documentos da tabela pública
    const { data, error } = await supabase
      .from('required_documents')
      .select('*')
      .eq('appointment_type', type)
      .order('created_at', { ascending: true })

    if (error || !data || data.length === 0) {
      if (type === 'first_issue' || type === '1_VIA') {
        return [
          { id: 'd1', service_id: '550e8400-e29b-41d4-a716-446655440001', appointment_type: 'first_issue', document_name: 'Certidão de Nascimento ou Casamento', description: 'Original legível', created_at: new Date().toISOString() },
          { id: 'd2', service_id: '550e8400-e29b-41d4-a716-446655440001', appointment_type: 'first_issue', document_name: 'Comprovante de Residência', description: 'Atualizado (últimos 90 dias)', created_at: new Date().toISOString() }
        ]
      }
      return [
        { id: 'd3', service_id: '550e8400-e29b-41d4-a716-446655440001', appointment_type: 'second_issue', document_name: 'Certidão de Nascimento ou Casamento', description: 'Original legível', created_at: new Date().toISOString() },
        { id: 'd4', service_id: '550e8400-e29b-41d4-a716-446655440001', appointment_type: 'second_issue', document_name: 'RG anterior ou Boletim de Ocorrência', description: 'Em caso de perda/furto', created_at: new Date().toISOString() },
        { id: 'd5', service_id: '550e8400-e29b-41d4-a716-446655440001', appointment_type: 'second_issue', document_name: 'Comprovante de Pagamento DAE ou Isenção', description: 'Guia paga', created_at: new Date().toISOString() }
      ]
    }

    return data as RequiredDocument[]
  } catch {
    return []
  }
}

export async function getSystemSettings(keys: string[]): Promise<Record<string, string>> {
  const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', keys)

    if (!error && data && data.length > 0) {
      data.forEach((setting: { key: string; value: unknown }) => {
        settingsMap[setting.key] = setting.value as string
      })
    }
  } catch (err) {
    console.error('Erro ao buscar settings:', err)
  }

  return settingsMap
}

export async function getActiveServices(): Promise<Service[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)

    if (error || !data || data.length === 0) {
      return [DEFAULT_SERVICE]
    }

    return data as Service[]
  } catch (err) {
    console.error('Erro ao buscar serviços:', err)
    return [DEFAULT_SERVICE]
  }
}

