/**
 * @deprecated Esta tela foi desativada e arquivada por redundância com o fluxo de autocadastro de atendentes.
 * Preservada para possibilitar rollback simplificado.
 */
import React from 'react'

export const dynamic = 'force-dynamic'

const ATENDENTES_LIST = [
  { id: 1, name: 'Dra. Lima', role: 'Atendente de Identificação', guiche: 'Guichê 01', status: 'Ativo', totalAtendimentos: 142 },
  { id: 2, name: 'Dr. Silva', role: 'Atendente de Identificação', guiche: 'Guichê 02', status: 'Ativo', totalAtendimentos: 168 },
  { id: 3, name: 'Atendimento Rápido', role: 'Triagem & Presencial', guiche: 'Guichê 03', status: 'Ativo', totalAtendimentos: 95 }
]

export default function AtendentesPage() {
  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#0F172A', fontSize: '22px' }}>
            Gestão de Atendentes & Guichês
          </h2>
          <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
            Controle da equipe de atendimento, distribuição de guichês e postos de trabalho.
          </p>
        </div>
      </div>

      <div className="card shadow-sm border-0 rounded-4 overflow-hidden bg-white" style={{ border: '1px solid #E2E8F0' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <tr style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th className="py-3 px-3">Profissional / Atendente</th>
                  <th>Cargo / Função</th>
                  <th>Guichê Vinculado</th>
                  <th>Atendimentos Realizados</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {ATENDENTES_LIST.map((att) => (
                  <tr key={att.id} style={{ fontSize: '13px' }}>
                    <td className="px-3 py-3 fw-bold text-dark">
                      <div className="d-flex align-items-center gap-2">
                        <div 
                          className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                          style={{ width: '32px', height: '32px', backgroundColor: '#3B82F6', fontSize: '11.5px' }}
                        >
                          {att.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span>{att.name}</span>
                      </div>
                    </td>
                    <td style={{ color: '#475569' }}>{att.role}</td>
                    <td>
                      <span className="badge bg-light text-dark border px-2 py-1 fw-semibold" style={{ fontSize: '11.5px' }}>
                        <i className="bi bi-display me-1 text-primary"></i> {att.guiche}
                      </span>
                    </td>
                    <td className="fw-semibold" style={{ color: '#1E293B' }}>{att.totalAtendimentos}</td>
                    <td>
                      <span className="badge rounded-pill bg-success" style={{ fontSize: '11px' }}>
                        {att.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
