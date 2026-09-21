'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import WeeklyCalendarGrid, { 
  Appointment, 
  isAppointmentOverdue, 
  isSecondIssueAppointment,
  formatLocalDate 
} from './WeeklyCalendarGrid'
import WalkInBookingModal from './WalkInBookingModal'
import { adminUpdateAppointmentStatus, adminConfirmAttendance, getCompletedAppointments } from '@/app/actions/admin'

interface DashboardMetrics {
  dailyAppointments: number
  completedAppointments?: number
  monthlyAppointments: number
  limit: number
  restantes: number
  upcomingAppointments: Appointment[]
  firstIssueCount?: number
  secondIssueCount?: number
  dailyFirstIssue?: number
  dailySecondIssue?: number
  monthlyFirstIssue?: number
  monthlySecondIssue?: number
  completedFirstIssue?: number
  completedSecondIssue?: number
}

interface ToastNotification {
  id: string
  title: string
  protocol: string
  name: string
  time: string
  date?: string
  timeSlot?: string
  serviceType?: string
}

interface Props {
  initialMetrics: DashboardMetrics
}

export default function AdminDashboardClient({ initialMetrics }: Props) {
  const router = useRouter()
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics)
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'completed'>('grid')
  const [jumpToDate, setJumpToDate] = useState<string | null>(null)
  const [jumpToSlot, setJumpToSlot] = useState<{ date: string; time?: string; protocol?: string } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastNotification[]>([])
  const [walkInModal, setWalkInModal] = useState<{ isOpen: boolean; date?: string; time?: string }>({ isOpen: false })
  const [completedList, setCompletedList] = useState<any[]>([])
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false)
  const [completedSearch, setCompletedSearch] = useState('')
  const [completedDateFilter, setCompletedDateFilter] = useState('')
  const [refreshFeedback, setRefreshFeedback] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null)
  const processedProtocolsRef = useRef<Map<string, number>>(new Map())
  const lastEtagRef = useRef<string | null>(null)
  const lastSyncEtagRef = useRef<string | null>(null)

  // Load completed appointments
  const fetchCompletedList = useCallback(async (dateFilter?: string) => {
    setIsLoadingCompleted(true)
    try {
      const data = await getCompletedAppointments(dateFilter || undefined)
      setCompletedList(data)
    } catch (err: unknown) {
      console.error('Erro ao buscar atendimentos concluídos:', err)
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('Não autenticado') || message.includes('Permissão negada')) {
        setRefreshFeedback({
          text: 'Sessão expirada. Redirecionando para o login...',
          type: 'warning'
        })
        setTimeout(() => {
          router.push('/login')
        }, 1500)
      }
    } finally {
      setIsLoadingCompleted(false)
    }
  }, [router])

  useEffect(() => {
    if (viewMode === 'completed') {
      fetchCompletedList(completedDateFilter)
    }
  }, [viewMode, completedDateFilter, fetchCompletedList])

  // Play subtle chime sound using Web Audio API (no external file dependencies)
  const playNotificationSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, now) // D5
      osc.frequency.setValueAtTime(880.00, now + 0.1) // A5

      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.45)
    } catch {
      // Audio not supported or blocked by browser policy
    }
  }, [])

  const [activeWeekRange, setActiveWeekRange] = useState<{ start?: string; end?: string }>({})
  const activeWeekRangeRef = useRef<{ start?: string; end?: string }>({})

  // Refetch metrics from API with ETag and 304 support
  const fetchFreshMetrics = useCallback(async (highlightProtocol?: string, range?: { start?: string; end?: string }) => {
    setIsRefreshing(true)
    try {
      const effectiveRange = range || (activeWeekRangeRef.current.start ? activeWeekRangeRef.current : undefined)
      let url = '/api/admin/metrics'
      if (effectiveRange?.start && effectiveRange?.end) {
        url += `?startDate=${effectiveRange.start}&endDate=${effectiveRange.end}`
      }
      const headers: HeadersInit = {}
      if (lastEtagRef.current) {
        headers['If-None-Match'] = lastEtagRef.current
      }
      const res = await fetch(url, { headers, cache: 'no-store' })

      if (res.status === 304) {
        // Data has not changed; nothing to re-render
        return
      }

      if (res.status === 401 || res.status === 403) {
        setRefreshFeedback({
          text: 'Sessão expirada ou não autorizada. Redirecionando para o login...',
          type: 'warning'
        })
        setTimeout(() => {
          router.push('/login')
        }, 1500)
        return
      }

      if (res.status === 429) {
        const errorData = await res.json().catch(() => ({}))
        console.warn('Rate limit atingido em metrics:', errorData)
        return
      }

      if (res.ok) {
        const etag = res.headers.get('ETag')
        if (etag) lastEtagRef.current = etag

        const fresh = await res.json()

        setMetrics(prev => {
          // Merge fresh appointments with any local optimistic items
          const freshList: Appointment[] = fresh.upcomingAppointments || []
          const existingOpt = (prev.upcomingAppointments || []).filter(
            a => a.id?.startsWith('opt-') && !freshList.some(f => f.protocol_number === a.protocol_number)
          )

          return {
            ...fresh,
            upcomingAppointments: [...freshList, ...existingOpt]
          }
        })

        if (highlightProtocol) {
          setNewlyAddedId(highlightProtocol)
          setTimeout(() => setNewlyAddedId(null), 8000)
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar métricas:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [router])

  // Global State Sync via Aggregator Endpoint (/api/system/sync-state)
  const handleGlobalRefresh = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const headers: HeadersInit = {}
      if (lastSyncEtagRef.current) {
        headers['If-None-Match'] = lastSyncEtagRef.current
      }
      const range = activeWeekRangeRef.current
      let url = '/api/system/sync-state'
      const params = new URLSearchParams()
      if (range.start && range.end) {
        params.append('startDate', range.start)
        params.append('endDate', range.end)
      }
      if (completedDateFilter) {
        params.append('completedDate', completedDateFilter)
      }
      const qs = params.toString()
      if (qs) url += `?${qs}`

      const res = await fetch(url, { headers, cache: 'no-store' })

      if (res.status === 304) {
        setRefreshFeedback({ text: 'Sistema já atualizado (HTTP 304)', type: 'info' })
        setTimeout(() => setRefreshFeedback(null), 3000)
        return
      }

      if (res.status === 401 || res.status === 403) {
        setRefreshFeedback({
          text: 'Sessão expirada ou não autorizada. Redirecionando para o login...',
          type: 'warning'
        })
        setTimeout(() => {
          router.push('/login')
        }, 1500)
        return
      }

      if (res.status === 429) {
        const errorData = await res.json().catch(() => ({}))
        const retryAfter = res.headers.get('Retry-After') || errorData.retryAfter || 3
        setRefreshFeedback({ 
          text: `Aguarde ${retryAfter}s para nova atualização (Rate Limit)`, 
          type: 'warning' 
        })
        setTimeout(() => setRefreshFeedback(null), 3500)
        return
      }

      if (res.ok) {
        const etag = res.headers.get('ETag')
        if (etag) {
          lastSyncEtagRef.current = etag
          lastEtagRef.current = etag
        }
        const data = await res.json()
        if (data.metrics) {
          setMetrics(prev => {
            const freshList: Appointment[] = data.metrics.upcomingAppointments || []
            const existingOpt = (prev.upcomingAppointments || []).filter(
              a => a.id?.startsWith('opt-') && !freshList.some(f => f.protocol_number === a.protocol_number)
            )
            return {
              ...data.metrics,
              upcomingAppointments: [...freshList, ...existingOpt]
            }
          })
        }
        if (data.completedAppointments) {
          setCompletedList(data.completedAppointments)
        }
        setRefreshFeedback({ text: 'Sistema sincronizado com sucesso!', type: 'success' })
        setTimeout(() => setRefreshFeedback(null), 3000)
      } else {
        // Fallback para fetch individual
        fetchFreshMetrics()
        if (viewMode === 'completed') fetchCompletedList(completedDateFilter)
      }
    } catch (err) {
      console.error('Erro na sincronização global:', err)
      fetchFreshMetrics()
      if (viewMode === 'completed') fetchCompletedList(completedDateFilter)
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchFreshMetrics, fetchCompletedList, completedDateFilter, isRefreshing, viewMode])

  const handleWeekChange = useCallback((startDate: string, endDate: string) => {
    activeWeekRangeRef.current = { start: startDate, end: endDate }
    setActiveWeekRange({ start: startDate, end: endDate })
    fetchFreshMetrics(undefined, { start: startDate, end: endDate })
  }, [fetchFreshMetrics])

  const isAlreadyProcessed = useCallback((protocol: string) => {
    if (!protocol) return false
    const cleanProto = protocol.trim().toUpperCase()
    const now = Date.now()
    const lastSeen = processedProtocolsRef.current.get(cleanProto)
    if (lastSeen && (now - lastSeen < 60000)) {
      return true
    }
    processedProtocolsRef.current.set(cleanProto, now)
    // Cleanup old items
    for (const [key, time] of processedProtocolsRef.current.entries()) {
      if (now - time > 120000) processedProtocolsRef.current.delete(key)
    }
    return false
  }, [])

  // Trigger toast notification and IMMEDIATELY append to state
  const notifyNewBooking = useCallback((payload: {
    protocol: string
    full_name?: string
    appointment_date?: string
    appointment_time?: string
    appointment_type?: string
    tipo?: string
    phone?: string
    id?: string
  }) => {
    if (!payload.protocol) return
    const toastId = `toast-${payload.protocol}`
    const newToast: ToastNotification = {
      id: toastId,
      title: 'Novo Agendamento Confirmado!',
      protocol: payload.protocol,
      name: payload.full_name || 'Cidadão',
      time: new Date().toLocaleTimeString('pt-BR'),
      date: payload.appointment_date,
      timeSlot: payload.appointment_time,
      serviceType: payload.appointment_type
    }

    setToasts(prev => {
      if (prev.some(t => t.protocol === payload.protocol)) return prev
      return [newToast, ...prev.slice(0, 2)]
    })
    playNotificationSound()

    // 1. Optimistic append directly into metrics state so the slot renders IMMEDIATELY
    const rawType = payload.appointment_type || payload.tipo || 'first_issue'
    const isSecond = String(rawType).toLowerCase().includes('2') || String(rawType).toLowerCase().includes('second')
    const rawTime = (payload.appointment_time || '08:00').trim()
    const formattedTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime

    const optimisticBooking: Appointment = {
      id: payload.id || `opt-${payload.protocol}-${Date.now()}`,
      protocol_number: payload.protocol,
      full_name: payload.full_name || 'Cidadão',
      phone: payload.phone || '',
      appointment_date: payload.appointment_date || formatLocalDate(new Date()),
      appointment_time: formattedTime,
      appointment_type: rawType,
      tipo: isSecond ? 'SEGUNDA_VIA' : 'PRIMEIRA_VIA',
      categoria: isSecond ? '2ª Via RG' : '1ª Via RG',
      status: 'confirmed',
      attendant: isSecond ? 'Guichê 02 - Dr. Silva' : 'Guichê 01 - Dra. Lima'
    }

    setNewlyAddedId(payload.protocol)
    setTimeout(() => setNewlyAddedId(null), 8000)

    setMetrics(prev => {
      const currentList = prev.upcomingAppointments || []
      const alreadyPresent = currentList.some(
        a => a.protocol_number === payload.protocol || (payload.id && a.id === payload.id)
      )
      if (alreadyPresent) return prev

      const todayStr = formatLocalDate(new Date())
      const isForToday = payload.appointment_date === todayStr

      return {
        ...prev,
        dailyAppointments: isForToday ? prev.dailyAppointments + 1 : prev.dailyAppointments,
        monthlyAppointments: prev.monthlyAppointments + 1,
        restantes: Math.max(0, prev.restantes - 1),
        upcomingAppointments: [...currentList, optimisticBooking]
      }
    })

    // Auto dismiss toast after 10s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.protocol !== payload.protocol))
    }, 10000)

    // 2. Fetch fresh metrics from backend to synchronize
    fetchFreshMetrics(payload.protocol, activeWeekRangeRef.current.start ? activeWeekRangeRef.current : undefined)
  }, [fetchFreshMetrics, playNotificationSound])

  const handleSlotClick = useCallback((dateStr: string, slotStr: string) => {
    setWalkInModal({
      isOpen: true,
      date: dateStr,
      time: slotStr
    })
  }, [])

  const handleAppointmentStatusChange = useCallback(async (
    appointmentId: string, 
    newStatus: 'confirmed' | 'completed' | 'cancelled'
  ) => {
    if (!appointmentId || typeof appointmentId !== 'string' || appointmentId.trim() === '') return

    // 1. Optimistic update
    setMetrics(prev => {
      const list = prev.upcomingAppointments || []
      if (newStatus === 'completed') {
        return {
          ...prev,
          completedAppointments: (prev.completedAppointments || 0) + 1,
          upcomingAppointments: list.filter(a => a.id !== appointmentId)
        }
      }
      if (newStatus === 'cancelled') {
        return {
          ...prev,
          upcomingAppointments: list.filter(a => a.id !== appointmentId)
        }
      }
      return {
        ...prev,
        upcomingAppointments: list.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a)
      }
    })

    // 2. Server action
    try {
      let res: { success?: boolean; error?: string } | undefined
      if (newStatus === 'completed') {
        res = await adminConfirmAttendance(appointmentId)
      } else {
        res = await adminUpdateAppointmentStatus(appointmentId, newStatus)
      }
      if (res && !res.success) {
        alert(res.error || 'Não foi possível atualizar o status do agendamento no banco de dados.')
      }
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err)
      alert(err?.message || 'Erro inesperado ao atualizar status.')
    }

    // 3. Re-fetch
    fetchFreshMetrics(undefined, activeWeekRange.start ? activeWeekRange : undefined)
    if (viewMode === 'completed') {
      fetchCompletedList(completedDateFilter)
    }
  }, [activeWeekRange, completedDateFilter, fetchCompletedList, fetchFreshMetrics, viewMode])

  // Setup Multi-Tier Real-Time Listeners
  useEffect(() => {
    let eventSource: EventSource | null = null

    // 1. Server-Sent Events (SSE)
    try {
      eventSource = new EventSource('/api/admin/events')

      eventSource.onopen = () => {
        setIsConnected(true)
      }

      eventSource.addEventListener('new_booking', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          if (data && data.protocol && !isAlreadyProcessed(data.protocol)) {
            notifyNewBooking(data)
          }
        } catch (err) {
          console.error('Erro ao processar evento SSE:', err)
        }
      })

      eventSource.addEventListener('booking_cancelled', () => {
        fetchFreshMetrics()
      })

      eventSource.addEventListener('status_updated', () => {
        fetchFreshMetrics()
      })

      eventSource.addEventListener('system_sync', () => {
        fetchFreshMetrics()
      })

      eventSource.onerror = () => {
        setIsConnected(false)
        if (eventSource) {
          eventSource.close()
        }
      }
    } catch (err) {
      console.warn('SSE not supported or failed to connect:', err)
    }

    // 2. BroadcastChannel: 'booking_sync'
    let channel1: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel1 = new BroadcastChannel('booking_sync')
        channel1.onmessage = (e) => {
          const proto = e.data?.protocol
          if (proto && !isAlreadyProcessed(proto)) {
            notifyNewBooking(e.data)
          }
        }
      } catch (err) {
        console.warn('BroadcastChannel booking_sync error:', err)
      }
    }

    // 3. BroadcastChannel: 'scheduling_sync_channel'
    let channel2: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel2 = new BroadcastChannel('scheduling_sync_channel')
        channel2.onmessage = (e) => {
          const proto = e.data?.protocol
          if (proto && !isAlreadyProcessed(proto)) {
            notifyNewBooking(e.data)
          }
        }
      } catch (err) {
        console.warn('BroadcastChannel scheduling_sync_channel error:', err)
      }
    }

    // 4. Custom Window Event
    const handleCustomWindowSync = (e: Event) => {
      const customEvt = e as CustomEvent<{
        protocol: string
        full_name?: string
        appointment_date?: string
        appointment_time?: string
        appointment_type?: string
        tipo?: string
        phone?: string
        id?: string
        timestamp?: string
      }>
      const detail = customEvt.detail
      if (detail && detail.protocol && !isAlreadyProcessed(detail.protocol)) {
        notifyNewBooking(detail)
      }
    }
    window.addEventListener('new_booking_event', handleCustomWindowSync)

    // 5. Storage Listener
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'last_booking_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (parsed && parsed.protocol && !isAlreadyProcessed(parsed.protocol)) {
            notifyNewBooking(parsed)
          }
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', onStorage)

    // 6. Fallback Polling (Every 4s)
    const pollInterval = setInterval(() => {
      fetchFreshMetrics()
    }, 4000)

    return () => {
      if (eventSource) eventSource.close()
      if (channel1) channel1.close()
      if (channel2) channel2.close()
      window.removeEventListener('new_booking_event', handleCustomWindowSync)
      window.removeEventListener('storage', onStorage)
      clearInterval(pollInterval)
    }
  }, [fetchFreshMetrics, isAlreadyProcessed, notifyNewBooking])

  // Calculate counts for right metrics deck and bottom queue
  const overdueCount = useMemo(() => {
    return (metrics.upcomingAppointments || []).filter(a => 
      isAppointmentOverdue(a.appointment_date, a.appointment_time) && a.status !== 'completed' && a.status !== 'cancelled'
    ).length
  }, [metrics.upcomingAppointments])

  const [quickSearch, setQuickSearch] = useState('')
  const [serviceFilter, setServiceFilter] = useState<'all' | 'first_issue' | 'second_issue'>('all')

  // Filtered upcoming appointments based on serviceFilter (1ª Via / 2ª Via) and quickSearch
  const filteredUpcomingAppointments = useMemo(() => {
    let list = metrics.upcomingAppointments || []

    if (serviceFilter === 'first_issue') {
      list = list.filter(a => !isSecondIssueAppointment(a))
    } else if (serviceFilter === 'second_issue') {
      list = list.filter(a => isSecondIssueAppointment(a))
    }

    if (quickSearch.trim()) {
      const q = quickSearch.toLowerCase().trim()
      list = list.filter(a =>
        a.protocol_number?.toLowerCase().includes(q) ||
        a.full_name?.toLowerCase().includes(q) ||
        a.attendant?.toLowerCase().includes(q) ||
        a.phone?.toLowerCase().includes(q) ||
        a.appointment_time?.includes(q) ||
        a.appointment_date?.includes(q) ||
        (isSecondIssueAppointment(a) ? '2ª via guichê 02 silva' : '1ª via guichê 01 lima').includes(q)
      )
    }

    return list
  }, [metrics.upcomingAppointments, serviceFilter, quickSearch])

  // Filtered completed appointments based on serviceFilter and quickSearch
  const filteredCompletedList = useMemo(() => {
    let list = completedList
    if (serviceFilter === 'first_issue') {
      list = list.filter(a => !isSecondIssueAppointment(a))
    } else if (serviceFilter === 'second_issue') {
      list = list.filter(a => isSecondIssueAppointment(a))
    }
    if (quickSearch.trim()) {
      const q = quickSearch.toLowerCase().trim()
      list = list.filter(a =>
        a.protocol_number?.toLowerCase().includes(q) ||
        a.full_name?.toLowerCase().includes(q) ||
        a.attendant?.toLowerCase().includes(q) ||
        a.phone?.toLowerCase().includes(q) ||
        a.appointment_time?.includes(q) ||
        a.appointment_date?.includes(q) ||
        (isSecondIssueAppointment(a) ? '2ª via guichê 02 silva' : '1ª via guichê 01 lima').includes(q)
      )
    }
    return list
  }, [completedList, serviceFilter, quickSearch])

  const imminentList = useMemo(() => {
    let list = metrics.upcomingAppointments || []
    if (serviceFilter === 'first_issue') {
      list = list.filter(a => !isSecondIssueAppointment(a))
    } else if (serviceFilter === 'second_issue') {
      list = list.filter(a => isSecondIssueAppointment(a))
    }
    return list.slice(0, 3).map(a => ({
      id: a.id,
      protocol: a.protocol_number,
      name: a.full_name || 'Cidadão',
      time: (a.appointment_time || '08:00').substring(0, 5),
      service: isSecondIssueAppointment(a) ? '2ª Via RG' : '1ª Via RG',
      status: a.status || 'scheduled',
      isOverdue: isAppointmentOverdue(a.appointment_date, a.appointment_time)
    }))
  }, [metrics.upcomingAppointments, serviceFilter])

  const serviceStats = useMemo(() => {
    const list = metrics.upcomingAppointments || []
    let firstIssue = 0
    let secondIssue = 0
    let todayFirst = 0
    let todaySecond = 0
    const todayStr = formatLocalDate(new Date())

    list.forEach(a => {
      const isSecond = isSecondIssueAppointment(a)
      if (isSecond) secondIssue++
      else firstIssue++

      if (a.appointment_date === todayStr) {
        if (isSecond) todaySecond++
        else todayFirst++
      }
    })

    return {
      firstIssue: list.length > 0 ? firstIssue : (metrics.firstIssueCount ?? 0),
      secondIssue: list.length > 0 ? secondIssue : (metrics.secondIssueCount ?? 0),
      todayFirst: metrics.dailyFirstIssue ?? todayFirst,
      todaySecond: metrics.dailySecondIssue ?? todaySecond,
      monthlyFirst: metrics.monthlyFirstIssue ?? firstIssue,
      monthlySecond: metrics.monthlySecondIssue ?? secondIssue,
      completedFirst: metrics.completedFirstIssue ?? 0,
      completedSecond: metrics.completedSecondIssue ?? 0
    }
  }, [metrics])

  const handleJumpToGrid = useCallback((toast: ToastNotification) => {
    if (!toast.date) return
    if (serviceFilter !== 'all') {
      setServiceFilter('all')
    }
    if (quickSearch) {
      setQuickSearch('')
    }
    setViewMode('grid')
    setJumpToSlot({
      date: toast.date,
      time: toast.timeSlot,
      protocol: toast.protocol
    })
    setJumpToDate(toast.date)
    setNewlyAddedId(toast.protocol)
    setTimeout(() => setNewlyAddedId(null), 8000)
  }, [quickSearch, serviceFilter])

  return (
    <div style={{ color: '#E2E8F0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Real-time Toasts / Alerts with Jump-to-Grid Action */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="position-fixed top-0 end-0 p-3" 
        style={{ zIndex: 1080, maxWidth: '400px' }}
      >
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className="toast show shadow-lg border-0 mb-3 bg-white text-dark rounded-3 overflow-hidden" 
            role="alert"
          >
            <div className="toast-header bg-success text-white py-2">
              <i className="bi bi-bell-fill me-2"></i>
              <strong className="me-auto">{toast.title}</strong>
              <small>{toast.time}</small>
              <button 
                type="button" 
                className="btn-close btn-close-white ms-2" 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              ></button>
            </div>
            <div className="toast-body bg-light">
              <div className="d-flex align-items-center mb-1">
                <span className="badge bg-primary text-monospace me-2">{toast.protocol}</span>
                <strong>{toast.name}</strong>
              </div>
              
              {toast.date && (
                <div className="mt-2 pt-2 border-top d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    <i className="bi bi-calendar-event me-1 text-primary"></i>
                    {toast.date.split('-').reverse().join('/')} às {toast.timeSlot?.substring(0, 5)}
                  </small>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm py-0 px-2 small shadow-xs"
                    onClick={() => handleJumpToGrid(toast)}
                  >
                    <i className="bi bi-eye-fill me-1"></i> Ver na Grade
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Header with Live Status, View Switcher & Manual Refresh */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div className="d-flex align-items-center gap-3">
          <div>
            <h2 className="mb-0 fw-bold" style={{ color: '#F8FAFC', letterSpacing: '-0.02em', fontSize: '22px' }}>
              Painel de Identificação Civil
            </h2>
            <p className="mb-0 small" style={{ color: '#CBD5E1' }}>
              Gestão em tempo real de emissão de RG, grade semanal e controle de guichês.
            </p>
          </div>
          <span 
            className={`badge ${isConnected ? 'bg-success text-white' : 'bg-warning text-dark'} d-inline-flex align-items-center gap-1 shadow-sm py-2 px-3 rounded-pill`}
            title={isConnected ? 'Conectado aos eventos em tempo real' : 'Reconectando em segundo plano...'}
          >
            <span 
              className="spinner-grow spinner-grow-sm" 
              role="status" 
              style={{ width: '0.55rem', height: '0.55rem' }}
            ></span>
            {isConnected ? 'Tempo Real Ativo' : 'Sincronizando'}
          </span>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {refreshFeedback && (
            <span 
              className={`badge py-1.5 px-2.5 rounded-pill d-inline-flex align-items-center gap-1.5 animate__animated animate__fadeIn ${
                refreshFeedback.type === 'success' 
                  ? 'bg-success-subtle text-success border border-success-subtle' 
                  : refreshFeedback.type === 'warning'
                  ? 'bg-warning-subtle text-warning border border-warning-subtle'
                  : 'bg-info-subtle text-info border border-info-subtle'
              }`}
              style={{ fontSize: '11.5px' }}
            >
              <i className={`bi ${
                refreshFeedback.type === 'success' ? 'bi-check-circle-fill' : refreshFeedback.type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'
              }`}></i>
              {refreshFeedback.text}
            </span>
          )}

          <button 
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 shadow-sm text-light border-secondary"
            onClick={handleGlobalRefresh}
            disabled={isRefreshing || isLoadingCompleted}
            title="Sincronizar estado global (Métricas, Agendamentos e Status)"
          >
            <i className={`bi bi-arrow-clockwise ${isRefreshing || isLoadingCompleted ? 'spinner-border spinner-border-sm' : ''}`}></i>
            {isRefreshing || isLoadingCompleted ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5-ZONE WIREFRAME DASHBOARD GRID LAYOUT */}
      {/* ========================================================= */}
      <div className="d-flex flex-column gap-3">
        
        {/* Top Row: Hero Main Viewport (70%) + Right Layered Metrics Deck (30%) */}
        <div className="row g-3">
          
          {/* 1. HERO MAIN VIEWPORT */}
          <div className="col-12 col-xl-8 d-flex flex-column">
            <div 
              className="p-3 p-md-4 rounded-4 flex-grow-1 d-flex flex-column justify-content-between position-relative overflow-hidden"
              style={{
                backgroundColor: '#1E293B',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                minHeight: '480px'
              }}
            >
              {/* Inner Viewport Canvas */}
              <div className="flex-grow-1 overflow-auto mb-3">
                
                {/* Banner de Filtro Ativo quando 1ª ou 2ª Via selecionada */}
                {serviceFilter !== 'all' && (
                  <div 
                    className="d-flex align-items-center justify-content-between px-3 py-2 mb-3 rounded-3 shadow-sm"
                    style={{
                      backgroundColor: serviceFilter === 'first_issue' ? '#064E3B' : '#1E3A8A',
                      border: `1px solid ${serviceFilter === 'first_issue' ? '#10B981' : '#3B82F6'}`,
                      fontSize: '12px',
                      color: '#FFFFFF'
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i className={`bi ${serviceFilter === 'first_issue' ? 'bi-person-check-fill text-success' : 'bi-person-badge-fill text-primary'} fs-6`}></i>
                      <span>
                        Filtro ativo:{' '}
                        <strong>{serviceFilter === 'first_issue' ? '1ª Via RG (Guichê 01 · Dra. Lima)' : '2ª Via RG (Guichê 02 · Dr. Silva)'}</strong>
                        {' — '}<span style={{ opacity: 0.9 }}>{filteredUpcomingAppointments.length} agendamento(s) filtrado(s)</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setServiceFilter('all')}
                      className="btn btn-sm btn-light py-0 px-2 fw-semibold d-inline-flex align-items-center gap-1 shadow-xs"
                      style={{ fontSize: '11px', color: '#0F172A' }}
                      title="Restaurar visualização de todos os agendamentos"
                    >
                      <i className="bi bi-x-circle-fill"></i>
                      Remover Filtro
                    </button>
                  </div>
                )}

                {/* 1.A: Grade Semanal */}
                {viewMode === 'grid' && (
                  <WeeklyCalendarGrid 
                    appointments={filteredUpcomingAppointments} 
                    newlyAddedId={newlyAddedId}
                    jumpToDate={jumpToDate}
                    jumpToSlot={jumpToSlot}
                    onWeekChange={handleWeekChange}
                    onSlotClick={handleSlotClick}
                    onAppointmentStatusChange={handleAppointmentStatusChange}
                  />
                )}

                {/* 1.B: Lista Ativa */}
                {viewMode === 'table' && (
                  <div className="card shadow-sm border-0 rounded-3 overflow-hidden bg-white">
                    <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
                      <h5 className="mb-0 fw-bold d-flex align-items-center gap-2" style={{ color: '#0F172A', fontSize: '15px' }}>
                        <i className="bi bi-calendar-week me-2 text-primary"></i>
                        Agendamentos Ativos no Sistema
                        {serviceFilter === 'first_issue' && (
                          <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '11px' }}>
                            1ª Via RG · Guichê 01
                          </span>
                        )}
                        {serviceFilter === 'second_issue' && (
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '11px' }}>
                            2ª Via RG · Guichê 02
                          </span>
                        )}
                      </h5>
                      <span className="badge bg-primary rounded-pill">
                        {filteredUpcomingAppointments.length}
                        {filteredUpcomingAppointments.length !== (metrics.upcomingAppointments?.length || 0) && (
                          <span className="opacity-75 ms-1">de {metrics.upcomingAppointments?.length || 0}</span>
                        )}
                      </span>
                    </div>

                    {(!filteredUpcomingAppointments || filteredUpcomingAppointments.length === 0) ? (
                      <div className="card-body text-center p-5 text-muted">
                        <i className="bi bi-calendar-x display-5 text-muted mb-2 d-block opacity-50"></i>
                        <p className="mb-0">Nenhum agendamento ativo encontrado {serviceFilter !== 'all' ? 'para este filtro.' : '.'}</p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                            <tr style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              <th className="py-2 px-3">Protocolo</th>
                              <th>Cidadão</th>
                              <th>Sexo</th>
                              <th>Telefone</th>
                              <th>Data / Hora</th>
                              <th>Atendente</th>
                              <th>Tipo</th>
                              <th>Status</th>
                              <th className="text-end px-3">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredUpcomingAppointments.map((apt: Appointment) => {
                              const isNew = newlyAddedId === apt.id
                              const isSecond = isSecondIssueAppointment(apt)
                              const aptOverdue = isAppointmentOverdue(apt.appointment_date, apt.appointment_time)

                              return (
                                <tr 
                                  key={apt.id} 
                                  className={isNew ? 'table-success border-start border-4 border-success' : ''}
                                  style={{ 
                                    fontSize: '12.5px', 
                                    backgroundColor: (aptOverdue && apt.status !== 'completed' && apt.status !== 'cancelled') ? '#FEF2F2' : undefined 
                                  }}
                                >
                                  <td className="px-3">
                                    <code className="small fw-bold" style={{ color: '#1E3A8A' }}>{apt.protocol_number}</code>
                                  </td>
                                  <td><strong style={{ color: '#10182B' }}>{apt.full_name || '—'}</strong></td>
                                  <td>
                                    <span className="badge bg-light text-dark border" style={{ fontSize: '10.5px' }}>
                                      {apt.sexo || 'Não informado'}
                                    </span>
                                  </td>
                                  <td style={{ color: '#475569' }}>{apt.phone || '—'}</td>
                                  <td style={{ color: '#334155' }}>
                                    <span className="fw-medium">{apt.appointment_date ? apt.appointment_date.split('-').reverse().join('/') : '—'}</span>
                                    <span className="text-muted ms-1">às {apt.appointment_time?.substring(0, 5)}</span>
                                  </td>
                                  <td>
                                    <span className="text-muted small">
                                      {apt.attendant || (isSecond ? 'Dr. Silva' : 'Dra. Lima')}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="badge bg-secondary" style={{ fontSize: '10.5px' }}>
                                      {isSecond ? '2ª Via' : '1ª Via'}
                                    </span>
                                  </td>
                                  <td>
                                    {apt.status === 'completed' ? (
                                      <span className="badge bg-dark" style={{ fontSize: '10.5px' }}>Concluído</span>
                                    ) : apt.status === 'cancelled' ? (
                                      <span className="badge bg-danger" style={{ fontSize: '10.5px' }}>Cancelado</span>
                                    ) : aptOverdue ? (
                                      <span className="badge bg-danger" style={{ fontSize: '10.5px' }}>⏰ Atrasado</span>
                                    ) : (
                                      <span className="badge bg-success" style={{ fontSize: '10.5px' }}>Confirmado</span>
                                    )}
                                  </td>
                                  <td className="text-end px-3">
                                    <div className="d-inline-flex align-items-center gap-1">
                                      <button
                                        type="button"
                                        className="btn btn-success btn-sm py-0 px-2 fw-bold d-inline-flex align-items-center gap-1"
                                        style={{ fontSize: '11px' }}
                                        onClick={() => handleAppointmentStatusChange(apt.id, 'completed')}
                                        title="Confirmar Atendimento"
                                      >
                                        <i className="bi bi-person-check-fill"></i>
                                        Confirmar
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline-danger btn-sm py-0 px-2"
                                        style={{ fontSize: '11px' }}
                                        onClick={() => {
                                          if (confirm(`Tem certeza que deseja cancelar o agendamento ${apt.protocol_number}? Os demais agendamentos permanecerão inalterados.`)) {
                                            handleAppointmentStatusChange(apt.id, 'cancelled')
                                          }
                                        }}
                                        title="Cancelar este agendamento"
                                      >
                                        <i className="bi bi-x-circle"></i>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 1.C: Atendimentos Realizados (Histórico Concluído) */}
                {viewMode === 'completed' && (
                  <div className="card shadow-sm border-0 rounded-3 overflow-hidden bg-white">
                    <div className="card-header bg-white py-3 px-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                      <div>
                        <h5 className="mb-0 fw-bold d-flex align-items-center gap-2 text-dark" style={{ fontSize: '15px' }}>
                          <i className="bi bi-check2-all text-success fs-5"></i>
                          Atendimentos Realizados
                        </h5>
                      </div>

                      <div className="d-flex align-items-center gap-2">
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          style={{ width: 'auto' }}
                          value={completedDateFilter}
                          onChange={(e) => setCompletedDateFilter(e.target.value)}
                        />
                        {completedDateFilter && (
                          <button 
                            type="button" 
                            className="btn btn-outline-secondary btn-sm py-0 px-2"
                            onClick={() => setCompletedDateFilter('')}
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="card-body p-0">
                      {isLoadingCompleted ? (
                        <div className="text-center p-5 text-muted">
                          <div className="spinner-border text-primary mb-2" role="status"></div>
                          <p className="mb-0 small">Carregando histórico...</p>
                        </div>
                      ) : filteredCompletedList.length === 0 ? (
                        <div className="text-center p-5 text-muted">
                          <i className="bi bi-journal-check display-5 text-muted mb-2 d-block opacity-50"></i>
                          <p className="mb-0 small">Nenhum atendimento realizado encontrado para este filtro.</p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-hover align-middle mb-0">
                            <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                              <tr style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' }}>
                                <th className="py-2 px-3">Protocolo</th>
                                <th>Cidadão</th>
                                <th>Sexo</th>
                                <th>Telefone</th>
                                <th>Serviço</th>
                                <th>Data Atendimento</th>
                                <th>Guichê / Atendente</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredCompletedList.map(apt => {
                                const isSecond = isSecondIssueAppointment(apt)
                                return (
                                  <tr key={apt.id} style={{ fontSize: '12.5px' }}>
                                    <td className="px-3 font-monospace fw-semibold" style={{ color: '#1E3A8A' }}>
                                      {apt.protocol_number}
                                    </td>
                                    <td><strong style={{ color: '#10182B' }}>{apt.full_name}</strong></td>
                                    <td>
                                      <span className="badge bg-light text-dark border" style={{ fontSize: '10.5px' }}>
                                        {apt.sexo || 'Não informado'}
                                      </span>
                                    </td>
                                    <td style={{ color: '#475569' }}>{apt.phone || '—'}</td>
                                    <td>
                                      <span className="badge rounded-pill fw-semibold" style={{ backgroundColor: isSecond ? '#EFF6FF' : '#ECFDF5', color: isSecond ? '#1D4ED8' : '#047857' }}>
                                        {isSecond ? '2ª Via RG' : '1ª Via RG'}
                                      </span>
                                    </td>
                                    <td style={{ color: '#334155' }}>
                                      <span className="fw-medium">{apt.appointment_date?.split('-').reverse().join('/')}</span>
                                      <span className="text-muted ms-1">às {apt.appointment_time?.substring(0, 5)}</span>
                                    </td>
                                    <td>
                                      <span className="text-dark small fw-medium">{apt.attendant}</span>
                                    </td>
                                    <td>
                                      <span className="badge rounded-pill bg-success" style={{ fontSize: '10.5px' }}>
                                        <i className="bi bi-check2-circle me-1"></i> Atendido
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Search Bar Pill (Pure real-time search with semantic magnifying glass icon) */}
              <div className="pt-2 border-top border-secondary border-opacity-25">
                <div 
                  className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill"
                  style={{
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.12)'
                  }}
                >
                  <i className="bi bi-search flex-shrink-0" style={{ color: '#94A3B8', fontSize: '14px', marginLeft: '2px' }}></i>

                  <input
                    type="text"
                    className="form-control form-control-sm bg-transparent border-0 shadow-none"
                    placeholder="Buscar por cidadão, protocolo, guichê ou horário..."
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                    style={{ 
                      fontSize: '13px', 
                      color: '#F8FAFC'
                    }}
                  />

                  {quickSearch && (
                    <button
                      type="button"
                      className="btn btn-sm p-0 border-0 bg-transparent"
                      style={{ color: '#94A3B8' }}
                      onClick={() => setQuickSearch('')}
                    >
                      <i className="bi bi-x-circle-fill"></i>
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* 2. RIGHT LAYERED METRICS DECK */}
          <div className="col-12 col-xl-4 d-flex flex-column gap-3 justify-content-start">
            
            {/* Cascading Depth Cards (Fixed Proportionate Gap) */}
            <div className="d-flex flex-column justify-content-start" style={{ gap: '12px' }}>
              
              {/* Card 1: Agendamentos Hoje */}
              <div 
                className="p-3 rounded-4 d-flex align-items-center justify-content-between shadow-sm"
                style={{
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(147, 197, 253, 0.3)',
                  minHeight: '84px'
                }}
              >
                <div>
                  <div className="fw-semibold" style={{ fontSize: '12px', color: '#93C5FD', letterSpacing: '0.02em' }}>
                    Agendamentos Hoje
                  </div>
                  <div className="fw-bold" style={{ fontSize: '26px', color: '#60A5FA', lineHeight: '1.2' }}>
                    {metrics.dailyAppointments}
                  </div>
                  <div className="d-flex align-items-center gap-1.5 mt-1" style={{ fontSize: '11px' }}>
                    <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-1.5 py-0.5">
                      1ª Via: {serviceStats.todayFirst}
                    </span>
                    <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-1.5 py-0.5">
                      2ª Via: {serviceStats.todaySecond}
                    </span>
                  </div>
                </div>
                {/* Botão/Ícone: #038C33 (Verde Médio) com Ícone Branco */}
                <div 
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ 
                    width: '42px', 
                    height: '42px', 
                    backgroundColor: '#038C33', 
                    color: '#FFFFFF', 
                    fontSize: '18px',
                    boxShadow: '0 2px 8px rgba(3, 140, 51, 0.35)'
                  }}
                >
                  <i className="bi bi-calendar-event"></i>
                </div>
              </div>

              {/* Card 2: Vagas Restantes no Mês */}
              <div 
                className="p-3 rounded-4 d-flex align-items-center justify-content-between shadow-sm"
                style={{
                  backgroundColor: '#132E27',
                  border: '1px solid rgba(110, 231, 183, 0.3)',
                  minHeight: '84px'
                }}
              >
                <div>
                  <div className="fw-semibold" style={{ fontSize: '12px', color: '#6EE7B7', letterSpacing: '0.02em' }}>
                    Vagas Restantes no Mês
                  </div>
                  <div className="fw-bold" style={{ fontSize: '26px', color: '#34D399', lineHeight: '1.2' }}>
                    {metrics.restantes}
                  </div>
                  <div style={{ fontSize: '11px', color: '#D1FAE5', marginTop: '2px' }}>
                    {metrics.monthlyAppointments} de {metrics.limit} usadas ({serviceStats.monthlyFirst} de 1ª Via · {serviceStats.monthlySecond} de 2ª Via)
                  </div>
                </div>
                {/* Botão/Ícone: #0DF205 (Verde Neon) com Ícone #0D0D0D (Preto) */}
                <div 
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ 
                    width: '42px', 
                    height: '42px', 
                    backgroundColor: '#0DF205', 
                    color: '#0D0D0D', 
                    fontSize: '18px',
                    boxShadow: '0 2px 8px rgba(13, 242, 5, 0.35)'
                  }}
                >
                  <i className="bi bi-ticket-perforated"></i>
                </div>
              </div>

              {/* Card 3: Atrasados / Não Compareceu */}
              <div 
                className="p-3 rounded-4 d-flex align-items-center justify-content-between shadow-sm"
                style={{
                  backgroundColor: '#2A1719',
                  border: '1px solid rgba(252, 165, 165, 0.3)',
                  minHeight: '84px'
                }}
              >
                <div>
                  <div className="fw-semibold" style={{ fontSize: '12px', color: '#FCA5A5', letterSpacing: '0.02em' }}>
                    Não Compareceu / Atrasados
                  </div>
                  <div className="fw-bold" style={{ fontSize: '26px', color: '#F87171', lineHeight: '1.2' }}>
                    {overdueCount}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#FEE2E2', marginTop: '2px' }}>
                    Horário agendado ultrapassado
                  </div>
                </div>
                {/* Botão/Ícone: #F2CB05 (Amarelo/Atenção) com Ícone #0D0D0D (Preto) */}
                <div 
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ 
                    width: '42px', 
                    height: '42px', 
                    backgroundColor: '#F2CB05', 
                    color: '#0D0D0D', 
                    fontSize: '18px',
                    boxShadow: '0 2px 8px rgba(242, 203, 5, 0.35)'
                  }}
                >
                  <i className="bi bi-clock-history"></i>
                </div>
              </div>

              {/* Card 4: Atendimentos Concluídos */}
              <div 
                className="p-3 rounded-4 d-flex align-items-center justify-content-between shadow-sm"
                style={{
                  backgroundColor: '#142838',
                  border: '1px solid rgba(125, 211, 252, 0.3)',
                  minHeight: '84px'
                }}
              >
                <div>
                  <div className="fw-semibold" style={{ fontSize: '12px', color: '#7DD3FC', letterSpacing: '0.02em' }}>
                    Atendimentos Concluídos
                  </div>
                  <div className="fw-bold" style={{ fontSize: '26px', color: '#38BDF8', lineHeight: '1.2' }}>
                    {metrics.completedAppointments ?? 0}
                  </div>
                  <div className="d-flex align-items-center gap-1.5 mt-1" style={{ fontSize: '11px' }}>
                    <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-1.5 py-0.5">
                      1ª Via: {serviceStats.completedFirst}
                    </span>
                    <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-1.5 py-0.5">
                      2ª Via: {serviceStats.completedSecond}
                    </span>
                  </div>
                </div>
                {/* Botão/Ícone: #20593F (Verde Escuro Acinzentado) com Ícone #0DF205 (Verde Neon) */}
                <div 
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ 
                    width: '42px', 
                    height: '42px', 
                    backgroundColor: '#20593F', 
                    color: '#0DF205', 
                    fontSize: '18px',
                    boxShadow: '0 2px 8px rgba(32, 89, 63, 0.35)'
                  }}
                >
                  <i className="bi bi-person-check"></i>
                </div>
              </div>

              {/* Card 5: Distribuição por Tipo de RG (1ª Via e 2ª Via) - Botões Interativos de Filtro */}
              <div 
                className="p-3 rounded-4 shadow-sm"
                style={{
                  backgroundColor: '#0F172A',
                  border: serviceFilter !== 'all' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)',
                  minHeight: '84px',
                  transition: 'border 0.2s ease'
                }}
              >
                <div className="fw-semibold mb-2 d-flex align-items-center justify-content-between" style={{ fontSize: '12px', color: '#E2E8F0' }}>
                  <span className="d-flex align-items-center gap-1.5">
                    <i className="bi bi-pie-chart-fill text-primary"></i>
                    Contagem Total de Vias RG
                  </span>
                  <div className="d-flex align-items-center gap-1.5">
                    {serviceFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setServiceFilter('all')}
                        className="btn btn-sm btn-outline-secondary py-0 px-2 text-white border-secondary rounded-pill"
                        style={{ fontSize: '10.5px' }}
                        title="Limpar filtro e exibir todas as vias"
                      >
                        <i className="bi bi-x-circle me-1"></i>Limpar
                      </button>
                    )}
                    <span className="badge bg-secondary" style={{ fontSize: '10.5px' }}>
                      Total Ativo: {serviceStats.firstIssue + serviceStats.secondIssue}
                    </span>
                  </div>
                </div>
                <div className="row g-2">
                  {/* Botão 1ª Via RG */}
                  <div className="col-6">
                    <button 
                      type="button"
                      role="button"
                      aria-pressed={serviceFilter === 'first_issue'}
                      onClick={() => setServiceFilter(prev => prev === 'first_issue' ? 'all' : 'first_issue')}
                      className="w-100 p-2.5 rounded-3 text-center btn-service-filter d-flex flex-column align-items-center justify-content-center"
                      style={{ 
                        background: serviceFilter === 'first_issue' 
                          ? 'linear-gradient(180deg, #059669 0%, #047857 100%)' 
                          : 'linear-gradient(180deg, rgba(6, 78, 59, 0.9) 0%, rgba(3, 46, 35, 0.95) 100%)', 
                        border: serviceFilter === 'first_issue' 
                          ? '2px solid #34D399' 
                          : '1.5px solid #059669',
                        boxShadow: serviceFilter === 'first_issue' 
                          ? '0 0 16px rgba(52, 211, 153, 0.55), inset 0 1px 2px rgba(255, 255, 255, 0.3)' 
                          : '0 2px 6px rgba(0, 0, 0, 0.3)',
                        opacity: serviceFilter === 'second_issue' ? 0.45 : 1,
                        transform: serviceFilter === 'first_issue' ? 'scale(1.02)' : 'scale(1)',
                        color: '#FFFFFF'
                      }}
                      title={serviceFilter === 'first_issue' ? 'Clique para desativar filtro de 1ª Via' : 'Clique para filtrar agendamentos de 1ª Via RG (Guichê 01 · Dra. Lima)'}
                    >
                      <div className="d-flex align-items-center justify-content-center gap-1 w-100">
                        <i className="bi bi-person-fill" style={{ color: '#6EE7B7', fontSize: '11px' }}></i>
                        <span className="fw-bold text-truncate" style={{ fontSize: '11.5px', color: '#A7F3D0', letterSpacing: '0.2px' }}>1ª Via RG</span>
                        {serviceFilter === 'first_issue' && (
                          <span className="badge rounded-pill bg-white text-success fw-bolder px-1.5 py-0 shadow-xs" style={{ fontSize: '9px' }}>✓ ATIVO</span>
                        )}
                      </div>
                      <div className="fs-3 fw-bolder text-white my-0.5" style={{ lineHeight: '1.2' }}>{serviceStats.firstIssue}</div>
                      <div className="text-truncate px-1 rounded w-100" style={{ fontSize: '10px', color: '#6EE7B7', backgroundColor: 'rgba(5, 150, 105, 0.25)' }}>Guichê 01 · Dra. Lima</div>
                    </button>
                  </div>

                  {/* Botão 2ª Via RG */}
                  <div className="col-6">
                    <button 
                      type="button"
                      role="button"
                      aria-pressed={serviceFilter === 'second_issue'}
                      onClick={() => setServiceFilter(prev => prev === 'second_issue' ? 'all' : 'second_issue')}
                      className="w-100 p-2.5 rounded-3 text-center btn-service-filter d-flex flex-column align-items-center justify-content-center"
                      style={{ 
                        background: serviceFilter === 'second_issue' 
                          ? 'linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)' 
                          : 'linear-gradient(180deg, rgba(30, 58, 138, 0.9) 0%, rgba(23, 37, 84, 0.95) 100%)', 
                        border: serviceFilter === 'second_issue' 
                          ? '2px solid #60A5FA' 
                          : '1.5px solid #2563EB',
                        boxShadow: serviceFilter === 'second_issue' 
                          ? '0 0 16px rgba(96, 165, 250, 0.55), inset 0 1px 2px rgba(255, 255, 255, 0.3)' 
                          : '0 2px 6px rgba(0, 0, 0, 0.3)',
                        opacity: serviceFilter === 'first_issue' ? 0.45 : 1,
                        transform: serviceFilter === 'second_issue' ? 'scale(1.02)' : 'scale(1)',
                        color: '#FFFFFF'
                      }}
                      title={serviceFilter === 'second_issue' ? 'Clique para desativar filtro de 2ª Via' : 'Clique para filtrar agendamentos de 2ª Via RG (Guichê 02 · Dr. Silva)'}
                    >
                      <div className="d-flex align-items-center justify-content-center gap-1 w-100">
                        <i className="bi bi-person-vcard-fill" style={{ color: '#93C5FD', fontSize: '11px' }}></i>
                        <span className="fw-bold text-truncate" style={{ fontSize: '11.5px', color: '#BFDBFE', letterSpacing: '0.2px' }}>2ª Via RG</span>
                        {serviceFilter === 'second_issue' && (
                          <span className="badge rounded-pill bg-white text-primary fw-bolder px-1.5 py-0 shadow-xs" style={{ fontSize: '9px' }}>✓ ATIVO</span>
                        )}
                      </div>
                      <div className="fs-3 fw-bolder text-white my-0.5" style={{ lineHeight: '1.2' }}>{serviceStats.secondIssue}</div>
                      <div className="text-truncate px-1 rounded w-100" style={{ fontSize: '10px', color: '#93C5FD', backgroundColor: 'rgba(37, 99, 235, 0.25)' }}>Guichê 02 · Dr. Silva</div>
                    </button>
                  </div>
                </div>

                {/* Barra de Status e Ação Rápida no Rodapé do Card (Onde o usuário marcou) */}
                {serviceFilter !== 'all' ? (
                  <div 
                    className="mt-2.5 p-2 rounded-3 d-flex align-items-center justify-content-between"
                    style={{ 
                      backgroundColor: serviceFilter === 'first_issue' ? 'rgba(6, 78, 59, 0.6)' : 'rgba(30, 58, 138, 0.6)',
                      border: `1px dashed ${serviceFilter === 'first_issue' ? '#10B981' : '#3B82F6'}`
                    }}
                  >
                    <div className="d-flex align-items-center gap-1.5" style={{ fontSize: '11px', color: '#FFFFFF' }}>
                      <i className={`bi ${serviceFilter === 'first_issue' ? 'bi-funnel-fill text-success' : 'bi-funnel-fill text-primary'}`}></i>
                      <span>
                        Filtro ativo:{' '}
                        <strong>{serviceFilter === 'first_issue' ? '1ª Via (Guichê 01)' : '2ª Via (Guichê 02)'}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setServiceFilter('all')
                      }}
                      className="btn btn-sm btn-light py-0 px-2 fw-bold text-dark rounded-pill d-inline-flex align-items-center gap-1 shadow-xs"
                      style={{ fontSize: '10.5px' }}
                      title="Remover filtro e mostrar todas as vias"
                    >
                      <i className="bi bi-x-circle-fill"></i>
                      Ver Todas
                    </button>
                  </div>
                ) : (
                  <div 
                    className="mt-2 text-center py-1 rounded" 
                    style={{ fontSize: '10.5px', color: '#94A3B8', backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                  >
                    <i className="bi bi-cursor-fill me-1 text-primary"></i>
                    Clique no botão para filtrar a grade por via
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>

        {/* Bottom Row: Activity Feed */}
        <div className="row g-3">
          
          {/* ACTIVITY FEED (Linhas de Atendimentos Iminentes) */}
          <div className="col-12">
            <div 
              className="p-3 rounded-4 h-100"
              style={{
                backgroundColor: '#1E293B',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                <div className="fw-bold small d-flex align-items-center gap-2 text-white" style={{ fontSize: '13px' }}>
                  <i className="bi bi-clock-history text-primary"></i>
                  Próximos da Fila / Atendimentos Iminentes
                </div>
                <button 
                  type="button" 
                  onClick={() => setViewMode('table')}
                  className="btn btn-link btn-sm text-decoration-none p-0 small fw-semibold"
                  style={{ fontSize: '12px', color: '#60A5FA' }}
                >
                  Ver lista completa →
                </button>
              </div>

              {imminentList.length === 0 ? (
                <div className="text-center py-3 small" style={{ color: '#CBD5E1' }}>
                  Nenhum atendimento na fila imediata no momento.
                </div>
              ) : (
                <div className="d-flex flex-column gap-1">
                  {imminentList.map(item => (
                    <div 
                      key={item.id}
                      className="d-flex align-items-center justify-content-between p-2 rounded-3"
                      style={{ backgroundColor: '#0F172A', border: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '12px' }}
                    >
                      <div className="d-flex align-items-center gap-2 overflow-hidden">
                        <span className="badge bg-dark font-monospace text-primary">{item.protocol}</span>
                        <strong className="text-white text-truncate">{item.name}</strong>
                        <span style={{ color: '#CBD5E1', fontSize: '11.5px' }}>({item.service})</span>
                      </div>

                      <div className="d-flex align-items-center gap-2 flex-shrink-0">
                        <span className="text-white fw-medium">{item.time}</span>
                        <span className={`badge rounded-pill ${
                          item.status === 'completed' ? 'bg-success' :
                          item.isOverdue ? 'bg-danger' : 'bg-primary'
                        }`}>
                          {item.status === 'completed' ? 'Atendido' : item.isOverdue ? 'Atrasado' : 'Agendado'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Modal de Agendamento Presencial com Data/Horário Pré-preenchidos */}
      <WalkInBookingModal
        isOpen={walkInModal.isOpen}
        initialDate={walkInModal.date}
        initialTime={walkInModal.time}
        onClose={() => setWalkInModal({ isOpen: false })}
        onSuccess={(protocol) => {
          setNewlyAddedId(protocol)
          fetchFreshMetrics(protocol, activeWeekRange.start ? activeWeekRange : undefined)
        }}
      />

    </div>
  )
}

