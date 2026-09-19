'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { AppointmentItem } from './AppointmentsManagementClient'

interface ReportsManagementClientProps {
  initialAppointments: AppointmentItem[]
  metrics: {
    monthlyAppointments: number
    completedAppointments?: number
    limit: number
    restantes: number
  }
}

type GroupMode = 'week' | 'month' | 'all'

function getWeekRange(dateStr: string): { startStr: string; endStr: string; label: string; key: string } {
  if (!dateStr) return { startStr: '', endStr: '', label: 'Data Indefinida', key: 'unknown' }
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay() // 0 = Dom, 1 = Seg ...
  const diffToMonday = day === 0 ? -6 : 1 - day
  
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  
  const fmt = (d: Date) => {
    const dayFmt = String(d.getDate()).padStart(2, '0')
    const monthFmt = String(d.getMonth() + 1).padStart(2, '0')
    return `${dayFmt}/${monthFmt}/${d.getFullYear()}`
  }

  const key = `${monday.getFullYear()}-W${String(Math.ceil((((monday.getTime() - new Date(monday.getFullYear(),0,1).getTime()) / 86400000) + 1)/7)).padStart(2, '0')}`
  const label = `Semana de ${fmt(monday)} a ${fmt(sunday)}`
  return { startStr: fmt(monday), endStr: fmt(sunday), label, key }
}

function getMonthLabel(dateStr: string): { label: string; key: string } {
  if (!dateStr) return { label: 'Mês Indefinido', key: 'unknown' }
  const [y, m] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  const label = `${monthNames[date.getMonth()]} de ${date.getFullYear()}`
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  return { label, key }
}

function formatDateBR(dateStr?: string): string {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <span className="badge bg-success">Concluído</span>
    case 'confirmed':
      return <span className="badge bg-primary">Confirmado</span>
    case 'scheduled':
      return <span className="badge bg-info text-dark">Agendado</span>
    case 'no_show':
      return <span className="badge bg-warning text-dark">Não compareceu</span>
    case 'cancelled':
      return <span className="badge bg-danger">Cancelado</span>
    default:
      return <span className="badge bg-secondary">{status}</span>
  }
}

function isSecondIssue(apt: any): boolean {
  if (!apt) return false
  const str = String(
    apt.appointment_type || 
    apt.tipo || 
    apt.categoria || 
    apt.type || 
    apt.servico || 
    apt.services?.name || 
    ''
  ).toLowerCase().trim()
  return str.includes('segunda') || str.includes('2') || str.includes('second')
}

