'use client'

import React from 'react'
import { AppointmentItem } from './AppointmentsManagementClient'

interface Props {
  isOpen: boolean
  onClose: () => void
  appointment: AppointmentItem | null
}

function formatDateBr(dateStr?: string): string {
  if (!dateStr) return 'Não informado'
  // If YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr.split('-').reverse().join('/')
  }
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatDateTimeBr(dateStr?: string, timeStr?: string): string {
  if (!dateStr && !timeStr) return 'Não informado'
  const formattedDate = formatDateBr(dateStr)
  const formattedTime = timeStr ? timeStr.substring(0, 5) : ''
  if (formattedDate !== 'Não informado' && formattedTime) {
    return `${formattedDate} às ${formattedTime}`
  }
  return formattedDate !== 'Não informado' ? formattedDate : formattedTime || 'Não informado'
}

function formatTimestampBr(isoStr?: string): string {
  if (!isoStr) return 'Não registrado'
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return isoStr
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return isoStr
  }
}

export default function CancellationDetailsModal({ isOpen, onClose, appointment }: Props) {
  if (!isOpen || !appointment) return null

  const isSecondIssue = 
    String(appointment.appointment_type || '').toLowerCase().includes('2') || 
    String(appointment.appointment_type || '').toLowerCase().includes('second')

  const isPresencial = 
    appointment.origin === 'presencial' || 
    appointment.is_walk_in || 
    String(appointment.protocol_number || '').startsWith('PRES-')

  // Derive cancellation actor if not explicitly saved
  const cancellationActor = appointment.cancelled_by 
    ? appointment.cancelled_by 
    : isPresencial 
      ? 'Atendente do Posto (Balcão)' 
      : 'Cidadão (Portal de Agendamento)'

  // Cancellation timestamp: check cancelled_at or updated_at or created_at fallback
  const cancellationTimestamp = appointment.cancelled_at || appointment.updated_at

  return (
    <div 
      className="modal show d-block" 
      tabIndex={-1} 
      role="dialog"
      aria-labelledby="cancellationDetailsTitle"
      aria-modal="true"
      style={{ 
        backgroundColor: 'rgba(11, 18, 32, 0.75)', 
        backdropFilter: 'blur(4px)',
        zIndex: 1100 
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white">
          
          {/* Header */}
          <div 
            className="modal-header py-3 px-4 text-white d-flex align-items-center justify-content-between"
            style={{ backgroundColor: '#0B1220', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="d-flex align-items-center gap-3">
              <div 
                className="d-flex align-items-center justify-content-center text-white"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '9px',
                  backgroundColor: '#DC2626',
                  fontSize: '18px'
                }}
              >
                <i className="bi bi-x-octagon-fill"></i>
              </div>
              <div>
                <h5 id="cancellationDetailsTitle" className="modal-title fw-bold text-white mb-0" style={{ fontSize: '15px' }}>
                  Detalhes do Cancelamento
                </h5>
                <p className="mb-0 text-white-50 font-monospace" style={{ fontSize: '11.5px' }}>
                  Protocolo: {appointment.protocol_number || `RG-${appointment.id.substring(0, 8)}`}
                </p>
              </div>
            </div>

            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={onClose}
              aria-label="Fechar"
            ></button>
          </div>

          {/* Modal Body */}
          <div className="modal-body p-4" style={{ backgroundColor: '#F8FAFC' }}>
            
            {/* Status Alert Banner */}
            <div 
              className="d-flex align-items-center justify-content-between p-3 mb-3 rounded-3"
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B'
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-x-circle-fill fs-5 text-danger"></i>
                <div>
                  <div className="fw-bold" style={{ fontSize: '13px' }}>Agendamento Cancelado</div>
                  <div className="small text-muted" style={{ fontSize: '11.5px' }}>
                    Este horário foi liberado e o atendimento foi desativado.
                  </div>
                </div>
              </div>
              <span className="badge bg-danger rounded-pill px-3 py-2 fw-semibold" style={{ fontSize: '11px' }}>
                Status: Cancelado
              </span>
            </div>

            {/* Section 1: Detalhes do Cancelamento */}
            <div className="card border-0 shadow-sm rounded-3 mb-3 bg-white">
              <div className="card-header bg-transparent border-bottom py-2 px-3">
                <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '12.5px' }}>
                  <i className="bi bi-info-circle-fill text-danger"></i>
                  Registro do Cancelamento
                </h6>
              </div>
              <div className="card-body p-3">
                <div className="row g-3">
                  
                  {/* Data e Hora do Cancelamento */}
                  <div className="col-12 col-md-6">
                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>Data e Hora do Cancelamento</div>
                    <div className="fw-semibold text-dark d-flex align-items-center gap-1" style={{ fontSize: '13px' }}>
                      <i className="bi bi-clock-history text-danger"></i>
                      {cancellationTimestamp ? formatTimestampBr(cancellationTimestamp) : 'Data não registrada'}
                    </div>
                  </div>

                  {/* Responsável pelo Cancelamento */}
                  <div className="col-12 col-md-6">
                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>Cancelado Por</div>
                    <div className="fw-semibold text-dark d-flex align-items-center gap-1" style={{ fontSize: '13px' }}>
                      <i className="bi bi-person-x-fill text-secondary"></i>
                      {cancellationActor}
                    </div>
                  </div>

                  {/* Motivo do Cancelamento */}
                  <div className="col-12">
                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>Motivo do Cancelamento</div>
                    <div 
                      className="p-2 rounded-2"
                      style={{ 
                        backgroundColor: '#F1F5F9', 
                        border: '1px solid #E2E8F0',
                        fontSize: '12.5px',
                        color: appointment.cancellation_reason ? '#1E293B' : '#64748B'
                      }}
                    >
                      {appointment.cancellation_reason ? (
                        appointment.cancellation_reason
                      ) : (
                        <span className="fst-italic">
                          <i className="bi bi-chat-left-dots me-1"></i>
                          Não informado pelo atendente / solicitante no momento do cancelamento.
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Section 2: Dados Originais do Agendamento */}
            <div className="card border-0 shadow-sm rounded-3 mb-3 bg-white">
              <div className="card-header bg-transparent border-bottom py-2 px-3">
                <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '12.5px' }}>
                  <i className="bi bi-calendar-event text-primary"></i>
                  Dados Originais do Atendimento
                </h6>
              </div>
              <div className="card-body p-3">
                <div className="row g-3">
                  
                  {/* Nome do Cidadão */}
                  <div className="col-12 col-md-6">
                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>Cidadão</div>
                    <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>
                      {appointment.full_name || 'Não informado'}
                    </div>
                  </div>

                  {/* Contato / Telefone */}
                  <div className="col-12 col-md-6">
                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>Telefone / Contato</div>
                    <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                      {appointment.phone || 'Não informado'}
                    </div>
                  </div>

                  {/* Sexo */}
                  <div className="col-12 col-md-3">
                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>Sexo</div>
                    <div>
                      <span className="badge bg-light text-dark border fw-medium" style={{ fontSize: '11px' }}>
                        {appointment.sexo || 'Não informado'}
                      </span>
                    </div>
                  </div>

                  {/* CPF se disponível */}
                  <div className="col-12 col-md-3">
                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>CPF</div>
                    <div className="fw-semibold text-dark" style={{ fontSize: '12.5px' }}>
                      {appointment.cpf || 'Não informado'}
                    </div>
                  </div>

                  {/* Serviço Original */}
                  <div className="col-12 col-md-6">
                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>Serviço Solicitado</div>
                    <div>
                      <span 
                        className="badge rounded-pill fw-semibold"
                        style={{
                          backgroundColor: isSecondIssue ? '#EFF6FF' : '#ECFDF5',
                          color: isSecondIssue ? '#1D4ED8' : '#047857',
                          border: `1px solid ${isSecondIssue ? '#BFDBFE' : '#A7F3D0'}`,
                          fontSize: '11.5px'
                        }}
                      >
                        {isSecondIssue ? '2ª Via RG (Carteira de Identidade)' : '1ª Via RG (Primeira Emissão)'}
                      </span>
                    </div>
                  </div>

                  {/* Data & Horário Original */}
                  <div className="col-12 col-md-6">
                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>Data e Horário Original</div>
                    <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                      <i className="bi bi-calendar3 me-1 text-muted"></i>
                      {formatDateTimeBr(appointment.appointment_date, appointment.appointment_time)}
                    </div>
                  </div>

                  {/* Guichê / Atendente Designado */}
                  <div className="col-12 col-md-6">
                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>Guichê / Atendente Original</div>
                    <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                      <i className="bi bi-person-badge me-1 text-muted"></i>
                      {appointment.attendant || (isSecondIssue ? 'Guichê 02 (2ª Via)' : 'Guichê 01 (1ª Via)')}
                    </div>
                  </div>

                  {/* Canal de Origem */}
                  <div className="col-12 col-md-6">
                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>Canal de Agendamento</div>
                    <div>
                      <span 
                        className="badge rounded-pill"
                        style={{
                          backgroundColor: isPresencial ? '#FEF3C7' : '#F1F5F9',
                          color: isPresencial ? '#92400E' : '#475569',
                          border: `1px solid ${isPresencial ? '#FDE68A' : '#E2E8F0'}`,
                          fontSize: '11px'
                        }}
                      >
                        {isPresencial ? '🚶 Balcão Presencial' : '🌐 Portal Online'}
                      </span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Technical Notice */}
            <div className="text-muted text-center" style={{ fontSize: '11px' }}>
              <i className="bi bi-shield-check me-1"></i>
              Registro mantido para auditoria e histórico operacional. Não é permitida reativação direta.
            </div>

          </div>

          {/* Modal Footer */}
          <div 
            className="modal-footer py-2 px-4 bg-white d-flex justify-content-end"
            style={{ borderTop: '1px solid #E2E8F0' }}
          >
            <button 
              type="button" 
              className="btn btn-outline-secondary px-4 py-1.5 fw-medium rounded-3" 
              style={{ fontSize: '13px' }}
              onClick={onClose}
            >
              Fechar
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
