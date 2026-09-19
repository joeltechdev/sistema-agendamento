import { createClient } from '@/lib/supabase/server'
import BookingWizard from '@/components/ui/BookingWizard'
import { getSystemSettings, getActiveServices } from '@/services/institutionalService'
import Link from 'next/link'
import Image from 'next/image'

export default async function AgendamentoPage({
  searchParams
}: {
  searchParams?: Promise<{ via?: string; type?: string }> | { via?: string; type?: string }
}) {
  const supabase = await createClient()

  // Usuário opcional (se logado, aproveita os dados preexistentes; se visitante, agenda diretamente)
  const { data: { user } } = await supabase.auth.getUser()

  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : undefined
  const initialVia = resolvedParams?.via || resolvedParams?.type

  // Buscar perfil atual se logado
  let profile = null
  if (user) {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, cpf, phone, sexo')
      .eq('id', user.id)
      .single()
    profile = userProfile
  }

  // Buscar primeiro serviço ativo
  const services = await getActiveServices()
  if (services.length === 0) {
    return (
      <div className="container py-5 text-center">
        <div className="card shadow-sm border-0 p-5 mx-auto col-md-6 rounded-4">
          <i className="bi bi-exclamation-circle text-warning display-4 mb-3"></i>
          <h2 className="h4 fw-bold" style={{ color: '#0f172a' }}>Serviço Temporariamente Indisponível</h2>
          <p className="text-secondary">Não há postos de atendimento ou serviços ativos no momento. Tente novamente mais tarde.</p>
          <Link href="/" className="btn btn-outline-primary mt-2">Voltar ao Início</Link>
        </div>
      </div>
    )
  }

  const settings = await getSystemSettings(['second_issue_warning'])

  return (
    <main className="py-5" style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 120px)' }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-9 col-xl-8">
            
            {/* Page Header */}
            <div className="text-center mb-4">
              <div className="d-flex justify-content-center mb-3">
                <Link href="/" title="Voltar ao início">
                  <Image 
                    src="/images/logo-poranga.png" 
                    alt="Prefeitura Municipal de Poranga" 
                    width={210} 
                    height={70}
                    priority
                    style={{ objectFit: 'contain', height: 'auto', maxHeight: '58px', width: 'auto' }}
                  />
                </Link>
              </div>

              <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-2 border shadow-2xs" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                <span className="d-inline-block rounded-circle bg-success" style={{ width: 8, height: 8 }}></span>
                <span className="small fw-semibold" style={{ color: '#334155' }}>Sistema Oficial de Agendamento Civil</span>
              </div>
              
              <h1 className="h2 fw-bolder mb-2" style={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
                Emissão da Carteira de Identidade (RG)
              </h1>
              <p className="text-secondary small mx-auto col-md-10 mb-0">
                Selecione a categoria de atendimento, a data e horário convenientes para emissão do seu documento.
              </p>
            </div>
            
            <BookingWizard 
              profile={profile || { full_name: '', cpf: '', phone: '', sexo: '' }}
              service={services[0]}
              settings={settings}
              initialVia={initialVia}
            />
            
          </div>
        </div>
      </div>
    </main>
  )
}