export default function ReportsManagementClient({
  initialAppointments,
  metrics
}: ReportsManagementClientProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>('week')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [serviceFilter, setServiceFilter] = useState<'all' | 'first_issue' | 'second_issue'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [issuedAt, setIssuedAt] = useState<string>('')

  useEffect(() => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('pt-BR')
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    setIssuedAt(`Emitido em: ${dateStr} às ${timeStr}`)
  }, [])

  // Counts for 1ª Via and 2ª Via
  const serviceCounts = useMemo(() => {
    let firstIssue = 0
    let secondIssue = 0
    initialAppointments.forEach(apt => {
      if (isSecondIssue(apt)) secondIssue++
      else firstIssue++
    })
    return { firstIssue, secondIssue }
  }, [initialAppointments])

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return initialAppointments.filter(apt => {
      if (statusFilter !== 'all' && apt.status !== statusFilter) return false
      
      if (serviceFilter !== 'all') {
        const isSecond = isSecondIssue(apt)
        if (serviceFilter === 'second_issue' && !isSecond) return false
        if (serviceFilter === 'first_issue' && isSecond) return false
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = apt.full_name?.toLowerCase().includes(query)
        const matchCpf = apt.cpf?.includes(query)
        const matchProtocol = apt.protocol_number?.toLowerCase().includes(query)
        if (!matchName && !matchCpf && !matchProtocol) return false
      }
      return true
    })
  }, [initialAppointments, statusFilter, serviceFilter, searchQuery])

  // Group by week or month
  const groupedData = useMemo(() => {
    if (groupMode === 'all') {
      return [{
        title: 'Todos os Agendamentos',
        key: 'all',
        items: filteredAppointments
      }]
    }

    const groups: { [key: string]: { title: string; items: AppointmentItem[] } } = {}

    for (const apt of filteredAppointments) {
      const { label, key } = groupMode === 'week' 
        ? getWeekRange(apt.appointment_date)
        : getMonthLabel(apt.appointment_date)

      if (!groups[key]) {
        groups[key] = { title: label, items: [] }
      }
      groups[key].items.push(apt)
    }

    // Sort descending by key
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, group]) => ({
        key,
        title: group.title,
        items: group.items
      }))
  }, [filteredAppointments, groupMode])

  const taxaOcupacao = metrics.limit > 0 
    ? Math.min(100, Math.round((metrics.monthlyAppointments / metrics.limit) * 100)) 
    : 0

  const handlePrint = () => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('pt-BR')
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    setIssuedAt(`Emitido em: ${dateStr} às ${timeStr}`)
    window.print()
  }

  const totalConcluidos = initialAppointments.filter(a => a.status === 'completed').length

  return (
    <div>
      {/* Cabeçalho de Impressão Oficial (Apenas visível no Print) */}
      <div className="d-none d-print-block mb-4 text-center border-bottom pb-3">
        <h3 className="fw-bold m-0" style={{ color: '#000000' }}>Prefeitura Municipal de Poranga</h3>
        <h5 className="m-0 text-secondary" style={{ fontSize: '15px' }}>Secretaria de Administração & Identificação Civil</h5>
        <div className="mt-2 fw-semibold" style={{ fontSize: '16px' }}>
          Relatório de Agendamentos e Atendimentos ({groupMode === 'week' ? 'Visão Semanal' : groupMode === 'month' ? 'Visão Mensal' : 'Visão Geral'})
        </div>
        <div className="small text-muted mt-1" suppressHydrationWarning>
          {issuedAt || 'Emitido em: --/--/---- às --:--'}
        </div>
      </div>

      {/* Cabeçalho da Tela (Visível no Navegador) */}
      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-4 no-print">
        <div>
          <h2 className="fw-bold mb-1 text-white" style={{ fontSize: '22px' }}>
            Relatórios & Métricas Operacionais
          </h2>
          <p className="mb-0" style={{ fontSize: '13px', color: '#94A3B8' }}>
            Consolidação de atendimentos, agrupamento por período e emissão de relatórios formatados.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="btn btn-primary d-flex align-items-center gap-2 fw-semibold px-3 py-2 shadow-sm"
          style={{ backgroundColor: '#2563EB', borderColor: '#2563EB', borderRadius: '8px' }}
        >
          <i className="bi bi-printer"></i>
          <span>Imprimir Relatório</span>
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="row g-3 mb-4">
        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100" style={{ border: '1px solid #E2E8F0' }}>
            <div className="text-muted small fw-bold text-uppercase mb-1" style={{ fontSize: '11px' }}>Total no Mês</div>
            <div className="fs-3 fw-bold" style={{ color: '#0F172A' }}>{metrics.monthlyAppointments}</div>
            <div className="small text-muted mt-1">Agendamentos no mês</div>
          </div>
        </div>

        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100" style={{ border: '1px solid #E2E8F0' }}>
            <div className="text-muted small fw-bold text-uppercase mb-1" style={{ fontSize: '11px' }}>1ª Via RG</div>
            <div className="fs-3 fw-bold" style={{ color: '#059669' }}>{serviceCounts.firstIssue}</div>
            <div className="small text-muted mt-1">Guichê 01 · Gratuito</div>
          </div>
        </div>

        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100" style={{ border: '1px solid #E2E8F0' }}>
            <div className="text-muted small fw-bold text-uppercase mb-1" style={{ fontSize: '11px' }}>2ª Via RG</div>
            <div className="fs-3 fw-bold" style={{ color: '#2563EB' }}>{serviceCounts.secondIssue}</div>
            <div className="small text-muted mt-1">Guichê 02 · Taxa DAE</div>
          </div>
        </div>

        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100" style={{ border: '1px solid #E2E8F0' }}>
            <div className="text-muted small fw-bold text-uppercase mb-1" style={{ fontSize: '11px' }}>Concluídos</div>
            <div className="fs-3 fw-bold" style={{ color: '#059669' }}>{totalConcluidos}</div>
            <div className="small text-muted mt-1">Atendidos no balcão</div>
          </div>
        </div>

        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100" style={{ border: '1px solid #E2E8F0' }}>
            <div className="text-muted small fw-bold text-uppercase mb-1" style={{ fontSize: '11px' }}>Vagas Livres</div>
            <div className="fs-3 fw-bold" style={{ color: '#0284C7' }}>{metrics.restantes}</div>
            <div className="small text-muted mt-1">Limite de {metrics.limit}</div>
          </div>
        </div>

        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100" style={{ border: '1px solid #E2E8F0' }}>
            <div className="text-muted small fw-bold text-uppercase mb-1" style={{ fontSize: '11px' }}>Taxa de Ocupação</div>
            <div className="fs-3 fw-bold" style={{ color: taxaOcupacao > 80 ? '#DC2626' : '#059669' }}>
              {taxaOcupacao}%
            </div>
            <div className="progress mt-2" style={{ height: '6px' }}>
              <div 
                className={`progress-bar ${taxaOcupacao > 80 ? 'bg-danger' : 'bg-success'}`}
                style={{ width: `${taxaOcupacao}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Controles de Agrupamento e Filtros */}
      <div className="card border-0 shadow-sm rounded-4 p-3 bg-white mb-4 no-print" style={{ border: '1px solid #E2E8F0' }}>
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          
          {/* Alternador de Agrupamento: Semana / Mês / Geral */}
          <div className="d-flex align-items-center gap-2">
            <span className="fw-semibold text-muted small me-1">Agrupar por:</span>
            <div className="btn-group" role="group">
              <button
                type="button"
                className={`btn btn-sm ${groupMode === 'week' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setGroupMode('week')}
              >
                <i className="bi bi-calendar-week me-1"></i>
                Semana
              </button>
              <button
                type="button"
                className={`btn btn-sm ${groupMode === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setGroupMode('month')}
              >
                <i className="bi bi-calendar-month me-1"></i>
                Mês
              </button>
              <button
                type="button"
                className={`btn btn-sm ${groupMode === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setGroupMode('all')}
              >
                <i className="bi bi-list-ul me-1"></i>
                Geral
              </button>
            </div>
          </div>

          {/* Filtros de Serviço, Status e Busca */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto', minWidth: '150px' }}
              value={serviceFilter}
              onChange={(e: any) => setServiceFilter(e.target.value)}
            >
              <option value="all">Todas as Vias ({serviceCounts.firstIssue + serviceCounts.secondIssue})</option>
              <option value="first_issue">1ª Via RG ({serviceCounts.firstIssue})</option>
              <option value="second_issue">2ª Via RG ({serviceCounts.secondIssue})</option>
            </select>

            <select
              className="form-select form-select-sm"
              style={{ width: 'auto', minWidth: '150px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos os Status</option>
              <option value="confirmed">Confirmados</option>
              <option value="completed">Concluídos</option>
              <option value="scheduled">Agendados</option>
              <option value="cancelled">Cancelados</option>
              <option value="no_show">Não Compareceu</option>
            </select>

            <div className="input-group input-group-sm" style={{ width: '220px' }}>
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Buscar por nome ou CPF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

        </div>
      </div>
      {groupedData.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 p-5 bg-white text-center">
          <i className="bi bi-inbox fs-1 text-muted mb-2"></i>
          <h6 className="fw-semibold text-dark">Nenhum agendamento encontrado</h6>
          <p className="text-muted small m-0">Ajuste os filtros de status ou o termo de busca para visualizar os registros.</p>
        </div>
      ) : (
        groupedData.map(group => {
          const concluidosGroup = group.items.filter(i => i.status === 'completed').length
          const confirmadosGroup = group.items.filter(i => i.status === 'confirmed').length
          const canceladosGroup = group.items.filter(i => i.status === 'cancelled').length
          const firstGroup = group.items.filter(i => !isSecondIssue(i)).length
          const secondGroup = group.items.filter(i => isSecondIssue(i)).length

          return (
            <div key={group.key} className="card border-0 shadow-sm rounded-4 bg-white mb-4 overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              {/* Header do Grupo */}
              <div className="p-3 bg-light border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div className="d-flex align-items-center gap-2">
                  <i className={`bi ${groupMode === 'week' ? 'bi-calendar-week text-primary' : 'bi-calendar-month text-success'} fs-5`}></i>
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '15px' }}>{group.title}</h6>
                  <span className="badge bg-secondary rounded-pill">{group.items.length} atendimentos</span>
                </div>

                <div className="d-flex align-items-center gap-2 small">
                  <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-2 py-1">
                    1ª Via: <strong>{firstGroup}</strong>
                  </span>
                  <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                    2ª Via: <strong>{secondGroup}</strong>
                  </span>
                  <span className="text-success fw-semibold ms-1"><i className="bi bi-check-circle me-1"></i>{concluidosGroup} conc.</span>
                  <span className="text-primary fw-semibold"><i className="bi bi-clock me-1"></i>{confirmadosGroup} conf.</span>
                  {canceladosGroup > 0 && (
                    <span className="text-danger fw-semibold"><i className="bi bi-x-circle me-1"></i>{canceladosGroup} canc.</span>
                  )}
                </div>
              </div>

              {/* Tabela de Registros do Grupo */}
              <div className="table-responsive m-0">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: '13px' }}>
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '110px' }}>Data</th>
                      <th style={{ width: '80px' }}>Hora</th>
                      <th>Cidadão</th>
                      <th>CPF</th>
                      <th>Serviço / Tipo</th>
                      <th>Origem</th>
                      <th style={{ width: '130px' }}>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map(apt => (
                      <tr key={apt.id}>
                        <td className="fw-semibold text-dark">{formatDateBR(apt.appointment_date)}</td>
                        <td className="text-secondary">{apt.appointment_time}</td>
                        <td>
                          <div className="fw-semibold text-dark">{apt.full_name}</div>
                          {apt.phone && <div className="text-muted small" style={{ fontSize: '11px' }}>{apt.phone}</div>}
                        </td>
                        <td className="text-secondary font-monospace" style={{ fontSize: '12px' }}>{apt.cpf || '-'}</td>
                        <td>
                          <span>{apt.appointment_type === 'second_issue' ? '2ª Via de RG' : '1ª Via de RG'}</span>
                        </td>
                        <td>
                          {apt.is_walk_in || apt.origin === 'presencial' ? (
                            <span className="badge bg-light text-dark border">Presencial</span>
                          ) : (
                            <span className="badge bg-light text-primary border">Online</span>
                          )}
                        </td>
                        <td>{getStatusBadge(apt.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}

      {/* Rodapé de Impressão (Assinatura do Responsável) */}
      <div className="d-none d-print-block mt-5 pt-4">
        <div className="row text-center">
          <div className="col-6">
            <div style={{ borderTop: '1px solid #000', width: '80%', margin: '0 auto', paddingTop: '6px' }}>
              Responsável pelo Atendimento
            </div>
          </div>
          <div className="col-6">
            <div style={{ borderTop: '1px solid #000', width: '80%', margin: '0 auto', paddingTop: '6px' }}>
              Coordenação de Identificação Civil
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
