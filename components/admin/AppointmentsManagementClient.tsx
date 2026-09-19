'use client'

import React, { useState, useMemo, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { adminUpdateAppointmentStatus, adminConfirmAttendance, adminDeleteAppointment } from '@/app/actions/admin'
import CancellationDetailsModal from './CancellationDetailsModal'

export interface AppointmentItem {
  id: string
  protocol_number: string
  full_name: string
  phone: string
  sexo?: string
  cpf?: string
  appointment_date: string
  appointment_time: string
  appointment_type: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  origin?: 'online' | 'presencial'
  is_walk_in?: boolean
  attendant?: string
  created_at?: string
  updated_at?: string
  completed_at?: string
  cancellation_reason?: string
  cancelled_by?: string
  cancelled_at?: string
}

interface Props {
  initialAppointments: AppointmentItem[]
}

export function isOverdue(dateStr: string, timeStr: string, status: string): boolean {
  if (status === 'completed' || status === 'cancelled') return false
  if (status === 'no_show') return true
  if (!dateStr) return false

  try {
    const rawTime = (timeStr || '08:00').substring(0, 5)
    const [hours, minutes] = rawTime.split(':').map(Number)
    const [year, month, day] = dateStr.split('-').map(Number)

    if (isNaN(year) || isNaN(month) || isNaN(day)) return false

    const aptDateTime = new Date(year, month - 1, day, isNaN(hours) ? 8 : hours, isNaN(minutes) ? 0 : minutes, 0)
    return Date.now() > aptDateTime.getTime()
  } catch {
    return false
  }
}

export function isSecondIssue(apt: any): boolean {
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

export default function AppointmentsManagementClient({ initialAppointments }: Props) {
  const router = useRouter()
  const [appointments, setAppointments] = useState<AppointmentItem[]>(initialAppointments)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'overdue' | 'completed' | 'cancelled'>('all')
  const [serviceFilter, setServiceFilter] = useState<'all' | 'first_issue' | 'second_issue'>('all')
  const [originFilter, setOriginFilter] = useState<'all' | 'online' | 'presencial'>('all')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedCancelledAppointment, setSelectedCancelledAppointment] = useState<AppointmentItem | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Sync state when props change (e.g. navigation / SSR revalidation)
  useEffect(() => {
    setAppointments(initialAppointments)
  }, [initialAppointments])

  // Filter logic
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchName = apt.full_name?.toLowerCase().includes(q)
        const matchProto = apt.protocol_number?.toLowerCase().includes(q)
        const matchPhone = apt.phone?.toLowerCase().includes(q)
        if (!matchName && !matchProto && !matchPhone) return false
      }

      // Status filter
      const aptIsOverdue = isOverdue(apt.appointment_date, apt.appointment_time, apt.status)
      if (statusFilter === 'confirmed') {
        if (apt.status !== 'confirmed' && apt.status !== 'scheduled') return false
        if (aptIsOverdue) return false
      } else if (statusFilter === 'overdue') {
        if (!aptIsOverdue && apt.status !== 'no_show') return false
      } else if (statusFilter === 'completed') {
        if (apt.status !== 'completed') return false
      } else if (statusFilter === 'cancelled') {
        if (apt.status !== 'cancelled') return false
      }

      // Service filter
      if (serviceFilter !== 'all') {
        const isSecond = isSecondIssue(apt)
        if (serviceFilter === 'second_issue' && !isSecond) return false
        if (serviceFilter === 'first_issue' && isSecond) return false
      }

      // Origin filter
      if (originFilter !== 'all') {
        const isPresencial = apt.origin === 'presencial' || apt.is_walk_in || String(apt.protocol_number || '').startsWith('PRES-')
        if (originFilter === 'presencial' && !isPresencial) return false
        if (originFilter === 'online' && isPresencial) return false
      }

      return true
    })
  }, [appointments, search, statusFilter, serviceFilter, originFilter])

  // Counts for tabs and filters
  const counts = useMemo(() => {
    const all = appointments.length
    let confirmed = 0
    let overdueCount = 0
    let completed = 0
    let cancelled = 0
    let firstIssue = 0
    let secondIssue = 0

    appointments.forEach(a => {
      const isSec = isSecondIssue(a)
      if (isSec) secondIssue++
      else firstIssue++

      const overdue = isOverdue(a.appointment_date, a.appointment_time, a.status)
      if (a.status === 'completed') completed++
      else if (a.status === 'cancelled') cancelled++
      else if (overdue || a.status === 'no_show') overdueCount++
      else if (a.status === 'confirmed' || a.status === 'scheduled') confirmed++
    })

    return { all, confirmed, overdue: overdueCount, completed, cancelled, firstIssue, secondIssue }
  }, [appointments])

  // Handler: Confirm Attendance
  const handleConfirmAttendance = async (id: string, protocol: string) => {
    if (!id || typeof id !== 'string' || id.trim() === '') return
    setActionLoadingId(id)
    setFeedbackMessage(null)

    // Optimistic UI update
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'completed' } : a))

    startTransition(async () => {
      try {
        const res = await adminConfirmAttendance(id)
        if (res.success) {
          setFeedbackMessage({ type: 'success', text: `Atendimento do protocolo ${protocol} confirmado com sucesso!` })
          router.refresh()
        } else {
          setFeedbackMessage({ type: 'error', text: res.error || 'Erro ao confirmar atendimento.' })
        }
      } catch (err: any) {
        setFeedbackMessage({ type: 'error', text: err.message || 'Erro inesperado ao confirmar atendimento.' })
      } finally {
        setActionLoadingId(null)
      }
    })
  }

  // Handler: Delete Single Appointment
  const handleDeleteAppointment = async (id: string, protocol: string) => {
    if (!id || typeof id !== 'string' || id.trim() === '') return
    if (!confirm(`Tem certeza que deseja excluir o agendamento ${protocol}? Esta ação removerá o registro permanentemente.`)) {
      return
    }

    setActionLoadingId(id)
    setFeedbackMessage(null)

    // Optimistic UI update: ONLY target ID is removed
    setAppointments(prev => prev.filter(a => a.id !== id))

    startTransition(async () => {
      try {
        const res = await adminDeleteAppointment(id)
        if (res.success) {
          setFeedbackMessage({ type: 'success', text: `Agendamento ${protocol} excluído com sucesso.` })
          router.refresh()
        } else {
          setFeedbackMessage({ type: 'error', text: res.error || 'Erro ao excluir agendamento.' })
        }
      } catch (err: any) {
        setFeedbackMessage({ type: 'error', text: err.message || 'Erro inesperado ao excluir agendamento.' })
      } finally {
        setActionLoadingId(null)
      }
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="fw-bold mb-1 text-white" style={{ fontSize: '22px' }}>
            Gestão de Agendamentos & Atendimentos
          </h2>
          <p className="mb-0" style={{ color: '#94A3B8', fontSize: '13px' }}>
            Controle de presença, histórico de atendimentos e gerenciamento seguro dos cidadãos agendados.
          </p>
        </div>

        <Link href="/admin" className="btn btn-outline-primary btn-sm px-3 fw-semibold shadow-sm">
          <i className="bi bi-grid-3x3-gap me-1"></i> Ver na Grade Semanal
        </Link>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div 
          className={`alert ${feedbackMessage.type === 'success' ? 'alert-success' : 'alert-danger'} alert-dismissible fade show mb-3 shadow-sm`} 
          role="alert"
        >
          <i className={`bi ${feedbackMessage.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
          {feedbackMessage.text}
          <button type="button" className="btn-close" onClick={() => setFeedbackMessage(null)}></button>
        </div>
      )}

      {/* Filter Tabs / Pills */}
      <div className="card shadow-sm border-0 rounded-4 mb-4 bg-white p-3" style={{ border: '1px solid #E2E8F0' }}>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          
          {/* Status Tabs */}
          <div className="nav nav-pills gap-2" role="tablist">
            <button
              type="button"
              className={`nav-link btn-sm fw-semibold rounded-3 d-flex align-items-center gap-2 py-2 px-3 ${statusFilter === 'all' ? 'active bg-primary' : 'bg-light text-secondary border'}`}
              onClick={() => setStatusFilter('all')}
            >
              Todos
              <span className={`badge rounded-pill ${statusFilter === 'all' ? 'bg-white text-primary' : 'bg-secondary text-white'}`}>{counts.all}</span>
            </button>

            <button
              type="button"
              className={`nav-link btn-sm fw-semibold rounded-3 d-flex align-items-center gap-2 py-2 px-3 ${statusFilter === 'confirmed' ? 'active bg-success' : 'bg-light text-secondary border'}`}
              onClick={() => setStatusFilter('confirmed')}
            >
              <i className="bi bi-check-circle"></i> Confirmados
              <span className={`badge rounded-pill ${statusFilter === 'confirmed' ? 'bg-white text-success' : 'bg-secondary text-white'}`}>{counts.confirmed}</span>
            </button>

            <button
              type="button"
              className={`nav-link btn-sm fw-semibold rounded-3 d-flex align-items-center gap-2 py-2 px-3 ${statusFilter === 'overdue' ? 'active bg-danger text-white' : 'bg-light text-danger border'}`}
              onClick={() => setStatusFilter('overdue')}
            >
              <i className="bi bi-clock-history"></i> Atrasados / Não Compareceu
              <span className={`badge rounded-pill ${statusFilter === 'overdue' ? 'bg-white text-danger' : 'bg-danger text-white'}`}>{counts.overdue}</span>
            </button>

            <button
              type="button"
              className={`nav-link btn-sm fw-semibold rounded-3 d-flex align-items-center gap-2 py-2 px-3 ${statusFilter === 'completed' ? 'active bg-dark' : 'bg-light text-secondary border'}`}
              onClick={() => setStatusFilter('completed')}
            >
              <i className="bi bi-person-check-fill"></i> Atendidos
              <span className={`badge rounded-pill ${statusFilter === 'completed' ? 'bg-white text-dark' : 'bg-secondary text-white'}`}>{counts.completed}</span>
            </button>

            <button
              type="button"
              className={`nav-link btn-sm fw-semibold rounded-3 d-flex align-items-center gap-2 py-2 px-3 ${statusFilter === 'cancelled' ? 'active bg-secondary' : 'bg-light text-secondary border'}`}
              onClick={() => setStatusFilter('cancelled')}
            >
              <i className="bi bi-x-circle"></i> Cancelados
              <span className={`badge rounded-pill ${statusFilter === 'cancelled' ? 'bg-white text-dark' : 'bg-secondary text-white'}`}>{counts.cancelled}</span>
            </button>
          </div>

          {/* Quick Search */}
          <div style={{ minWidth: '260px', flex: '1', maxWidth: '360px' }}>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Buscar por nome, protocolo ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="btn btn-outline-secondary" type="button" onClick={() => setSearch('')}>
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Secondary Filters: Service & Origin */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3 pt-3 border-top">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <span className="small text-muted fw-semibold">Serviço:</span>
              <div className="btn-group btn-group-sm" role="group">
                <button
                  type="button"
                  className={`btn fw-semibold ${serviceFilter === 'all' ? 'btn-dark text-white' : 'btn-outline-secondary'}`}
                  onClick={() => setServiceFilter('all')}
                >
                  Todos ({counts.all})
                </button>
                <button
                  type="button"
                  className={`btn fw-semibold ${serviceFilter === 'first_issue' ? 'btn-success text-white' : 'btn-outline-success'}`}
                  onClick={() => setServiceFilter(serviceFilter === 'first_issue' ? 'all' : 'first_issue')}
                >
                  <i className="bi bi-person-vcard me-1"></i>
                  1ª Via RG ({counts.firstIssue})
                </button>
                <button
                  type="button"
                  className={`btn fw-semibold ${serviceFilter === 'second_issue' ? 'btn-primary text-white' : 'btn-outline-primary'}`}
                  onClick={() => setServiceFilter(serviceFilter === 'second_issue' ? 'all' : 'second_issue')}
                >
                  <i className="bi bi-person-vcard-fill me-1"></i>
                  2ª Via RG ({counts.secondIssue})
                </button>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <span className="small text-muted fw-semibold">Origem:</span>
              <select 
                className="form-select form-select-sm" 
                style={{ width: 'auto' }}
                value={originFilter}
                onChange={(e: any) => setOriginFilter(e.target.value)}
              >
                <option value="all">Todas as Origens</option>
                <option value="presencial">Presencial (Balcão)</option>
                <option value="online">Online (Portal)</option>
              </select>
            </div>
          </div>

          <div className="small text-muted fw-medium d-flex align-items-center gap-2">
            <span>Contagem por Tipo:</span>
            <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-2 py-1">
              1ª Via: <strong>{counts.firstIssue}</strong>
            </span>
            <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
              2ª Via: <strong>{counts.secondIssue}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card shadow-sm border-0 rounded-4 overflow-hidden bg-white" style={{ border: '1px solid #E2E8F0' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <tr style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th className="py-3 px-3">Protocolo</th>
                  <th>Cidadão</th>
                  <th>Sexo</th>
                  <th>Contato</th>
                  <th>Serviço</th>
                  <th>Data & Horário</th>
                  <th>Canal</th>
                  <th>Status</th>
                  <th className="text-end px-3">Ações de Atendimento</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center p-5 text-muted" style={{ fontSize: '13.5px' }}>
                      <i className="bi bi-folder-x fs-1 d-block mb-2 text-muted opacity-50"></i>
                      Nenhum agendamento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((apt) => {
                    const isSecond = String(apt.appointment_type).toLowerCase().includes('2') || String(apt.appointment_type).toLowerCase().includes('second')
                    const isPresencial = apt.origin === 'presencial' || apt.is_walk_in || String(apt.protocol_number || '').startsWith('PRES-')
                    const aptOverdue = isOverdue(apt.appointment_date, apt.appointment_time, apt.status)
                    const isLoading = actionLoadingId === apt.id

                    return (
                      <tr 
                        key={apt.id} 
                        style={{ 
                          fontSize: '13px',
                          backgroundColor: aptOverdue && apt.status !== 'completed' && apt.status !== 'cancelled' ? '#FEF2F2' : undefined 
                        }}
                      >
                        <td className="px-3 py-3 font-monospace fw-semibold" style={{ color: '#1E3A8A' }}>
                          {apt.protocol_number || `RG-${apt.id.substring(0, 8)}`}
                        </td>
                        <td className="fw-bold" style={{ color: '#10182B' }}>
                          {apt.full_name || 'Cidadão'}
                        </td>
                        <td style={{ color: '#475569' }}>
                          <span className="badge bg-light text-dark border fw-medium" style={{ fontSize: '11px' }}>
                            {apt.sexo || 'Não informado'}
                          </span>
                        </td>
                        <td style={{ color: '#475569' }}>{apt.phone || '—'}</td>
                        <td>
                          <span 
                            className="badge rounded-pill fw-semibold"
                            style={{
                              backgroundColor: isSecond ? '#EFF6FF' : '#ECFDF5',
                              color: isSecond ? '#1D4ED8' : '#047857',
                              border: `1px solid ${isSecond ? '#BFDBFE' : '#A7F3D0'}`,
                              fontSize: '11px'
                            }}
                          >
                            {isSecond ? '2ª Via RG' : '1ª Via RG'}
                          </span>
                        </td>
                        <td style={{ color: '#334155' }}>
                          <span className="fw-medium">{apt.appointment_date?.split('-').reverse().join('/')}</span>
                          <span className="text-muted ms-1">às {(apt.appointment_time || '08:00').substring(0, 5)}</span>
                        </td>
                        <td>
                          <span 
                            className="badge rounded-pill"
                            style={{
                              backgroundColor: isPresencial ? '#FEF3C7' : '#F1F5F9',
                              color: isPresencial ? '#92400E' : '#475569',
                              border: `1px solid ${isPresencial ? '#FDE68A' : '#E2E8F0'}`,
                              fontSize: '10.5px'
                            }}
                          >
                            {isPresencial ? '🚶 Presencial' : '🌐 Online'}
                          </span>
                        </td>
                        <td>
                          {apt.status === 'completed' ? (
                            <span className="badge rounded-pill bg-dark" style={{ fontSize: '11px' }}>
                              <i className="bi bi-check2-all me-1"></i> Atendido
                            </span>
                          ) : apt.status === 'cancelled' ? (
                            <div className="d-inline-flex align-items-center gap-1.5">
                              <span className="badge rounded-pill bg-danger" style={{ fontSize: '11px' }}>
                                <i className="bi bi-x-circle me-1"></i> Cancelado
                              </span>
                              <button
                                type="button"
                                className="btn btn-link p-0 text-danger text-opacity-75 text-decoration-none"
                                style={{ fontSize: '13px', lineHeight: 1 }}
                                onClick={() => {
                                  setSelectedCancelledAppointment(apt)
                                  setIsDetailsModalOpen(true)
                                }}
                                title="Ver detalhes do cancelamento"
                                aria-label="Ver detalhes do cancelamento"
                              >
                                <i className="bi bi-info-circle-fill"></i>
                              </button>
                            </div>
                          ) : (aptOverdue || apt.status === 'no_show') ? (
                            <span className="badge rounded-pill" style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', fontSize: '11px' }}>
                              <i className="bi bi-clock-history me-1"></i> Não Compareceu / Atrasado
                            </span>
                          ) : (
                            <span className="badge rounded-pill bg-success" style={{ fontSize: '11px' }}>
                              <i className="bi bi-check-circle me-1"></i> Confirmado
                            </span>
                          )}
                        </td>
                        <td className="text-end px-3">
                          <div className="d-inline-flex align-items-center gap-1">
                            {/* Action 1: Confirm Attendance */}
                            {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                              <button
                                type="button"
                                className="btn btn-success btn-sm py-1 px-2 fw-semibold d-inline-flex align-items-center gap-1"
                                style={{ fontSize: '12px' }}
                                disabled={isLoading}
                                onClick={() => handleConfirmAttendance(apt.id, apt.protocol_number)}
                                title="Confirmar que o cidadão compareceu e realizou o atendimento"
                              >
                                <i className="bi bi-person-check-fill"></i>
                                {isLoading ? 'Gravando...' : 'Confirmar Atendimento'}
                              </button>
                            )}

                            {/* Action 2: Ver Detalhes do Cancelamento (Apenas para Cancelados) */}
                            {apt.status === 'cancelled' && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm py-1 px-2.5 d-inline-flex align-items-center gap-1.5 rounded-2 fw-medium shadow-sm"
                                style={{
                                  fontSize: '12px',
                                  backgroundColor: '#F8FAFC',
                                  borderColor: '#CBD5E1',
                                  color: '#334155'
                                }}
                                onClick={() => {
                                  setSelectedCancelledAppointment(apt)
                                  setIsDetailsModalOpen(true)
                                }}
                                title="Ver detalhes do cancelamento"
                                aria-label="Ver detalhes do cancelamento"
                              >
                                <i className="bi bi-eye text-primary"></i>
                                <span>Ver Detalhes</span>
                              </button>
                            )}

                            {/* Action 3: Delete Button (Excluir registro) */}
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm py-1 px-2.5 d-inline-flex align-items-center gap-1 rounded-2 shadow-sm"
                              style={{ fontSize: '12px' }}
                              disabled={isLoading}
                              onClick={() => handleDeleteAppointment(apt.id, apt.protocol_number)}
                              title="Excluir permanentemente este agendamento (Delete)"
                              aria-label="Excluir agendamento"
                            >
                              <i className="bi bi-trash3"></i>
                              <span>Delete</span>
                            </button>
                          </div>
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

      {/* Cancellation Details Modal */}
      <CancellationDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        appointment={selectedCancelledAppointment}
      />
    </div>
  )
}
