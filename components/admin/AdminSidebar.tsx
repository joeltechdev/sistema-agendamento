'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import WalkInBookingModal from './WalkInBookingModal'

interface AdminSidebarProps {
  userFullName?: string
  userRole?: string
  initialDailyCount?: number
  isMobileOpen?: boolean
  onClose?: () => void
}

interface NavItem {
  label: string
  href: string
  icon: string
  exact?: boolean
  badge?: number
}

interface NavGroup {
  title: string
  items: NavItem[]
}

function getInitials(name?: string): string {
  if (!name) return 'AD'
  const clean = name.replace(/^(Dr\.|Dra\.|Sr\.|Sra\.)\s+/i, '').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'AD'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function isDateForToday(dateInput?: string): boolean {
  if (!dateInput) return false
  const clean = String(dateInput).split('T')[0].trim()
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const todayStr = `${y}-${m}-${d}`
  return clean === todayStr
}

export default function AdminSidebar({
  userFullName = 'Administrador',
  userRole = 'admin',
  initialDailyCount = 0,
  isMobileOpen = false,
  onClose
}: AdminSidebarProps) {
  const pathname = usePathname()
  const [isWalkInOpen, setIsWalkInOpen] = useState(false)
  const [dailyCount, setDailyCount] = useState(initialDailyCount)

  // Sincronizar estado local quando as props do servidor forem atualizadas (SSR / revalidações)
  useEffect(() => {
    setDailyCount(initialDailyCount)
  }, [initialDailyCount])

  // Escuta eventos em tempo real (SSE, BroadcastChannel e Custom Events) filtrando estritamente para o dia de hoje
  useEffect(() => {
    const handleSync = (e: any) => {
      const payload = e.detail || e.data || {}
      const targetDate = payload.appointment_date || payload.date
      if (isDateForToday(targetDate)) {
        setDailyCount(prev => prev + 1)
      }
    }

    const handleCancelSync = (e: any) => {
      const payload = e.detail || e.data || {}
      const targetDate = payload.appointment_date || payload.date
      if (isDateForToday(targetDate)) {
        setDailyCount(prev => Math.max(0, prev - 1))
      }
    }

    window.addEventListener('new_booking_event', handleSync)
    window.addEventListener('booking_cancelled_event', handleCancelSync)
    
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel('scheduling_sync_channel')
      channel.onmessage = (msg) => {
        if (msg.data?.type === 'NEW_BOOKING_EVENT' || msg.data?.type === 'NEW_BOOKING') {
          const targetDate = msg.data?.appointment_date || msg.data?.date
          if (isDateForToday(targetDate)) {
            setDailyCount(prev => prev + 1)
          }
        } else if (msg.data?.type === 'BOOKING_CANCELLED') {
          const targetDate = msg.data?.appointment_date || msg.data?.date
          if (isDateForToday(targetDate)) {
            setDailyCount(prev => Math.max(0, prev - 1))
          }
        }
      }
    } catch {
      // BroadcastChannel indisponível em alguns ambientes restritos
    }

    // Server-Sent Events (SSE) para atualização em tempo real entre diferentes navegadores
    let eventSource: EventSource | null = null
    try {
      eventSource = new EventSource('/api/admin/events')
      eventSource.onerror = () => {
        // Encerra imediatamente para não esgotar sockets do navegador em serverless (Vercel)
        if (eventSource) {
          eventSource.close()
        }
      }
      eventSource.addEventListener('new_booking', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          const targetDate = data.appointment_date || data.date
          if (isDateForToday(targetDate)) {
            setDailyCount(prev => prev + 1)
          }
        } catch {}
      })
      eventSource.addEventListener('booking_cancelled', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          const targetDate = data.appointment_date || data.date
          if (isDateForToday(targetDate)) {
            setDailyCount(prev => Math.max(0, prev - 1))
          }
        } catch {}
      })
    } catch {}

    return () => {
      window.removeEventListener('new_booking_event', handleSync)
      window.removeEventListener('booking_cancelled_event', handleCancelSync)
      if (channel) channel.close()
      if (eventSource) eventSource.close()
    }
  }, [])

  const navGroups: NavGroup[] = [
    {
      title: 'PRINCIPAL',
      items: [
        {
          label: 'Painel de Controle',
          href: '/admin',
          icon: 'bi bi-speedometer2',
          exact: true
        },
        {
          label: 'Agendamentos',
          href: '/admin/agendamentos',
          icon: 'bi bi-calendar2-check',
          badge: dailyCount > 0 ? dailyCount : undefined
        }
      ]
    },
    {
      title: 'GESTÃO',
      items: [
        {
          label: 'Relatórios',
          href: '/admin/relatorios',
          icon: 'bi bi-bar-chart-line'
        }
      ]
    },
    {
      title: 'SISTEMA',
      items: [
        {
          label: 'Administradores',
          href: '/admin/administradores',
          icon: 'bi bi-shield-lock'
        },
        {
          label: 'Configurações',
          href: '/admin/configuracoes',
          icon: 'bi bi-gear'
        }
      ]
    }
  ]

  const isItemActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const initials = getInitials(userFullName)
  const displayRole = userRole === 'admin' 
    ? 'Administrador' 
    : userRole === 'manager' 
      ? 'Supervisor' 
      : userRole === 'atendente' 
        ? 'Atendente' 
        : userRole === 'citizen'
          ? 'Cidadão'
          : (userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Atendente')

  return (
    <>
      {/* Backdrop escuro no celular */}
      {isMobileOpen && (
        <div 
          className="admin-backdrop d-lg-none"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside 
        className={`d-flex flex-column flex-shrink-0 admin-sidebar-mobile ${isMobileOpen ? 'open' : ''}`}
        style={{
          width: '264px',
          height: '100vh',
          maxHeight: '100vh',
          backgroundColor: 'var(--sidebar-bg, #0D0D0D)',
          position: 'sticky',
          top: 0,
          left: 0,
          zIndex: 1050,
          userSelect: 'none',
          borderRight: '1px solid rgba(74, 222, 128, 0.15)',
          overflow: 'hidden'
        }}
      >
        {/* 1. Header com Logo Oficial de Poranga */}
        <div className="px-3 pt-3 pb-2">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <Link 
              href="/admin" 
              onClick={() => { if (onClose) onClose() }}
              className="d-block text-decoration-none p-2 rounded-3 bg-white shadow-sm flex-grow-1"
              style={{ 
                border: '1px solid rgba(22, 101, 52, 0.25)',
                transition: 'transform 0.15s ease' 
              }}
            >
              <img 
                src="/logo-poranga.png" 
                alt="Prefeitura Municipal de Poranga" 
                className="img-fluid d-block mx-auto"
                style={{ maxHeight: '44px', objectFit: 'contain' }}
              />
            </Link>
            {onClose && (
              <button
                type="button"
                className="btn btn-sm text-white d-lg-none p-1 ms-2 rounded-circle border-0 d-flex align-items-center justify-content-center flex-shrink-0"
                onClick={onClose}
                aria-label="Fechar menu lateral"
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.12)', 
                  width: '32px', 
                  height: '32px',
                  color: '#86EFAC'
                }}
              >
                <i className="bi bi-x-lg fs-6"></i>
              </button>
            )}
          </div>

          <div className="px-1 text-center">
            <div 
              className="fw-bold text-white text-truncate"
              style={{ fontSize: '13px', lineHeight: '1.2', letterSpacing: '-0.2px' }}
            >
              Identificação Civil
            </div>
            <div 
              className="text-truncate"
              style={{ fontSize: '10.5px', color: '#86EFAC', marginTop: '1px' }}
            >
              Posto de Atendimento Municipal
            </div>
          </div>
        </div>

        {/* 2. Botão de Agendamento Presencial (Ação Prioritária - Verde Poranga) */}
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setIsWalkInOpen(true)
              if (onClose) onClose()
            }}
            className="btn w-100 d-flex align-items-center justify-content-center gap-2 fw-bold text-white shadow-sm"
            style={{
              backgroundColor: '#16A34A',
              border: 'none',
              borderRadius: '9px',
              padding: '11px 14px',
              fontSize: '12.5px',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.35)',
              transition: 'background-color 0.15s ease, transform 0.1s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#15803D')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#16A34A')}
          >
            <i className="bi bi-plus-lg fs-6"></i>
            <span>Agendar presencialmente</span>
          </button>
        </div>

        {/* 3. Divisor Sutil */}
        <div 
          className="mx-3 my-1" 
          style={{ height: '1px', backgroundColor: 'rgba(74, 222, 128, 0.12)' }}
        ></div>

        {/* 4. Lista de Navegação Agrupada (Scroll Interno) */}
        <div 
          className="flex-grow-1 px-3 py-2 overflow-y-auto"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(74, 222, 128, 0.2) transparent'
          }}
        >
          {navGroups.map((group, gIdx) => (
            <div key={group.title} className={gIdx > 0 ? 'mt-3' : ''}>
              {/* Rótulo da Seção */}
              <div 
                className="text-uppercase fw-bold px-2 mb-1"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  color: '#86EFAC',
                  fontWeight: 700
                }}
              >
                {group.title}
              </div>

              {/* Itens da Seção */}
              <div className="d-flex flex-column gap-1">
                {group.items.map(item => {
                  const active = isItemActive(item.href, item.exact)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { if (onClose) onClose() }}
                      id={`sidebar-link-${item.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')}`}
                      className="d-flex align-items-center justify-content-between text-decoration-none"
                      style={{
                        padding: '9px 10px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: active ? 600 : 500,
                        color: active ? '#FFFFFF' : '#D1FAE5',
                        backgroundColor: active ? 'rgba(34, 197, 94, 0.18)' : 'transparent',
                        borderLeft: active ? '3px solid #22C55E' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.08)'
                          e.currentTarget.style.color = '#FFFFFF'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                          e.currentTarget.style.color = '#D1FAE5'
                        }
                      }}
                    >
                      <div className="d-flex align-items-center gap-2 overflow-hidden">
                        <i 
                          className={`${item.icon} flex-shrink-0`}
                          style={{
                            fontSize: '17px',
                            width: '17px',
                            color: active ? '#4ADE80' : '#86EFAC',
                            display: 'inline-flex',
                            justifyContent: 'center'
                          }}
                        ></i>
                        <span className="text-truncate">{item.label}</span>
                      </div>

                      {item.badge !== undefined && (
                        <span 
                          className="badge rounded-pill fw-bold ms-2"
                          style={{
                            backgroundColor: '#16A34A',
                            color: '#FFFFFF',
                            fontSize: '10px',
                            padding: '2px 7px'
                          }}
                          title={`${item.badge} agendamentos hoje`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 5. Rodapé do Menu (Usuário Logado + Sair) */}
        <div 
          className="p-3"
          style={{
            borderTop: '1px solid rgba(74, 222, 128, 0.15)',
            backgroundColor: 'var(--sidebar-bg, #0D0D0D)'
          }}
        >
          <div className="d-flex align-items-center justify-content-between">
            
            {/* Usuário Logado (Apenas informativo - Exibe quem está logado) */}
            <div 
              className="d-flex align-items-center gap-2 overflow-hidden me-2 p-1"
              title={`Usuário conectado: ${userFullName} (${displayRole})`}
            >
              <div 
                className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0 shadow-sm"
                style={{
                  width: '34px',
                  height: '34px',
                  backgroundColor: '#166534',
                  border: '1px solid #4ADE80',
                  fontSize: '12px',
                  letterSpacing: '0.5px'
                }}
              >
                {initials}
              </div>

              <div className="overflow-hidden">
                <div 
                  className="fw-bold text-white text-truncate"
                  style={{ fontSize: '12.5px', lineHeight: '1.2' }}
                  title={userFullName}
                >
                  {userFullName}
                </div>
                <div 
                  className="text-truncate d-flex align-items-center gap-1.5"
                  style={{ fontSize: '10.5px', color: '#86EFAC', marginTop: '1px' }}
                >
                  <span 
                    className="d-inline-block rounded-circle" 
                    style={{ width: '6px', height: '6px', backgroundColor: '#4ADE80', flexShrink: 0 }}
                  ></span>
                  <span>{displayRole}</span>
                </div>
              </div>
            </div>

            {/* Sair Button */}
            <form action={logout} className="m-0 p-0 flex-shrink-0">
              <button
                type="submit"
                className="btn btn-link p-1 text-decoration-none d-flex align-items-center justify-content-center rounded"
                style={{
                  color: '#86EFAC',
                  width: '32px',
                  height: '32px',
                  transition: 'all 0.15s ease'
                }}
                title="Sair do sistema"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#EF4444'
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#86EFAC'
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <i className="bi bi-box-arrow-right fs-5"></i>
              </button>
            </form>

          </div>
        </div>

      </aside>

      {/* Modal de Agendamento Presencial */}
      <WalkInBookingModal 
        isOpen={isWalkInOpen}
        onClose={() => setIsWalkInOpen(false)}
        onSuccess={() => {
          // Increment daily count on new booking
          setDailyCount(prev => prev + 1)
        }}
      />
    </>
  )
}
