'use client'

import React, { useState, useTransition } from 'react'
import { adminDeleteCitizen } from '@/app/actions/admin'

export interface CitizenItem {
  id: string
  full_name: string
  cpf?: string
  phone?: string
  email?: string
  sexo?: string
  role?: string
  created_at: string
}

interface Props {
  initialCitizens: CitizenItem[]
}

function getInitials(name?: string): string {
  if (!name) return 'CD'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'CD'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CitizensManagementClient({ initialCitizens }: Props) {
  const [citizens, setCitizens] = useState<CitizenItem[]>(initialCitizens)
  const [search, setSearch] = useState('')
  const [sexoFilter, setSexoFilter] = useState<string>('all')
  const [deletingCitizen, setDeletingCitizen] = useState<CitizenItem | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Filtragem
  const filtered = citizens.filter(c => {
    const term = search.toLowerCase().trim()
    const matchesSearch = !term || 
      (c.full_name && c.full_name.toLowerCase().includes(term)) ||
      (c.cpf && c.cpf.includes(term)) ||
      (c.phone && c.phone.includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))

    const matchesSexo = sexoFilter === 'all' || 
      (sexoFilter === 'Feminino' && c.sexo?.toLowerCase().startsWith('f')) ||
      (sexoFilter === 'Masculino' && c.sexo?.toLowerCase().startsWith('m')) ||
      (sexoFilter === 'Outro' && !c.sexo?.toLowerCase().startsWith('f') && !c.sexo?.toLowerCase().startsWith('m'))

    return matchesSearch && matchesSexo
  })

  // KPIs
  const totalCount = citizens.length
  const femaleCount = citizens.filter(c => c.sexo?.toLowerCase().startsWith('f')).length
  const maleCount = citizens.filter(c => c.sexo?.toLowerCase().startsWith('m')).length
  const otherCount = totalCount - (femaleCount + maleCount)

  // Exclusão de Cidadão
  const handleConfirmDelete = () => {
    if (!deletingCitizen) return
    const targetId = deletingCitizen.id
    setLoadingId(targetId)
    setFeedback(null)

    startTransition(async () => {
      try {
        const res = await adminDeleteCitizen(targetId)
        if (res.error) {
          setFeedback({ type: 'error', text: res.error })
        } else {
          setCitizens(prev => prev.filter(c => c.id !== targetId))
          setFeedback({ type: 'success', text: `Cidadão ${deletingCitizen.full_name || 'selecionado'} foi removido com sucesso.` })
          setDeletingCitizen(null)
        }
      } catch (err: any) {
        setFeedback({ type: 'error', text: err?.message || 'Erro inesperado ao remover cidadão.' })
      } finally {
        setLoadingId(null)
      }
    })
  }

  return (
    <div className="d-flex flex-column gap-4">
      {/* 1. Cabeçalho */}
      <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
        <div>
          <h1 className="h3 fw-bold text-white mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-people-fill text-success"></i>
            <span>Cadastro de Cidadãos</span>
          </h1>
          <p className="mb-0 text-white-50 small" style={{ fontSize: '13px' }}>
            Histórico e gerenciamento dos cidadãos que solicitaram serviços de identificação civil.
          </p>
        </div>
      </div>

      {/* 2. Feedback Alert */}
      {feedback && (
        <div 
          className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-danger'} py-2.5 px-3 small d-flex align-items-center justify-content-between border-0 rounded-3 shadow-sm`}
          role="alert"
          style={{
            backgroundColor: feedback.type === 'success' ? '#064E3B' : '#7F1D1D',
            color: feedback.type === 'success' ? '#D1FAE5' : '#FEE2E2'
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} flex-shrink-0`}></i>
            <span>{feedback.text}</span>
          </div>
          <button 
            type="button" 
            className="btn-close btn-close-white shadow-none" 
            onClick={() => setFeedback(null)}
          ></button>
        </div>
      )}

      {/* 3. Cards de Resumo (KPIs) */}
      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <div 
            className="p-3 rounded-4 shadow-sm h-100" 
            style={{ 
              backgroundColor: '#111827', 
              border: '1px solid rgba(255, 255, 255, 0.08)' 
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-white-50" style={{ fontSize: '12px' }}>Total Cidadãos</span>
              <div 
                className="rounded-3 d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA' }}
              >
                <i className="bi bi-people-fill"></i>
              </div>
            </div>
            <div className="h4 fw-bold text-white mb-0">{totalCount}</div>
            <div className="small text-white-50" style={{ fontSize: '11px' }}>Registrados no posto</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div 
            className="p-3 rounded-4 shadow-sm h-100" 
            style={{ 
              backgroundColor: '#111827', 
              border: '1px solid rgba(255, 255, 255, 0.08)' 
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-white-50" style={{ fontSize: '12px' }}>Mulheres</span>
              <div 
                className="rounded-3 d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#F472B6' }}
              >
                <i className="bi bi-gender-female"></i>
              </div>
            </div>
            <div className="h4 fw-bold text-white mb-0">{femaleCount}</div>
            <div className="small text-white-50" style={{ fontSize: '11px' }}>{totalCount > 0 ? Math.round((femaleCount / totalCount) * 100) : 0}% do total</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div 
            className="p-3 rounded-4 shadow-sm h-100" 
            style={{ 
              backgroundColor: '#111827', 
              border: '1px solid rgba(255, 255, 255, 0.08)' 
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-white-50" style={{ fontSize: '12px' }}>Homens</span>
              <div 
                className="rounded-3 d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34D399' }}
              >
                <i className="bi bi-gender-male"></i>
              </div>
            </div>
            <div className="h4 fw-bold text-white mb-0">{maleCount}</div>
            <div className="small text-white-50" style={{ fontSize: '11px' }}>{totalCount > 0 ? Math.round((maleCount / totalCount) * 100) : 0}% do total</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div 
            className="p-3 rounded-4 shadow-sm h-100" 
            style={{ 
              backgroundColor: '#111827', 
              border: '1px solid rgba(255, 255, 255, 0.08)' 
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-white-50" style={{ fontSize: '12px' }}>Outros / Não Inf.</span>
              <div 
                className="rounded-3 d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px', backgroundColor: 'rgba(148, 163, 184, 0.15)', color: '#94A3B8' }}
              >
                <i className="bi bi-person"></i>
              </div>
            </div>
            <div className="h4 fw-bold text-white mb-0">{otherCount}</div>
            <div className="small text-white-50" style={{ fontSize: '11px' }}>Registros sem especificação</div>
          </div>
        </div>
      </div>

      {/* 4. Barra de Filtros e Busca */}
      <div 
        className="p-3 rounded-4 shadow-sm" 
        style={{ 
          backgroundColor: '#111827', 
          border: '1px solid rgba(255, 255, 255, 0.08)' 
        }}
      >
        <div className="row g-3 align-items-center">
          <div className="col-md-7 col-lg-8">
            <div className="input-group">
              <span 
                className="input-group-text border-0" 
                style={{ backgroundColor: '#1E293B', color: '#94A3B8' }}
              >
                <i className="bi bi-search"></i>
              </span>
              <input 
                type="text" 
                className="form-control border-0 text-white shadow-none" 
                placeholder="Buscar por nome, CPF, telefone ou e-mail..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ backgroundColor: '#1E293B', fontSize: '13px' }}
              />
              {search && (
                <button 
                  className="btn border-0 text-white-50" 
                  type="button" 
                  onClick={() => setSearch('')}
                  style={{ backgroundColor: '#1E293B' }}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
          </div>

          <div className="col-md-5 col-lg-4">
            <select 
              className="form-select border-0 text-white shadow-none" 
              value={sexoFilter}
              onChange={(e) => setSexoFilter(e.target.value)}
              style={{ backgroundColor: '#1E293B', fontSize: '13px' }}
            >
              <option value="all">Todos os Gêneros / Sexo</option>
              <option value="Feminino">Feminino</option>
              <option value="Masculino">Masculino</option>
              <option value="Outro">Outro / Não informado</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Tabela de Cidadãos */}
      <div 
        className="card shadow-sm border-0 rounded-4 overflow-hidden" 
        style={{ 
          backgroundColor: '#111827', 
          border: '1px solid rgba(255, 255, 255, 0.08)' 
        }}
      >
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ color: '#E2E8F0' }}>
              <thead style={{ backgroundColor: '#0A101D', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <tr style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <th className="py-3 px-3">Cidadão / Nome</th>
                  <th>CPF</th>
                  <th>Gênero / Sexo</th>
                  <th>Telefone / Contato</th>
                  <th>Data de Cadastro</th>
                  <th className="text-end px-3">Ações</th>
                </tr>
              </thead>
              <tbody style={{ borderTop: 'none' }}>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-5 text-white-50" style={{ fontSize: '13.5px' }}>
                      <i className="bi bi-person-x display-6 d-block mb-2 opacity-50 text-white"></i>
                      Nenhum cidadão encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => {
                    const initials = getInitials(c.full_name)

                    return (
                      <tr key={c.id} style={{ fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {/* Nome & Avatar */}
                        <td className="px-3 py-3">
                          <div className="d-flex align-items-center gap-2.5">
                            <div 
                              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0 shadow-xs"
                              style={{ 
                                width: '34px', 
                                height: '34px', 
                                backgroundColor: '#2563EB', 
                                fontSize: '12px' 
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="fw-bold text-white">
                                {c.full_name || 'Sem nome informado'}
                              </div>
                              <div className="text-white-50 small" style={{ fontSize: '11.5px' }}>
                                {c.email || '—'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* CPF */}
                        <td className="text-white-50" style={{ fontSize: '12.5px' }}>
                          {c.cpf || 'Não cadastrado'}
                        </td>

                        {/* Sexo */}
                        <td>
                          <span 
                            className="badge rounded-pill px-2.5 py-1 fw-medium"
                            style={{ 
                              backgroundColor: c.sexo?.toLowerCase().startsWith('f') ? 'rgba(236, 72, 153, 0.2)' : c.sexo?.toLowerCase().startsWith('m') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                              color: c.sexo?.toLowerCase().startsWith('f') ? '#F472B6' : c.sexo?.toLowerCase().startsWith('m') ? '#34D399' : '#CBD5E1',
                              fontSize: '11px' 
                            }}
                          >
                            {c.sexo || 'Não informado'}
                          </span>
                        </td>

                        {/* Telefone */}
                        <td className="text-white-50">
                          {c.phone || '—'}
                        </td>

                        {/* Data */}
                        <td className="text-white-50" style={{ fontSize: '12px' }} suppressHydrationWarning>
                          {new Date(c.created_at).toLocaleDateString('pt-BR')}
                        </td>

                        {/* Ações */}
                        <td className="text-end px-3">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 shadow-xs"
                            title="Remover cidadão do sistema"
                            disabled={loadingId === c.id}
                            onClick={() => setDeletingCitizen(c)}
                            style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px' }}
                          >
                            <i className="bi bi-trash3-fill"></i>
                            <span>Remover</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CIDADÃO */}
      {deletingCitizen && (
        <div 
          className="modal fade show d-block" 
          tabIndex={-1} 
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px' }}>
            <div 
              className="modal-content border-0 text-white rounded-4 shadow-lg" 
              style={{ backgroundColor: '#111827', border: '1px solid rgba(239, 68, 68, 0.4)' }}
            >
              <div className="modal-header border-0 pb-0 pt-4 px-4">
                <div className="d-flex align-items-center gap-2 text-danger">
                  <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                  <h5 className="modal-title fw-bold text-white mb-0" style={{ fontSize: '16px' }}>
                    Remover Cidadão
                  </h5>
                </div>
                <button 
                  type="button" 
                  className="btn-close btn-close-white shadow-none" 
                  onClick={() => setDeletingCitizen(null)}
                  disabled={isPending}
                ></button>
              </div>

              <div className="modal-body px-4 py-3">
                <p className="text-white-50 small mb-3" style={{ fontSize: '13px', lineHeight: '1.5' }}>
                  Tem certeza que deseja remover o cadastro do cidadão <strong className="text-white">{deletingCitizen.full_name || 'selecionado'}</strong>?
                </p>

                <div className="p-3 rounded-3 mb-2" style={{ backgroundColor: '#1E293B', fontSize: '12px' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-white-50">Nome:</span>
                    <span className="fw-semibold text-white">{deletingCitizen.full_name || 'Sem nome'}</span>
                  </div>
                  {deletingCitizen.cpf && (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-white-50">CPF:</span>
                      <span className="text-white">{deletingCitizen.cpf}</span>
                    </div>
                  )}
                  {deletingCitizen.email && (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-white-50">E-mail:</span>
                      <span className="text-white">{deletingCitizen.email}</span>
                    </div>
                  )}
                  {deletingCitizen.phone && (
                    <div className="d-flex justify-content-between">
                      <span className="text-white-50">Telefone:</span>
                      <span className="text-white">{deletingCitizen.phone}</span>
                    </div>
                  )}
                </div>

                <p className="text-danger small mb-0" style={{ fontSize: '11.5px' }}>
                  * Esta ação excluirá os dados cadastrais deste cidadão.
                </p>
              </div>

              <div className="modal-footer border-0 pt-0 pb-4 px-4 d-flex justify-content-end gap-2">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary text-white border-secondary fw-semibold px-3"
                  onClick={() => setDeletingCitizen(null)}
                  disabled={isPending}
                  style={{ fontSize: '13px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger fw-semibold px-3.5 d-flex align-items-center gap-1.5 shadow"
                  onClick={handleConfirmDelete}
                  disabled={isPending}
                  style={{ fontSize: '13px' }}
                >
                  {isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Removendo...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash3-fill"></i>
                      <span>Confirmar Remoção</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
