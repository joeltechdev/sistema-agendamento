import { createClient } from '@/lib/supabase/server'
import { AppointmentType, RequiredDocument, Service } from '@/types/institutional'

export async function getRequiredDocuments(type: AppointmentType): Promise<RequiredDocument[]> {
  const supabase = await createClient()

  // Buscar os documentos da tabela pública
  const { data, error } = await supabase
    .from('required_documents')
    .select('*')
    .eq('appointment_type', type)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao buscar documentos:', error)
    return []
  }

  return data as RequiredDocument[]
}

export async function getSystemSettings(keys: string[]): Promise<Record<string, string>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', keys)

  if (error) {
    console.error('Erro ao buscar settings:', error)
    return {}
  }

  const settingsMap: Record<string, string> = {}
  data?.forEach((setting: { key: string; value: unknown }) => {
    // Value é armazenado como JSONB
    settingsMap[setting.key] = setting.value as string
  })

  return settingsMap
}

export async function getActiveServices(): Promise<Service[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)

  if (error) {
    console.error('Erro ao buscar serviços:', error)
    return []
  }

  return data as Service[]
}
