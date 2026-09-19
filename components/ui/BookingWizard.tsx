'use client';

import React, { useState, useActionState } from 'react';
import Calendar from '@/components/calendar/Calendar';
import { fetchAvailableSlots, findNextAvailableDate } from '@/app/actions/availability';
import { createBooking } from '@/app/actions/booking';
import { TIPO_ATENDIMENTO } from '@/types/institutional';
import Link from 'next/link';

interface Profile {
  full_name: string;
  phone: string;
  sexo?: string;
  address?: string;
  cpf?: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
}

interface Props {
  profile: Profile;
  service: Service;
  settings: Record<string, string>;
  initialVia?: string;
}

// Safe local date formatting (YYYY-MM-DD) avoiding UTC shifts
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function BookingWizard({ profile, service, settings, initialVia }: Props) {
  const initialTypeResolved = React.useMemo<'first_issue' | 'second_issue' | ''>(() => {
    if (initialVia) {
      const v = String(initialVia).toLowerCase().trim();
      if (v === '2' || v === '2_via' || v.includes('second') || v.includes('segunda') || v.includes('2a') || v.includes('2ª')) {
        return 'second_issue';
      }
      if (v === '1' || v === '1_via' || v.includes('first') || v.includes('primeira') || v.includes('1a') || v.includes('1ª')) {
        return 'first_issue';
      }
    }
    return '';
  }, [initialVia]);

  const [step, setStep] = useState<number>(() => (initialTypeResolved ? 2 : 1));
  const [appointmentType, setAppointmentType] = useState<'first_issue' | 'second_issue' | ''>(initialTypeResolved);
  const [serviceError, setServiceError] = useState<string | null>(null);
  
  // Calendar States
  // NOTE: Date initialized as null to prevent SSR/Client hydration mismatch.
  // `new Date()` on the server has different milliseconds than the client,
  // causing React 19 hydration errors that silently disable all event handlers.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  // NOTE: Do NOT use useTransition here — it conflicts with useActionState's
  // internal transition in React 19 + Next.js 16 and causes step state to be
  // reverted after the user clicks the via selection buttons.
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSearchingNextDate, setIsSearchingNextDate] = useState(false);

  // Form State (Nome, Telefone, Sexo, Endereço — Sem CPF)
  const [formData, setFormData] = useState<Profile>({
    full_name: profile.full_name || '',
    phone: profile.phone || '',
    sexo: profile.sexo || '',
    address: profile.address || ''
  });

  // Server Action State
  const [bookingState, formAction, isPendingBooking] = useActionState(createBooking, undefined);

  // Seleciona o tipo de via e avança imediatamente para o Passo 2 (Calendário)
  const handleSelectServiceType = (type: 'first_issue' | 'second_issue') => {
    if (!service || !service.id) {
      setServiceError('Serviço de atendimento não encontrado. Por favor, recarregue a página.');
      return;
    }
    setServiceError(null);
    setAppointmentType(type);
    setStep(2);
  };

  // Client-only date initialization (set today's date safely on mount)
  React.useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  // Fetch slots when date changes (step 2: depends on date being initialized)
  React.useEffect(() => {
    if (!selectedDate) return;
    const dateStr = formatLocalDate(selectedDate);
    setIsLoadingSlots(true);
    fetchAvailableSlots(dateStr, service.duration_minutes).then(slots => {
      setAvailableSlots(slots);
      setIsLoadingSlots(false);
    }).catch(() => setIsLoadingSlots(false));
  }, [selectedDate, service.duration_minutes]);

  // Handlers
  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
    
    const dateStr = formatLocalDate(date);
    setIsLoadingSlots(true);
    fetchAvailableSlots(dateStr, service.duration_minutes).then(slots => {
      setAvailableSlots(slots);
      setIsLoadingSlots(false);
    }).catch(() => setIsLoadingSlots(false));
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep(3); // Advance straight to confirmation form
  };

  const handleFindNextAvailableDate = async () => {
    if (!selectedDate) return;
    setIsSearchingNextDate(true);
    try {
      const nextDateStr = await findNextAvailableDate(formatLocalDate(selectedDate), service.duration_minutes);
      if (nextDateStr) {
        const parts = nextDateStr.split('-').map(Number);
        const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
        setSelectedDate(targetDate);
        setSelectedTime('');
        
        setIsLoadingSlots(true);
        fetchAvailableSlots(nextDateStr, service.duration_minutes).then(slots => {
          setAvailableSlots(slots);
          setIsLoadingSlots(false);
        }).catch(() => setIsLoadingSlots(false));
      } else {
        alert('Não foram encontradas vagas adicionais nos próximos 30 dias.');
      }
    } catch (err) {
      console.error('Erro ao buscar próxima data:', err);
    } finally {
      setIsSearchingNextDate(false);
    }
  };

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  // Broadcast multi-tab real-time event
  React.useEffect(() => {
    if (bookingState?.success && bookingState.protocol) {
      const isSecond = appointmentType === 'second_issue';
      const payload = {
        type: 'NEW_BOOKING',
        protocol: bookingState.protocol,
        full_name: formData.full_name,
        appointment_date: selectedDate ? formatLocalDate(selectedDate) : '',
        appointment_time: selectedTime,
        appointment_type: appointmentType,
        tipo: isSecond ? TIPO_ATENDIMENTO.SEGUNDA_VIA : TIPO_ATENDIMENTO.PRIMEIRA_VIA,
        categoria: isSecond ? '2ª Via RG' : '1ª Via RG',
        phone: formData.phone,
        address: formData.address,
        timestamp: Date.now()
      };
      
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('booking_sync');
          channel.postMessage(payload);
          setTimeout(() => channel.close(), 100);
        }
        localStorage.setItem('last_booking_event', JSON.stringify(payload));
      } catch (err) {
        console.error('Error broadcasting booking event:', err);
      }
    }
  }, [bookingState, formData.full_name, formData.phone, formData.address, selectedDate, selectedTime, appointmentType]);

  const stepsList = [
    { num: 1, title: 'Serviço', subtitle: 'Tipo de Emissão', icon: 'bi-card-heading' },
    { num: 2, title: 'Data & Hora', subtitle: 'Escolha da Vaga', icon: 'bi-calendar-event' },
    { num: 3, title: 'Confirmar', subtitle: 'Seus Dados', icon: 'bi-check2-circle' },
  ];

  // Success Confirmation Screen
  if (bookingState?.success && bookingState.protocol) {
    const isSecond = appointmentType === 'second_issue';
    const displayDate = selectedDate ?? new Date();
    const weekday = displayDate.toLocaleDateString('pt-BR', { weekday: 'long' });
    const fullDate = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${displayDate.getDate()} de ${displayDate.toLocaleDateString('pt-BR', { month: 'long' })}`;

    return (
      <div 
        className="text-center p-4 p-md-5 bg-white mx-auto" 
        style={{ 
          maxWidth: '560px', 
          border: '1px solid #E5E8EC', 
          borderRadius: '14px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}
      >
        <div 
          className="mx-auto mb-3 d-inline-flex align-items-center justify-content-center rounded-circle" 
          style={{ width: '70px', height: '70px', backgroundColor: '#ECFDF5', color: '#059669' }}
        >
          <i className="bi bi-check-circle-fill display-5"></i>
        </div>
        
        <h2 className="h4 fw-bold mb-2" style={{ color: '#10182B' }}>Agendamento Confirmado!</h2>
        <p className="text-secondary small mb-4">Sua vaga para emissão da Carteira de Identidade foi garantida.</p>
        
        <div className="p-3 rounded-3 d-inline-block mx-auto mb-4 border w-100" style={{ backgroundColor: '#FAFBFC', borderColor: '#E2E6EC' }}>
          <span className="d-block small fw-bold text-uppercase text-secondary mb-1" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>
            Número do Protocolo
          </span>
          <span className="fs-3 fw-bold font-monospace d-block" style={{ color: '#1E3A8A' }}>
            {bookingState.protocol}
          </span>
        </div>

        <div className="p-3 mb-4 text-start border rounded-3 bg-white" style={{ borderColor: '#E2E6EC', fontSize: '13px' }}>
          <div className="d-flex justify-content-between py-1 border-bottom">
            <span className="text-secondary">Serviço:</span>
            <strong style={{ color: '#10182B' }}>{service.name} — {isSecond ? '2ª Via' : '1ª Via'}</strong>
          </div>
          <div className="d-flex justify-content-between py-1 border-bottom">
            <span className="text-secondary">Data e Horário:</span>
            <strong style={{ color: '#10182B' }}>{fullDate} às {selectedTime}</strong>
          </div>
          <div className="d-flex justify-content-between py-1 border-bottom">
            <span className="text-secondary">Titular:</span>
            <strong style={{ color: '#10182B' }}>{formData.full_name}</strong>
          </div>
          <div className="d-flex justify-content-between py-1 border-bottom">
            <span className="text-secondary">Telefone:</span>
            <strong style={{ color: '#10182B' }}>{formData.phone}</strong>
          </div>
          {formData.address && (
            <div className="d-flex justify-content-between py-1">
              <span className="text-secondary">Endereço:</span>
              <strong style={{ color: '#10182B' }}>{formData.address}</strong>
            </div>
          )}
        </div>

        {isSecond && (
          <div className="alert alert-info text-start border-0 small mb-4" style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A', borderRadius: '8px' }}>
            <i className="bi bi-info-circle-fill me-2 text-primary"></i>
            <strong>Atenção para a 2ª Via:</strong> Lembre-se de levar a guia DAE paga ou comprovante de isenção, além dos documentos originais.
          </div>
        )}

        <div className="d-flex flex-column flex-sm-row justify-content-center gap-3">
          <Link 
            href="/" 
            className="btn px-4 py-2 fw-semibold d-inline-flex align-items-center justify-content-center gap-2 shadow-sm" 
            style={{ backgroundColor: '#1E3A8A', color: '#FFFFFF', borderRadius: '8px' }}
          >
            <i className="bi bi-house-door-fill"></i> Início
          </Link>
          <a 
            href="/agendamento" 
            className="btn btn-outline-secondary px-4 py-2 fw-semibold d-inline-flex align-items-center justify-content-center gap-2" 
            style={{ borderRadius: '8px' }}
          >
            <i className="bi bi-calendar-plus"></i> Novo Agendamento
          </a>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-white mx-auto overflow-hidden" 
      style={{ 
        border: '1px solid #E5E8EC', 
        borderRadius: '14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }}
    >
      {/* Stepper Header */}
      <div className="p-4 border-bottom" style={{ backgroundColor: '#FAFBFC', borderColor: '#E5E8EC' }}>
        <div className="position-relative">
          <div 
            className="position-absolute top-50 start-0 translate-middle-y d-none d-md-block" 
            style={{ 
              height: '2px', 
              backgroundColor: '#E2E6EC', 
              width: '100%', 
              zIndex: 1 
            }}
          ></div>

          <div className="row position-relative g-2 justify-content-center" style={{ zIndex: 2 }}>
            {stepsList.map((s) => {
              const isCompleted = step > s.num;
              const isActive = step === s.num;

              return (
                <div key={s.num} className="col-4 text-center">
                  <div className="d-flex flex-column align-items-center">
                    <div 
                      className={`d-flex align-items-center justify-content-center rounded-circle fw-bold mb-2 transition-all ${
                        isCompleted ? 'text-white' : isActive ? 'text-white' : 'bg-white border text-secondary'
                      }`}
                      style={{ 
                        width: '38px', 
                        height: '38px', 
                        fontSize: '0.9rem',
                        backgroundColor: isActive ? '#1E3A8A' : isCompleted ? '#059669' : '#FFFFFF',
                        borderColor: isActive ? '#1E3A8A' : isCompleted ? '#059669' : '#CBD5E1',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        boxShadow: isActive ? '0 0 0 4px #EEF2FB' : 'none'
                      }}
                    >
                      {isCompleted ? (
                        <i className="bi bi-check-lg fs-6"></i>
                      ) : (
                        <span>{s.num}</span>
                      )}
                    </div>
                    <span 
                      className="small fw-bold" 
                      style={{ color: isActive ? '#1E3A8A' : isCompleted ? '#059669' : '#64748B', fontSize: '12.5px' }}
                    >
                      {s.title}
                    </span>
                    <span className="d-none d-sm-block text-secondary" style={{ fontSize: '11.5px' }}>
                      {s.subtitle}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-4 p-md-5">
        
        {bookingState?.error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-4" style={{ borderRadius: '8px' }} role="alert">
            <i className="bi bi-exclamation-triangle-fill fs-5 text-danger"></i>
            <div>{bookingState.error}</div>
          </div>
        )}

        {/* Passo 1: Categoria de Emissão (1ª Via / 2ª Via) */}
        {step === 1 && (
          <div>
            <div className="text-center mb-4">
              <span className="badge px-3 py-1 rounded-pill mb-2 fw-semibold" style={{ backgroundColor: '#EEF2FB', color: '#1E3A8A', fontSize: '11px' }}>
                PASSO 1 DE 3
              </span>
              <h2 className="h4 fw-bold" style={{ color: '#10182B' }}>Selecione o Tipo de Emissão de RG</h2>
              <p className="text-secondary small mx-auto col-md-10">
                Clique na categoria desejada para verificar os requisitos e avançar diretamente para o calendário de vagas.
              </p>
            </div>

            {serviceError && (
              <div className="alert alert-danger d-flex align-items-center gap-2 mb-4 rounded-3" role="alert">
                <i className="bi bi-exclamation-triangle-fill fs-5 text-danger"></i>
                <div>{serviceError}</div>
              </div>
            )}

            <div className="row g-4 justify-content-center">
              
              {/* Card 1ª Via */}
              <div className="col-md-6">
                <div 
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectServiceType('first_issue')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectServiceType('first_issue');
                    }
                  }}
                  className="h-100 p-4 rounded-4 cursor-pointer transition-all position-relative d-flex flex-column justify-content-between"
                  style={{ 
                    cursor: 'pointer',
                    backgroundColor: appointmentType === 'first_issue' ? '#F0FDF4' : '#FFFFFF',
                    border: `2px solid ${appointmentType === 'first_issue' ? '#059669' : '#CBD5E1'}`,
                    borderRadius: '14px',
                    boxShadow: appointmentType === 'first_issue' ? '0 8px 24px rgba(5, 150, 105, 0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
                    transition: 'all 0.2s ease',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (appointmentType !== 'first_issue') {
                      e.currentTarget.style.borderColor = '#059669';
                      e.currentTarget.style.backgroundColor = '#F8FCF9';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (appointmentType !== 'first_issue') {
                      e.currentTarget.style.borderColor = '#CBD5E1';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <div>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <span 
                        className="badge px-3 py-1 rounded-pill fw-bold" 
                        style={{ backgroundColor: '#059669', color: '#FFFFFF', fontSize: '0.75rem' }}
                      >
                        GRATUITO
                      </span>
                      <div 
                        className="rounded-circle d-flex align-items-center justify-content-center" 
                        style={{ 
                          width: '28px', 
                          height: '28px', 
                          backgroundColor: appointmentType === 'first_issue' ? '#059669' : '#F1F5F9',
                          color: appointmentType === 'first_issue' ? '#FFFFFF' : '#94A3B8'
                        }}
                      >
                        <i className={`bi ${appointmentType === 'first_issue' ? 'bi-check-lg' : 'bi-circle'}`} style={{ fontSize: '13px' }}></i>
                      </div>
                    </div>

                    <h3 className="h5 fw-bold mb-1" style={{ color: '#10182B' }}>1ª Via do RG</h3>
                    <p className="text-secondary small mb-3">
                      Para cidadãos que nunca emitiram Carteira de Identidade no Estado.
                    </p>

                    <div className="p-3 rounded-3 mb-3" style={{ backgroundColor: appointmentType === 'first_issue' ? '#DCFCE7' : '#FAFBFC', border: '1px dashed #CBD5E1' }}>
                      <strong className="d-block small fw-bold mb-2" style={{ color: '#065F46' }}>
                        <i className="bi bi-file-earmark-check-fill me-1"></i> Documentação Obrigatória:
                      </strong>
                      <ul className="list-unstyled small mb-0 d-flex flex-column gap-1" style={{ color: '#334155', fontSize: '12px' }}>
                        <li><i className="bi bi-check2 text-success me-1"></i> Certidão de Nascimento ou Casamento original</li>
                        <li><i className="bi bi-check2 text-success me-1"></i> CPF original em situação regular</li>
                        <li><i className="bi bi-check2 text-success me-1"></i> Comprovante de residência recente</li>
                        <li><i className="bi bi-check2 text-success me-1"></i> Menores de 16 anos acompanhados de responsável</li>
                      </ul>
                    </div>
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-success w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm rounded-3 mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectServiceType('first_issue');
                    }}
                  >
                    <span>Selecionar 1ª Via</span>
                    <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
              </div>

              {/* Card 2ª Via */}
              <div className="col-md-6">
                <div 
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectServiceType('second_issue')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectServiceType('second_issue');
                    }
                  }}
                  className="h-100 p-4 rounded-4 cursor-pointer transition-all position-relative d-flex flex-column justify-content-between"
                  style={{ 
                    cursor: 'pointer',
                    backgroundColor: appointmentType === 'second_issue' ? '#EFF6FF' : '#FFFFFF',
                    border: `2px solid ${appointmentType === 'second_issue' ? '#1E3A8A' : '#CBD5E1'}`,
                    borderRadius: '14px',
                    boxShadow: appointmentType === 'second_issue' ? '0 8px 24px rgba(30, 58, 138, 0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
                    transition: 'all 0.2s ease',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (appointmentType !== 'second_issue') {
                      e.currentTarget.style.borderColor = '#1E3A8A';
                      e.currentTarget.style.backgroundColor = '#F8FAFC';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (appointmentType !== 'second_issue') {
                      e.currentTarget.style.borderColor = '#CBD5E1';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <div>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <span 
                        className="badge px-3 py-1 rounded-pill fw-bold" 
                        style={{ backgroundColor: '#1E3A8A', color: '#FFFFFF', fontSize: '0.75rem' }}
                      >
                        TAXA DAE / ISENÇÃO
                      </span>
                      <div 
                        className="rounded-circle d-flex align-items-center justify-content-center" 
                        style={{ 
                          width: '28px', 
                          height: '28px', 
                          backgroundColor: appointmentType === 'second_issue' ? '#1E3A8A' : '#F1F5F9',
                          color: appointmentType === 'second_issue' ? '#FFFFFF' : '#94A3B8'
                        }}
                      >
                        <i className={`bi ${appointmentType === 'second_issue' ? 'bi-check-lg' : 'bi-circle'}`} style={{ fontSize: '13px' }}></i>
                      </div>
                    </div>

                    <h3 className="h5 fw-bold mb-1" style={{ color: '#10182B' }}>2ª Via do RG</h3>
                    <p className="text-secondary small mb-3">
                      Para renovação, perda, furto, extravio ou alteração de dados civis.
                    </p>

                    <div className="p-3 rounded-3 mb-3" style={{ backgroundColor: appointmentType === 'second_issue' ? '#DBEAFE' : '#FAFBFC', border: '1px dashed #CBD5E1' }}>
                      <strong className="d-block small fw-bold mb-2" style={{ color: '#1E3A8A' }}>
                        <i className="bi bi-file-earmark-check-fill me-1"></i> Documentação Obrigatória:
                      </strong>
                      <ul className="list-unstyled small mb-0 d-flex flex-column gap-1" style={{ color: '#334155', fontSize: '12px' }}>
                        <li><i className="bi bi-check2 text-primary me-1"></i> Certidão de Nascimento ou Casamento original</li>
                        <li><i className="bi bi-check2 text-primary me-1"></i> RG anterior ou B.O. (perda/furto)</li>
                        <li><i className="bi bi-check2 text-primary me-1"></i> Comprovante de residência atualizado</li>
                        <li><i className="bi bi-check2 text-primary me-1"></i> Guia DAE paga ou comprovação de isenção</li>
                      </ul>
                    </div>
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-primary w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm rounded-3 mt-2"
                    style={{ backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectServiceType('second_issue');
                    }}
                  >
                    <span>Selecionar 2ª Via</span>
                    <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
              </div>

            </div>

            <div className="mt-4 pt-3 text-end border-top" style={{ borderColor: '#E5E8EC' }}>
              <button 
                type="button" 
                className="btn px-5 py-2.5 fw-semibold" 
                disabled={!appointmentType} 
                onClick={handleNext}
                style={{ 
                  backgroundColor: '#1E3A8A', 
                  color: '#FFFFFF', 
                  borderRadius: '9px',
                  opacity: !appointmentType ? 0.6 : 1
                }}
              >
                Avançar para Calendário <i className="bi bi-arrow-right ms-2"></i>
              </button>
            </div>
          </div>
        )}

        {/* Passo 2: Calendário e Horários (Redesenhado) */}
        {step === 2 && (
          <div>
            <div className="text-center mb-4">
              <span className="badge px-3 py-1 rounded-pill mb-2 fw-semibold" style={{ backgroundColor: '#EEF2FB', color: '#1E3A8A', fontSize: '11px' }}>
                PASSO 2 DE 3
              </span>

              {/* Selected Service Pill with Quick Switch */}
              <div className="d-flex justify-content-center mb-2">
                <div 
                  className="d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill border shadow-2xs"
                  style={{
                    backgroundColor: appointmentType === 'second_issue' ? '#EFF6FF' : '#ECFDF5',
                    borderColor: appointmentType === 'second_issue' ? '#BFDBFE' : '#A7F3D0'
                  }}
                >
                  <span 
                    className="rounded-circle d-inline-block" 
                    style={{ width: 8, height: 8, backgroundColor: appointmentType === 'second_issue' ? '#2563EB' : '#059669' }}
                  ></span>
                  <span className="small fw-bold" style={{ color: appointmentType === 'second_issue' ? '#1E40AF' : '#065F46', fontSize: '12px' }}>
                    {appointmentType === 'second_issue' ? '2ª Via do RG (Taxa DAE / Isenção)' : '1ª Via do RG (Gratuito)'}
                  </span>
                  <button 
                    type="button" 
                    className="btn btn-link btn-sm p-0 ms-1 fw-semibold text-decoration-underline" 
                    style={{ fontSize: '11.5px', color: '#64748B' }}
                    onClick={() => setStep(1)}
                  >
                    Alterar
                  </button>
                </div>
              </div>

              <h2 className="h4 fw-bold" style={{ color: '#10182B' }}>Escolha a Data e Horário</h2>
              <p className="text-secondary small">Clique em uma data no calendário e selecione um dos horários disponíveis para continuar.</p>
            </div>

            <Calendar 
              availableSlots={availableSlots}
              selectedDate={selectedDate ?? new Date()}
              onDateChange={handleDateChange}
              onTimeSelect={handleTimeSelect}
              onFindNextAvailableDate={handleFindNextAvailableDate}
              selectedTime={selectedTime}
              isLoading={isLoadingSlots || !selectedDate}
              isSearchingNextDate={isSearchingNextDate}
            />

            <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: '#E5E8EC' }}>
              <button 
                type="button" 
                className="btn btn-outline-secondary px-4 fw-semibold" 
                onClick={handlePrev}
                style={{ borderRadius: '8px' }}
              >
                <i className="bi bi-arrow-left me-1"></i> Voltar
              </button>
              
              <button 
                type="button" 
                className="btn px-4 py-2 fw-semibold" 
                disabled={!selectedTime} 
                onClick={handleNext}
                style={{ 
                  backgroundColor: '#1E3A8A', 
                  color: '#FFFFFF', 
                  borderRadius: '8px',
                  opacity: !selectedTime ? 0.6 : 1
                }}
              >
                Continuar <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        )}

        {/* Passo 3: Formulário Simplificado (Apenas Nome, Telefone, Endereço — Sem CPF) */}
        {step === 3 && (
          <div className="mx-auto" style={{ maxWidth: '480px' }}>
            
            {/* Rótulo de seção */}
            <div className="text-center mb-3">
              <span 
                className="text-uppercase fw-bold d-block mb-1" 
                style={{ fontSize: '12px', letterSpacing: '0.05em', color: '#64748B' }}
              >
                CONFIRMAR AGENDAMENTO
              </span>
              <h2 className="h4 fw-bold mb-1" style={{ color: '#10182B' }}>Dados para Contato</h2>
              <p className="text-secondary small mb-0">Preencha os dados para emissão do comprovante oficial.</p>
            </div>

            {/* Resumo do agendamento (Data/Hora selecionada no topo) */}
            <div 
              className="p-3 mb-4 rounded-3 d-flex align-items-center justify-content-between"
              style={{
                backgroundColor: '#EEF2FB',
                border: '1px solid #BFDBFE',
                borderRadius: '10px'
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-clock-fill" style={{ color: '#1E3A8A', fontSize: '1.1rem' }}></i>
                <div>
                  <strong style={{ color: '#1E3A8A', fontSize: '13px', display: 'block' }}>
                    {(() => {
                      const d = selectedDate ?? new Date();
                      const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                      const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
                      return `${cap}, ${d.getDate()} de ${d.toLocaleDateString('pt-BR', { month: 'long' })} · ${selectedTime}`;
                    })()}
                  </strong>
                  <span style={{ fontSize: '11.5px', color: '#475569' }}>
                    {service.name} ({appointmentType === 'second_issue' ? '2ª Via' : '1ª Via'})
                  </span>
                </div>
              </div>
              
              <button 
                type="button" 
                className="btn btn-sm btn-link text-decoration-none p-0 fw-semibold" 
                style={{ color: '#1E3A8A', fontSize: '12px' }}
                onClick={() => setStep(2)}
              >
                Alterar
              </button>
            </div>

            <form action={formAction}>
              {/* Hidden required parameters */}
              <input type="hidden" name="service_id" value={service.id} />
              <input type="hidden" name="appointment_date" value={selectedDate ? formatLocalDate(selectedDate) : ''} />
              <input type="hidden" name="appointment_time" value={selectedTime} />
              <input type="hidden" name="appointment_type" value={appointmentType || 'first_issue'} />
              <input type="hidden" name="tipo" value={appointmentType === 'second_issue' ? TIPO_ATENDIMENTO.SEGUNDA_VIA : TIPO_ATENDIMENTO.PRIMEIRA_VIA} />

              {/* 1. Nome Completo */}
              <div className="mb-3">
                <label className="form-label mb-1" style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569' }}>
                  Nome completo *
                </label>
                <input 
                  type="text" 
                  name="full_name"
                  className="form-control" 
                  value={formData.full_name} 
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} 
                  placeholder="Seu nome completo"
                  required
                  style={{
                    border: '1px solid #E2E6EC',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '14px',
                    color: '#10182B'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#1E3A8A';
                    e.currentTarget.style.boxShadow = '0 0 0 3px #EEF2FB';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E2E6EC';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* 2. Sexo e Telefone em grid responsivo */}
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label mb-1" style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569' }}>
                    Sexo *
                  </label>
                  <select
                    name="sexo"
                    className="form-select"
                    value={formData.sexo || ''}
                    onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}
                    required
                    style={{
                      border: '1px solid #E2E6EC',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: formData.sexo ? '#10182B' : '#64748B'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#1E3A8A';
                      e.currentTarget.style.boxShadow = '0 0 0 3px #EEF2FB';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#E2E6EC';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">Selecione</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro / Não informado">Outro / Não informado</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label mb-1" style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569' }}>
                    Telefone *
                  </label>
                  <input 
                    type="text" 
                    name="phone"
                    className="form-control" 
                    value={formData.phone || ''} 
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                    placeholder="(00) 00000-0000"
                    required
                    style={{
                      border: '1px solid #E2E6EC',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: '#10182B'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#1E3A8A';
                      e.currentTarget.style.boxShadow = '0 0 0 3px #EEF2FB';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#E2E6EC';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* 3. Endereço */}
              <div className="mb-4">
                <label className="form-label mb-1" style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569' }}>
                  Endereço
                </label>
                <input 
                  type="text" 
                  name="address"
                  className="form-control" 
                  value={formData.address || ''} 
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
                  placeholder="Rua, número, bairro"
                  style={{
                    border: '1px solid #E2E6EC',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '14px',
                    color: '#10182B'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#1E3A8A';
                    e.currentTarget.style.boxShadow = '0 0 0 3px #EEF2FB';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E2E6EC';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <small className="d-block mt-1" style={{ fontSize: '11px', color: '#64748B' }}>
                  Usado apenas para contato sobre o agendamento.
                </small>
              </div>

              {/* Botão de Confirmação */}
              <div className="d-flex flex-column gap-2">
                <button 
                  type="submit" 
                  className="btn w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm" 
                  disabled={isPendingBooking || !formData.full_name || !formData.phone || !formData.sexo}
                  style={{ 
                    backgroundColor: '#1E3A8A', 
                    color: '#FFFFFF',
                    borderRadius: '9px',
                    fontSize: '14.5px',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  {isPendingBooking ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Confirmando vaga...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-circle fs-5"></i>
                      <span>Confirmar agendamento</span>
                    </>
                  )}
                </button>

                <button 
                  type="button" 
                  className="btn btn-sm btn-link text-secondary text-decoration-none mt-1"
                  onClick={() => setStep(2)}
                  disabled={isPendingBooking}
                  style={{ fontSize: '13px' }}
                >
                  <i className="bi bi-arrow-left me-1"></i> Voltar para o calendário
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
