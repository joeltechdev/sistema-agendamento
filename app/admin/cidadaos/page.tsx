import { createClient } from '@/lib/supabase/server'
import CitizensManagementClient, { CitizenItem } from '@/components/admin/CitizensManagementClient'

export const dynamic = 'force-dynamic'

export default async function CidadaosPage() {
  const supabase = await createClient()

  const { data: rawProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, cpf, phone, sexo, role, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  // Filtrar apenas cidadãos cadastrados (não operadores administrativos gerais)
  const citizens: CitizenItem[] = (rawProfiles || [])
    .filter((p: any) => p.role !== 'admin' && p.role !== 'manager')
    .map((p: any) => ({
      id: p.id,
      full_name: p.full_name || 'Sem nome',
      cpf: p.cpf || '',
      phone: p.phone || '',
      email: p.email || '',
      sexo: p.sexo || 'Não informado',
      role: p.role || 'citizen',
      created_at: p.created_at || new Date().toISOString()
    }))

  return <CitizensManagementClient initialCitizens={citizens} />
}
