import { getAuditLogs } from '@/app/actions/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/auditoria')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const resolvedRole = profile?.role || user?.user_metadata?.role || 'citizen'
  if (!['admin', 'manager'].includes(resolvedRole)) {
    redirect('/admin')
  }

  const searchParamsObj = await searchParams;
  const page = parseInt(searchParamsObj.page || '1')
  const limit = 15

  const { logs, totalCount } = await getAuditLogs(page, limit)
  const totalPages = Math.ceil(totalCount / limit)

  return (
    <div>
      <h2 className="mb-4">Trilha de Auditoria</h2>
      
      <div className="card shadow-sm border-0">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Data/Hora</th>
                  <th>Operador (Admin)</th>
                  <th>Ação</th>
                  <th>Recurso</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-4 text-muted">
                      Nenhum registro de auditoria encontrado.
                    </td>
                  </tr>
                ) : (
                  logs.map((log: any) => {
                    const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
                    return (
                      <tr key={log.id}>
                        <td className="text-nowrap">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                        <td>{profile?.full_name || 'Desconhecido'}</td>
                        <td><span className="badge bg-secondary">{log.action}</span></td>
                        <td><code>{log.resource}</code></td>
                        <td className="small">{log.details}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {totalPages > 1 && (
          <div className="card-footer bg-white py-3">
            <nav aria-label="Navegação de páginas">
              <ul className="pagination mb-0 justify-content-center">
                <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                  <Link className="page-link" href={`/admin/auditoria?page=${page - 1}`}>Anterior</Link>
                </li>
                <li className="page-item disabled"><span className="page-link">Página {page} de {totalPages}</span></li>
                <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                  <Link className="page-link" href={`/admin/auditoria?page=${page + 1}`}>Próxima</Link>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>
    </div>
  )
}
