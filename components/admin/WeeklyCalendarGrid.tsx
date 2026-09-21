'use client'

import React, { useState, useMemo, useCallback } from 'react'

export interface Appointment {
  id: string
  protocol_number: string
  full_name: string
  phone: string
  sexo?: string
  appointment_date: string
  appointment_time: string
  appointment_type: string
  tipo?: string
  categoria?: string
  status: string
  attendant?: string
  cpf?: string
  origin?: string
  is_walk_in?: boolean
  services?: { name: string }
}

interface Props {
  appointments: Appointment[]
  newlyAddedId: string | null
  jumpToDate?: string | null
  onWeekChange?: (startDate: string, endDate: string) => void
  onSlotClick?: (dateStr: string, slotStr: string) => void
  onAppointmentStatusChange?: (appointmentId: string, newStatus: 'confirmed' | 'completed' | 'cancelled') => void
}

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
  '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
]

// Helper to calculate time end (+30 min)
export function calculateEndTime(startTime: string): string {
  if (!startTime) return '09:00'
  const [h, m] = startTime.substring(0, 5).split(':').map(Number)
  const date = new Date()
  date.setHours(isNaN(h) ? 8 : h, isNaN(m) ? 30 : m + 30, 0, 0)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// Safe local date formatting (YYYY-MM-DD) avoiding UTC shifts
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Extract citizen avatar initials (e.g. "Ana Silva" -> "AS")
export function getInitials(name: string): string {
  if (!name) return 'CD'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Convert any date format (YYYY-MM-DD, DD/MM/YYYY, ISO String, Date) to local YYYY-MM-DD
export function normalizeDateStringToYMD(dateInput: any): string {
  if (!dateInput) return ''
  if (dateInput instanceof Date) return formatLocalDate(dateInput)
  const str = String(dateInput).trim()

  // Handle Brazilian DD/MM/YYYY
  if (str.includes('/')) {
    const parts = str.split('/')
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        // DD/MM/YYYY -> YYYY-MM-DD
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
      } else if (parts[0].length === 4) {
        // YYYY/MM/DD -> YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
      }
    }
  }

  // Regex match for YYYY-MM-DD pattern in ISO strings (e.g. 2026-09-16T00:00:00.000Z or 2026-09-16 08:00:00)
  const ymdMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`
  }

  return str.split('T')[0].trim()
}

// Normalize any time format ('08:00', '08:00:00', '8:00', '2026-09-16T08:00:00Z') to HH:mm
export function normalizeTimeStringToHHMM(timeInput: any): string {
  if (!timeInput) return ''
  const str = String(timeInput).trim()
  
  if (str.includes('T')) {
    const timePart = str.split('T')[1]
    return normalizeTimeStringToHHMM(timePart)
  }

  const timeMatch = str.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, '0')
    const mm = timeMatch[2]
    return `${hh}:${mm}`
  }

  return str.slice(0, 5)
}

// Helper to get current week's Monday dynamically according to municipal operational rules
// On weekends (Saturday/Sunday), since municipal service (Mon-Fri) has completed for the week,
// the default week is the upcoming business week (next Monday).
export function getMondayOfCurrentWeek(dateInput: Date | string = new Date()): Date {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput)
  const day = d.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  if (day === 6) {
    // Saturday: +2 days -> Next Monday
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2, 0, 0, 0, 0)
  }
  if (day === 0) {
    // Sunday: +1 day -> Next Monday
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0)
  }
  const diff = d.getDate() - day + 1
  return new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0)
}

// Helper to get Monday for a specific target date (for jump/navigation without weekend-advancing)
export function getMondayForDate(dateInput: Date | string): Date {
  let d: Date
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.split('T')[0]
    const parts = cleanStr.includes('/') ? cleanStr.split('/').reverse().map(Number) : cleanStr.split('-').map(Number)
    if (parts.length === 3) {
      d = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
    } else {
      d = new Date(dateInput)
    }
  } else {
    d = new Date(dateInput)
  }
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0)
}

// Fast service identifier (2ª Via vs 1ª Via)
export function isSecondIssueAppointment(booking: any): boolean {
  if (!booking) return false
  const str = String(
    booking.tipo || 
    booking.categoria || 
    booking.appointment_type || 
    booking.type || 
    booking.servico || 
    booking.services?.name || 
    ''
  ).toLowerCase().trim()
  
  if (str.includes('segunda') || str.includes('2') || str.includes('second')) return true

  // Fallback para guichê / atendente
  const att = String(booking.attendant || '').toLowerCase()
  if (att.includes('guichê 02') || att.includes('guiche 02') || att.includes('dr. silva')) {
    return true
  }

  return false
}

// Helper to check if an appointment time has passed without attendance
export function isAppointmentOverdue(appointmentDate?: string, appointmentTime?: string): boolean {
  if (!appointmentDate) return false
  const targetDate = normalizeDateStringToYMD(appointmentDate)
  const targetTime = normalizeTimeStringToHHMM(appointmentTime || '08:00')
  
  const [y, m, d] = targetDate.split('-').map(Number)
  const [hh, mm] = targetTime.split(':').map(Number)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return false

  const appointmentDateTime = new Date(y, m - 1, d, isNaN(hh) ? 8 : hh, isNaN(mm) ? 0 : mm, 0)
  const now = new Date()
  return now.getTime() > appointmentDateTime.getTime()
}

export type CardColorTheme = 'green' | 'blue' | 'orange' | 'red'

export function getAppointmentCardTheme(apt: Appointment): CardColorTheme {
  const status = (apt.status || '').toLowerCase().trim()
  const isOverdue = isAppointmentOverdue(apt.appointment_date, apt.appointment_time)

  // 1. Red: If marked 'no_show' OR if time has passed and attendance not confirmed
  if (status === 'no_show' || (isOverdue && status !== 'completed' && status !== 'cancelled')) {
    return 'red'
  }

  const isSpecial = 
    Boolean((apt as any).is_special) || 
    Boolean((apt as any).prioritario) ||
    String(apt.tipo || apt.categoria || '').toLowerCase().includes('especial') ||
    String(apt.tipo || apt.categoria || '').toLowerCase().includes('priorit')

  // 2. Orange: Status 'pending' / 'pendente' or Special / Priority case
  if (status === 'pending' || status === 'pendente' || status === 'warning' || isSpecial) {
    return 'orange'
  }

  // 3. Blue: 2ª Via RG
  if (isSecondIssueAppointment(apt)) {
    return 'blue'
  }

  // 4. Green: 1ª Via RG / Confirmado
  return 'green'
}

export default function WeeklyCalendarGrid({ 
  appointments, 
  newlyAddedId, 
  jumpToDate, 
  jumpToSlot,
  onWeekChange,
  onSlotClick,
  onAppointmentStatusChange
}: Props & { jumpToSlot?: { date: string; time?: string; protocol?: string } | null }) {
  // 1. Centralized Week State: anchored to Monday
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMondayOfCurrentWeek())

  // 2. Modal State for details
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false)

  // Navigation handlers with callback trigger (Monday to Friday scope)
  const updateWeekAndNotify = useCallback((newMonday: Date) => {
    setCurrentWeekStart(newMonday)
    if (onWeekChange) {
      const startStr = formatLocalDate(newMonday)
      const friday = new Date(newMonday.getFullYear(), newMonday.getMonth(), newMonday.getDate() + 4, 0, 0, 0, 0)
      const endStr = formatLocalDate(friday)
      onWeekChange(startStr, endStr)
    }
  }, [onWeekChange])

  // Reactively jump to a target week date (e.g. from real-time toast action)
  React.useEffect(() => {
    if (jumpToDate) {
      const targetMonday = getMondayForDate(jumpToDate)
      updateWeekAndNotify(targetMonday)
    }
  }, [jumpToDate, updateWeekAndNotify])

  // Reactively jump to a target week date & slot with smooth scroll
  React.useEffect(() => {
    if (jumpToSlot?.date) {
      const targetMonday = getMondayForDate(jumpToSlot.date)
      updateWeekAndNotify(targetMonday)
      if (jumpToSlot.time) {
        const timeNorm = normalizeTimeStringToHHMM(jumpToSlot.time)
        setTimeout(() => {
          const rowEl = document.getElementById(`slot-row-${timeNorm}`)
          if (rowEl) {
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 150)
      }
    }
  }, [jumpToSlot, updateWeekAndNotify])

  // Generate 5 business week days (Monday to Friday, excluding weekends)
  const weekDays = useMemo(() => {
    const days: Array<{ 
      date: Date
      dateStr: string
      dayLabel: string
      formatted: string
      isToday: boolean
      isTomorrow: boolean 
    }> = []

    const dayNamesShort = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
    const today = new Date()
    const todayStr = formatLocalDate(today)
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    const tomorrowStr = formatLocalDate(tomorrow)

    for (let i = 0; i < 5; i++) {
      const d = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + i, 0, 0, 0, 0)
      const dateStr = formatLocalDate(d)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')

      const isToday = dateStr === todayStr
      const isTomorrow = dateStr === tomorrowStr

      let dayLabel = dayNamesShort[i]
      if (isToday) dayLabel = 'Hoje'
      else if (isTomorrow) dayLabel = 'Amanhã'

      days.push({
        date: d,
        dateStr,
        dayLabel,
        formatted: `${day}/${month}`,
        isToday,
        isTomorrow
      })
    }
    return days
  }, [currentWeekStart])

  const handlePrevWeek = () => {
    const prevMonday = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() - 7, 0, 0, 0, 0)
    updateWeekAndNotify(prevMonday)
  }

  const handleNextWeek = () => {
    const nextMonday = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + 7, 0, 0, 0, 0)
    updateWeekAndNotify(nextMonday)
  }

  const handleToday = () => {
    const todayMonday = getMondayOfCurrentWeek()
    updateWeekAndNotify(todayMonday)
  }

  // Robust, normalized slot matcher that guarantees matching across any date/time formatting
  const getAppointmentsForSlot = useCallback((dateStr: string, slotStr: string): Appointment[] => {
    if (!appointments || appointments.length === 0) return []
    const targetDate = normalizeDateStringToYMD(dateStr)
    const targetSlot = normalizeTimeStringToHHMM(slotStr)

    const matches = appointments.filter(apt => {
      // Exclude completed and cancelled attendances from active grid (they are visible in "Atendimentos Realizados" / History)
      if (apt.status === 'completed' || apt.status === 'cancelled') return false

      const rawDate = apt.appointment_date || (apt as any).date || (apt as any).dataHora || (apt as any).data || (apt as any).created_at
      const aptDate = normalizeDateStringToYMD(rawDate)
      if (aptDate !== targetDate) return false

      const rawTime = apt.appointment_time || (apt as any).start_time || (apt as any).time || (apt as any).horario || (apt as any).dataHora || ''
      const aptTime = normalizeTimeStringToHHMM(rawTime)
      return aptTime === targetSlot
    })

    return matches
  }, [appointments])

  // Formatter for current week header title
  const weekRangeTitle = useMemo(() => {
    if (weekDays.length === 0) return ''
    const start = weekDays[0].date
    const end = weekDays[weekDays.length - 1].date

    const startDay = String(start.getDate()).padStart(2, '0')
    const endDay = String(end.getDate()).padStart(2, '0')
    const startMonth = start.toLocaleDateString('pt-BR', { month: 'long' })
    const endMonth = end.toLocaleDateString('pt-BR', { month: 'long' })
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()

    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

    if (startYear !== endYear) {
      return `${startDay} de ${cap(startMonth)} de ${startYear} a ${endDay} de ${cap(endMonth)} de ${endYear}`
    }
    if (startMonth !== endMonth) {
      return `${startDay} de ${cap(startMonth)} a ${endDay} de ${cap(endMonth)} de ${startYear}`
    }
    return `${startDay} a ${endDay} de ${cap(startMonth)} de ${startYear}`
  }, [weekDays])

  return (
    <div 
      className="mb-4 bg-white" 
      style={{ 
        border: '1px solid #E5E7EB', 
        borderRadius: '12px', 
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }}
    >
      {/* 1. Control Bar Header */}
      <div 
        className="p-3 bg-white d-flex flex-wrap justify-content-between align-items-center gap-3" 
        style={{ borderBottom: '1px solid #E5E7EB' }}
      >
        {/* Navigation Controls & Title */}
        <div className="d-flex align-items-center gap-2">
          <div className="d-flex align-items-center gap-1">
            <button 
              type="button" 
              className="btn btn-sm d-flex align-items-center justify-content-center p-0" 
              onClick={handlePrevWeek} 
              title="Semana anterior"
              style={{ 
                width: '32px', 
                height: '32px', 
                border: '1px solid #E2E8F0', 
                borderRadius: '7px', 
                backgroundColor: '#FFFFFF',
                color: '#334155'
              }}
            >
              <i className="bi bi-chevron-left" style={{ fontSize: '13px' }}></i>
            </button>
            <button 
              type="button" 
              className="btn btn-sm px-3 fw-bold d-flex align-items-center justify-content-center" 
              onClick={handleToday}
              title="Ir para a semana atual"
              style={{ 
                height: '32px', 
                border: '1px solid #E2E8F0', 
                borderRadius: '7px', 
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                fontSize: '13px'
              }}
            >
              Hoje
            </button>
            <button 
              type="button" 
              className="btn btn-sm d-flex align-items-center justify-content-center p-0" 
              onClick={handleNextWeek} 
              title="Próxima semana"
              style={{ 
                width: '32px', 
                height: '32px', 
                border: '1px solid #E2E8F0', 
                borderRadius: '7px', 
                backgroundColor: '#FFFFFF',
                color: '#334155'
              }}
            >
              <i className="bi bi-chevron-right" style={{ fontSize: '13px' }}></i>
            </button>
          </div>
          
          <div className="ms-2 d-flex align-items-center gap-2" style={{ color: '#10182B', fontSize: '15px', fontWeight: 600 }}>
            <i className="bi bi-calendar3" style={{ color: '#2563EB', fontSize: '16px' }}></i>
            <span>{weekRangeTitle}</span>
          </div>
        </div>

        {/* Informação de Horário Operacional da Grade */}
        <div className="d-flex align-items-center gap-2">
          <span className="badge rounded-pill bg-light text-dark border px-3 py-2 fw-semibold d-inline-flex align-items-center gap-1.5" style={{ fontSize: '12px' }}>
            <i className="bi bi-clock-history text-primary"></i>
            Atendimento: 08:00 às 17:00 (Seg a Sex)
          </span>
        </div>
      </div>

      {/* 2. Spreadsheet Grid Table with Sticky Left Time Column */}
      <div className="table-responsive m-0 p-0" style={{ maxHeight: '820px', overflowY: 'auto' }}>
        <table 
          className="table mb-0 bg-white" 
          style={{ 
            tableLayout: 'fixed', 
            minWidth: '100%', 
            borderCollapse: 'collapse'
          }}
        >
          {/* Days Header */}
          <thead className="sticky-top" style={{ zIndex: 10 }}>
            <tr>
              <th 
                className="text-center align-middle"
                style={{ 
                  width: '90px', 
                  backgroundColor: '#FFFFFF', 
                  color: '#475569', 
                  fontWeight: 700, 
                  fontSize: '12px',
                  borderRight: '1px solid #E5E7EB',
                  borderBottom: '1px solid #E5E7EB',
                  position: 'sticky',
                  left: 0,
                  zIndex: 11
                }}
              >
                Horário
              </th>

              {weekDays.map(day => (
                <th 
                  key={day.dateStr} 
                  className="text-center py-2.5 px-2 align-middle bg-white"
                  style={{
                    borderRight: '1px solid #E5E7EB',
                    borderBottom: '1px solid #E5E7EB',
                    backgroundColor: day.isToday ? '#EFF6FF' : '#FFFFFF'
                  }}
                >
                  <div 
                    style={{ 
                      color: day.isToday ? '#1E40AF' : '#0F172A', 
                      fontSize: '14.5px', 
                      fontWeight: 700,
                      lineHeight: '1.2'
                    }}
                  >
                    {day.dayLabel}
                  </div>
                  <div 
                    style={{ 
                      fontSize: '12.5px', 
                      fontWeight: 600, 
                      color: day.isToday ? '#2563EB' : '#64748B',
                      marginTop: '3px'
                    }}
                  >
                    {day.formatted}
                    {day.isToday && (
                      <span className="badge bg-primary text-white ms-1.5" style={{ fontSize: '9.5px', padding: '2px 6px' }}>
                        Hoje
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Time Slot Rows */}
          <tbody>
            {TIME_SLOTS.map((slot) => {
              const endTime = calculateEndTime(slot)

              return (
                <tr key={slot} id={`slot-row-${slot}`} style={{ minHeight: '110px', backgroundColor: '#FFFFFF' }}>
                  
                  {/* Time Label Column (Fixed Sticky Left Column) */}
                  <td 
                    className="text-center align-top py-2.5 px-1" 
                    style={{ 
                      backgroundColor: '#FFFFFF', 
                      borderRight: '1px solid #E5E7EB',
                      borderBottom: '1px solid #E5E7EB',
                      position: 'sticky',
                      left: 0,
                      zIndex: 5
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                      {slot}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500, marginTop: '2px' }}>
                      até {endTime}
                    </div>
                  </td>

                  {/* Day Columns */}
                  {weekDays.map(day => {
                    const cellAppointments = getAppointmentsForSlot(day.dateStr, slot)

                    return (
                      <td 
                        key={day.dateStr} 
                        id={`cell-${day.dateStr}-${slot}`}
                        className="p-1.5 align-top position-relative"
                        style={{ 
                          height: '110px', 
                          backgroundColor: day.isToday ? '#FAFCFE' : '#FFFFFF',
                          borderRight: '1px solid #E5E7EB',
                          borderBottom: '1px solid #E5E7EB',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        {cellAppointments.length > 0 ? (
                          <div className="d-flex flex-column gap-1.5 h-100">
                            {cellAppointments.map(apt => {
                              const isNew = newlyAddedId === apt.id || newlyAddedId === apt.protocol_number
                              const themeKey = getAppointmentCardTheme(apt)
                              const isSegundaVia = isSecondIssueAppointment(apt)
                              const isSpecial = themeKey === 'orange'
                              const isOverdue = themeKey === 'red' || isAppointmentOverdue(apt.appointment_date, apt.appointment_time)
                              const serviceLabel = isSegundaVia ? '2ª Via RG' : '1ª Via RG'

                              // Status text
                              let statusDisplay = 'Confirmado'
                              if (apt.status === 'no_show' || isOverdue) statusDisplay = '⏰ Atrasado'
                              else if (apt.status === 'scheduled') statusDisplay = 'Agendado'
                              else if (apt.status === 'pending' || apt.status === 'pendente') statusDisplay = 'Pendente'
                              else if (apt.status === 'completed') statusDisplay = 'Concluído'
                              else if (apt.status === 'cancelled') statusDisplay = 'Cancelado'
                              else if (apt.status === 'confirmed') statusDisplay = 'Confirmado'
                              else if (apt.status) statusDisplay = apt.status

                              const defaultAttendant = isSegundaVia ? 'Dr. Silva' : 'Dra. Lima'
                              const attendantDisplay = apt.attendant || defaultAttendant

                              // Color token styling according to reference image
                              const themeStyles = {
                                green: {
                                  bg: '#72C790',
                                  border: '#5BB87D',
                                  text: '#0D2818',
                                  shadow: '0 1px 3px rgba(91, 184, 125, 0.25)'
                                },
                                blue: {
                                  bg: '#56ACEE',
                                  border: '#3B98E0',
                                  text: '#092138',
                                  shadow: '0 1px 3px rgba(59, 152, 224, 0.25)'
                                },
                                orange: {
                                  bg: '#F8A562',
                                  border: '#E88E44',
                                  text: '#381A02',
                                  shadow: '0 1px 3px rgba(232, 142, 68, 0.25)'
                                },
                                red: {
                                  bg: '#F87171',
                                  border: '#EF4444',
                                  text: '#3E0D0D',
                                  shadow: '0 1px 3px rgba(239, 68, 68, 0.25)'
                                }
                              }[themeKey] || {
                                bg: '#72C790',
                                border: '#5BB87D',
                                text: '#0D2818',
                                shadow: '0 1px 3px rgba(91, 184, 125, 0.25)'
                              }

                              return (
                                <div
                                  key={apt.id || apt.protocol_number}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedAppointment(apt)
                                  }}
                                  className={`p-2.5 rounded-3 text-start position-relative transition-all ${
                                    isNew ? 'animate__animated animate__pulse animate__infinite' : ''
                                  }`}
                                  style={{
                                    backgroundColor: themeStyles.bg,
                                    border: isNew ? '2px solid #2563EB' : `1px solid ${themeStyles.border}`,
                                    color: themeStyles.text,
                                    boxShadow: isNew ? '0 0 16px rgba(37, 99, 235, 0.65), 0 2px 8px rgba(0,0,0,0.15)' : themeStyles.shadow,
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                    minHeight: '92px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                    e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.15)'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'none'
                                    e.currentTarget.style.boxShadow = themeStyles.shadow
                                  }}
                                  title="Clique para ver detalhes do agendamento"
                                >
                                  {isNew && (
                                    <span 
                                      className="position-absolute top-0 end-0 translate-middle-y badge rounded-pill"
                                      style={{ backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: '0.65rem', right: '8px' }}
                                    >
                                      NOVO ✨
                                    </span>
                                  )}

                                  <div>
                                    {/* Line 1: Citizen & Service */}
                                    <div className="d-flex align-items-center justify-content-between gap-1 mb-1">
                                      <strong className="text-truncate" style={{ fontSize: '12.5px', color: themeStyles.text, lineHeight: '1.2' }}>
                                        {isSpecial ? 'Caso Especial' : (apt.full_name || 'Cidadão')}
                                      </strong>
                                      <span 
                                        className="badge rounded-pill flex-shrink-0"
                                        style={{ 
                                          backgroundColor: 'rgba(0,0,0,0.12)', 
                                          color: themeStyles.text, 
                                          fontSize: '10px', 
                                          fontWeight: 600,
                                          padding: '2px 6px' 
                                        }}
                                      >
                                        {serviceLabel}
                                      </span>
                                    </div>

                                    {/* Line 2: Attendant */}
                                    <div className="text-truncate fw-medium" style={{ fontSize: '11.5px', color: themeStyles.text, opacity: 0.9 }}>
                                      <i className="bi bi-person-workspace me-1"></i>{attendantDisplay}
                                    </div>

                                    {/* Line 3: Time Interval */}
                                    <div style={{ fontSize: '11px', color: themeStyles.text, opacity: 0.85, marginTop: '2px' }}>
                                      <i className="bi bi-clock me-1"></i>{slot} às {endTime}
                                    </div>
                                  </div>

                                  {/* Line 4: Status & Protocol */}
                                  <div className="d-flex align-items-center justify-content-between mt-auto pt-1 border-top" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                                    <span className="fw-bold" style={{ fontSize: '11px', color: themeStyles.text }}>
                                      {statusDisplay}
                                    </span>
                                    <span className="font-monospace text-truncate" style={{ fontSize: '10px', opacity: 0.75, maxWidth: '100px' }}>
                                      {apt.protocol_number}
                                    </span>
                                  </div>

                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          /* Vacant Slot - Clean Spreadsheet Cell with Click & Hover */
                          <div 
                            onClick={() => onSlotClick?.(day.dateStr, slot)}
                            className="h-100 w-100 rounded-2 d-flex align-items-center justify-content-center"
                            style={{ 
                              cursor: 'pointer',
                              minHeight: '92px',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#EFF6FF'
                              e.currentTarget.style.border = '1.5px dashed #3B82F6'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent'
                              e.currentTarget.style.border = 'none'
                            }}
                            title={`Clique para agendar neste horário (${day.formatted} às ${slot})`}
                          >
                          </div>
                        )}
                      </td>
                    )
                  })}

                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes do Agendamento */}
      {selectedAppointment && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', zIndex: 1090 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 overflow-hidden bg-white shadow-lg" style={{ border: '1px solid #E5E8EC' }}>
              <div className="modal-header text-white py-3 px-4" style={{ backgroundColor: '#0B1220' }}>
                <h5 className="modal-title d-flex align-items-center gap-2 fw-bold" style={{ fontSize: '15px' }}>
                  <i className="bi bi-calendar2-check-fill text-primary"></i>
                  Detalhes do Agendamento
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setSelectedAppointment(null)}
                  disabled={isUpdatingStatus}
                ></button>
              </div>
              <div className="modal-body p-4 bg-white">
                
                {isAppointmentOverdue(selectedAppointment.appointment_date, selectedAppointment.appointment_time) && selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && (
                  <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3" style={{ border: '1px solid #FDE68A', backgroundColor: '#FEF3C7', color: '#92400E' }}>
                    <i className="bi bi-clock-history fs-5"></i>
                    <div>
                      <strong>Horário ultrapassado sem confirmação.</strong>
                      <div className="text-muted" style={{ fontSize: '11.5px', color: '#78350F' }}>Se o cidadão compareceu com atraso, você pode confirmar o atendimento normalmente abaixo.</div>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-3 mb-3 text-center" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E6EC' }}>
                  <div className="text-uppercase small fw-bold" style={{ color: '#64748B', fontSize: '11px' }}>Número do Protocolo</div>
                  <div className="fs-5 fw-bold font-monospace" style={{ color: '#1E3A8A' }}>{selectedAppointment.protocol_number}</div>
                </div>

                <ul className="list-group list-group-flush rounded-3">
                  <li className="list-group-item d-flex justify-content-between px-0 py-2">
                    <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Cidadão:</span>
                    <strong style={{ color: '#10182B', fontSize: '13px' }}>{selectedAppointment.full_name || '—'}</strong>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0 py-2">
                    <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Telefone:</span>
                    <strong style={{ color: '#10182B', fontSize: '13px' }}>{selectedAppointment.phone || '—'}</strong>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0 py-2">
                    <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Sexo:</span>
                    <strong style={{ color: '#10182B', fontSize: '13px' }}>{selectedAppointment.sexo || 'Não informado'}</strong>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0 py-2">
                    <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Serviço:</span>
                    <span className={`badge ${isSecondIssueAppointment(selectedAppointment) ? 'bg-primary' : 'bg-success'}`}>
                      {isSecondIssueAppointment(selectedAppointment) ? 'Emissão de RG (2ª Via)' : 'Emissão de RG (1ª Via)'}
                    </span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0 py-2">
                    <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Data e Horário:</span>
                    <strong style={{ color: '#10182B', fontSize: '13px' }}>
                      {selectedAppointment.appointment_date?.split('-').reverse().join('/')} às {selectedAppointment.appointment_time?.substring(0, 5)} – {calculateEndTime(selectedAppointment.appointment_time)}
                    </strong>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0 py-2">
                    <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Atendente / Guichê:</span>
                    <strong style={{ color: '#10182B', fontSize: '13px' }}>
                      {selectedAppointment.attendant || (isSecondIssueAppointment(selectedAppointment) ? 'Guichê 02 · Dr. Silva' : 'Guichê 01 · Dra. Lima')}
                    </strong>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0 py-2">
                    <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Origem / Canal:</span>
                    <span className={`badge ${
                      (selectedAppointment.is_walk_in || selectedAppointment.origin === 'presencial') ? 'bg-info text-dark' : 'bg-light text-secondary border'
                    }`}>
                      {(selectedAppointment.is_walk_in || selectedAppointment.origin === 'presencial') ? '🚶 Presencial (Balcão)' : '🌐 Agendamento Online'}
                    </span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0 py-2">
                    <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Status Atual:</span>
                    <span className={`badge ${
                      selectedAppointment.status === 'confirmed' ? 'bg-success' :
                      selectedAppointment.status === 'completed' ? 'bg-dark' :
                      selectedAppointment.status === 'scheduled' ? 'bg-primary' :
                      selectedAppointment.status === 'cancelled' ? 'bg-danger' : 'bg-warning'
                    }`}>
                      {selectedAppointment.status === 'confirmed' ? 'Confirmado' :
                       selectedAppointment.status === 'completed' ? 'Concluído' :
                       selectedAppointment.status === 'scheduled' ? 'Agendado' :
                       selectedAppointment.status === 'cancelled' ? 'Cancelado' : selectedAppointment.status}
                    </span>
                  </li>
                </ul>

              </div>
              <div className="modal-footer bg-light border-top py-3 px-4 d-flex flex-wrap justify-content-between gap-2">
                <div className="d-flex align-items-center gap-2">
                  {selectedAppointment.status !== 'cancelled' && (
                    <button 
                      type="button" 
                      className="btn btn-outline-danger btn-sm px-3 fw-medium"
                      disabled={isUpdatingStatus}
                      onClick={async () => {
                        if (confirm(`Tem certeza que deseja cancelar o agendamento ${selectedAppointment.protocol_number}? Os outros agendamentos não serão afetados.`)) {
                          setIsUpdatingStatus(true)
                          try {
                            if (onAppointmentStatusChange) {
                              await onAppointmentStatusChange(selectedAppointment.id, 'cancelled')
                            }
                            setSelectedAppointment(null)
                          } finally {
                            setIsUpdatingStatus(false)
                          }
                        }
                      }}
                    >
                      <i className="bi bi-x-circle me-1"></i>
                      Cancelar Agendamento
                    </button>
                  )}

                  {selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && (
                    <button 
                      type="button" 
                      className="btn btn-success btn-sm px-3 fw-bold shadow-sm"
                      disabled={isUpdatingStatus}
                      onClick={async () => {
                        setIsUpdatingStatus(true)
                        try {
                          if (onAppointmentStatusChange) {
                            await onAppointmentStatusChange(selectedAppointment.id, 'completed')
                          }
                          setSelectedAppointment(null)
                        } finally {
                          setIsUpdatingStatus(false)
                        }
                      }}
                    >
                      <i className="bi bi-person-check-fill me-1"></i>
                      Confirmar Atendimento
                    </button>
                  )}
                </div>

                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm px-3 fw-medium" 
                  onClick={() => setSelectedAppointment(null)}
                  disabled={isUpdatingStatus}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
