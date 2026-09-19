'use client'

import React, { useState } from 'react'
import { createWalkInBooking } from '@/app/actions/booking'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (protocol: string) => void
  initialDate?: string
  initialTime?: string
}

const AVAILABLE_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
]

const GUICHES = [
  'Guichê 01 · Dra. Lima (Atendimento Geral)',
  'Guichê 02 · Dr. Silva (2ª Via / Prioritário)',
  'Guichê 03 · Atendimento Rápido'
]

function getTodayYMD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function WalkInBookingModal({ isOpen, onClose, onSuccess, initialDate, initialTime }: Props) {
  const [serviceType, setServiceType] = useState<'first_issue' | 'second_issue'>('first_issue')
  const [date, setDate] = useState<string>(initialDate || getTodayYMD())
  const [time, setTime] = useState<string>(initialTime ? initialTime.substring(0, 5) : '08:00')
  const [attendant, setAttendant] = useState<string>(GUICHES[0])
  const [fullName, setFullName] = useState<string>('')
  const [phone, setPhone] = useState<string>('')
  const [sexo, setSexo] = useState<string>('')
  const [address, setAddress] = useState<string>('')

  const [loading, setLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successProtocol, setSuccessProtocol] = useState<string | null>(null)

  // Reactively synchronize date and time when prefill props change or modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (initialDate) setDate(initialDate)
      if (initialTime) setTime(initialTime.substring(0, 5))
      setErrorMessage(null)
      setSuccessProtocol(null)
    }
  }, [isOpen, initialDate, initialTime])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!fullName.trim() || fullName.trim().length < 3) {
      setErrorMessage('Por favor, informe o nome completo do cidadão.')
      return
    }

    if (!sexo || sexo.trim() === '' || sexo === 'Selecione') {
      setErrorMessage('Por favor, selecione o sexo do cidadão.')
      return
    }

    if (!phone.trim() || phone.trim().length < 8) {
      setErrorMessage('Por favor, informe um telefone de contato válido.')
      return
    }

    setLoading(true)

    try {
      const res = await createWalkInBooking({
        appointment_date: date,
        appointment_time: time,
        appointment_type: serviceType,
        full_name: fullName.trim(),
        phone: phone.trim(),
        sexo: sexo.trim(),
        address: address.trim(),
        attendant
      })

      if (res.success && res.protocol) {
        setSuccessProtocol(res.protocol)
        if (onSuccess) {
          onSuccess(res.protocol)
        }

        const syncPayload = {
          type: 'NEW_BOOKING',
          protocol: res.protocol,
          full_name: fullName.trim(),
          appointment_date: date,
          appointment_time: time,
          appointment_type: serviceType,
          tipo: serviceType === 'second_issue' ? 'SEGUNDA_VIA' : 'PRIMEIRA_VIA',
          categoria: serviceType === 'second_issue' ? '2ª Via RG' : '1ª Via RG',
          phone: phone.trim(),
          sexo: sexo.trim(),
          attendant,
          origin: 'presencial',
          is_walk_in: true,
          timestamp: Date.now()
        }

        // 1. Broadcast across open tabs/windows on BOTH channel names
        try {
          const bc1 = new BroadcastChannel('booking_sync')
          bc1.postMessage(syncPayload)
          bc1.close()
        } catch {}

        try {
          const bc2 = new BroadcastChannel('scheduling_sync_channel')
          bc2.postMessage({
            ...syncPayload,
            type: 'NEW_BOOKING_EVENT'
          })
          bc2.close()
        } catch {}

        // 2. Custom DOM event in current window
        try {
          window.dispatchEvent(new CustomEvent('new_booking_event', { detail: syncPayload }))
        } catch {}

        // 3. LocalStorage sync fallback
        try {
          localStorage.setItem('last_booking_event', JSON.stringify(syncPayload))
        } catch {}

        setTimeout(() => {
          setSuccessProtocol(null)
          setFullName('')
          setPhone('')
          setSexo('')
          setAddress('')
          onClose()
        }, 1800)
      } else {
        setErrorMessage(res.error || 'Não foi possível registrar o agendamento.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao registrar agendamento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="modal show d-block" 
      tabIndex={-1} 
      style={{ 
        backgroundColor: 'rgba(11, 18, 32, 0.75)', 
        backdropFilter: 'blur(4px)',
        zIndex: 1100 
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
                  backgroundColor: '#3B82F6',
                  fontSize: '18px'
                }}
              >
                <i className="bi bi-person-plus-fill"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold text-white mb-0" style={{ fontSize: '15px' }}>
                  Agendamento Presencial (Balcão)
                </h5>
                <p className="mb-0 text-white-50" style={{ fontSize: '11px' }}>
                  Registro rápido para cidadãos presentes no posto de atendimento
                </p>
              </div>
            </div>

            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={onClose}
              disabled={loading}
            ></button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4" style={{ backgroundColor: '#F8FAFC' }}>
              
              {errorMessage && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 mb-3 rounded-3" style={{ fontSize: '13px' }}>
                  <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
                  <div>{errorMessage}</div>
                </div>
              )}

              {successProtocol && (
                <div className="alert alert-success d-flex align-items-center gap-2 py-3 px-3 mb-3 rounded-3" style={{ fontSize: '13.5px' }}>
                  <i className="bi bi-check-circle-fill fs-5 flex-shrink-0 text-success"></i>
                  <div>
                    <strong>Agendamento Presencial Confirmado!</strong>
                    <div className="small">Protocolo gerado: <span className="font-monospace fw-bold">{successProtocol}</span></div>
                  </div>
                </div>
              )}

              {/* Service Selection */}
              <div className="mb-3">
                <label className="form-label fw-bold text-dark mb-2" style={{ fontSize: '12.5px' }}>
                  Tipo de Atendimento / Serviço
                </label>
                <div className="row g-2">
                  <div className="col-6">
                    <button
                      type="button"
                      onClick={() => setServiceType('first_issue')}
                      className="w-100 p-3 rounded-3 text-start d-flex align-items-center justify-content-between transition-all"
                      style={{
                        backgroundColor: serviceType === 'first_issue' ? '#ECFDF5' : '#FFFFFF',
                        border: serviceType === 'first_issue' ? '2px solid #059669' : '1px solid #E2E8F0',
                        color: serviceType === 'first_issue' ? '#065F46' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <span 
                          className="rounded-circle d-inline-block" 
                          style={{ width: '10px', height: '10px', backgroundColor: '#059669' }}
                        ></span>
                        <div>
                          <div className="fw-bold" style={{ fontSize: '13px' }}>1ª Via RG</div>
                          <div style={{ fontSize: '11px', opacity: 0.8 }}>Primeira emissão civil</div>
                        </div>
                      </div>
                      {serviceType === 'first_issue' && <i className="bi bi-check-circle-fill text-success fs-5"></i>}
                    </button>
                  </div>

                  <div className="col-6">
                    <button
                      type="button"
                      onClick={() => setServiceType('second_issue')}
                      className="w-100 p-3 rounded-3 text-start d-flex align-items-center justify-content-between transition-all"
                      style={{
                        backgroundColor: serviceType === 'second_issue' ? '#EFF6FF' : '#FFFFFF',
                        border: serviceType === 'second_issue' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                        color: serviceType === 'second_issue' ? '#1E40AF' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <span 
                          className="rounded-circle d-inline-block" 
                          style={{ width: '10px', height: '10px', backgroundColor: '#2563EB' }}
                        ></span>
                        <div>
                          <div className="fw-bold" style={{ fontSize: '13px' }}>2ª Via RG</div>
                          <div style={{ fontSize: '11px', opacity: 0.8 }}>Renovação / 2ª via</div>
                        </div>
                      </div>
                      {serviceType === 'second_issue' && <i className="bi bi-check-circle-fill text-primary fs-5"></i>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Slot & Desk Grid */}
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label fw-bold text-dark mb-1" style={{ fontSize: '12px' }}>
                    <i className="bi bi-calendar-event me-1 text-primary"></i> Data do Atendimento
                  </label>
                  <input 
                    type="date"
                    className="form-control bg-white"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    style={{ fontSize: '13px', borderColor: '#CBD5E1' }}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-bold text-dark mb-1" style={{ fontSize: '12px' }}>
                    <i className="bi bi-clock me-1 text-primary"></i> Horário
                  </label>
                  <select 
                    className="form-select bg-white"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    style={{ fontSize: '13px', borderColor: '#CBD5E1' }}
                  >
                    {AVAILABLE_SLOTS.map(s => (
                      <option key={s} value={s}>{s} às {s.startsWith('11') ? '12:00' : s.startsWith('16') ? '17:00' : `${s.substring(0, 2)}:30`}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-bold text-dark mb-1" style={{ fontSize: '12px' }}>
                    <i className="bi bi-person-badge me-1 text-primary"></i> Guichê / Atendente
                  </label>
                  <select 
                    className="form-select bg-white"
                    value={attendant}
                    onChange={(e) => setAttendant(e.target.value)}
                    style={{ fontSize: '13px', borderColor: '#CBD5E1' }}
                  >
                    {GUICHES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Citizen Details Card */}
              <div className="card border-0 shadow-sm rounded-3 p-3 bg-white mb-2" style={{ border: '1px solid #E2E8F0' }}>
                <div className="text-uppercase small fw-bold text-muted mb-3" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                  Dados do Cidadão (Sem CPF)
                </div>

                <div className="row g-3">
                  <div className="col-md-5">
                    <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: '12px' }}>
                      Nome Completo <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="text"
                      className="form-control"
                      placeholder="Ex.: Maria Souza dos Santos"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      style={{ fontSize: '13px' }}
                    />
                  </div>

                  <div className="col-md-3">
                    <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: '12px' }}>
                      Sexo <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={sexo}
                      onChange={(e) => setSexo(e.target.value)}
                      required
                      style={{ fontSize: '13px', color: sexo ? '#10182B' : '#64748B' }}
                    >
                      <option value="">Selecione</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro / Não informado">Outro / Não informado</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: '12px' }}>
                      Telefone / WhatsApp <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="tel"
                      className="form-control"
                      placeholder="Ex.: (88) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      style={{ fontSize: '13px' }}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: '12px' }}>
                      Endereço / Bairro (Opcional)
                    </label>
                    <input 
                      type="text"
                      className="form-control"
                      placeholder="Ex.: Rua Central, 120 - Centro"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="modal-footer bg-white py-3 px-4 border-top d-flex justify-content-between">
              <button 
                type="button" 
                className="btn btn-outline-secondary px-4 fw-medium"
                onClick={onClose}
                disabled={loading}
                style={{ fontSize: '13px' }}
              >
                Cancelar
              </button>

              <button 
                type="submit" 
                className="btn btn-primary px-4 fw-bold d-flex align-items-center gap-2 shadow-sm"
                disabled={loading}
                style={{ backgroundColor: '#3B82F6', borderColor: '#3B82F6', fontSize: '13px' }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Gravando no Sistema...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle fs-6"></i>
                    Confirmar Agendamento Presencial
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  )
}
