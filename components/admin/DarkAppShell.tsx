'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import WalkInBookingModal from './WalkInBookingModal'

interface MetricItem {
  label: string
  value: number | string
  subtext?: string
  color: string
  bg: string
  border: string
  icon: string
}

interface ActivityItem {
  id: string
  protocol: string
  name: string
  time: string
  service: string
  status: string
  isOverdue?: boolean
}

interface AttendantItem {
  guiche: string
  attendant: string
  service: string
  active: boolean
  count: number
}

interface DarkAppShellProps {
  children: React.ReactNode
  activeView: 'grid' | 'table' | 'completed'
  onViewChange: (view: 'grid' | 'table' | 'completed') => void
  userFullName?: string
  userRole?: string
  metrics: {
    dailyAppointments: number
    monthlyAppointments: number
    limit: number
    restantes: number
    overdueCount?: number
    completedCount?: number
  }
  imminentAppointments?: ActivityItem[]
  onSearch?: (query: string) => void
  onQuickBookingSuccess?: (protocol: string) => void
}

function getInitials(name?: string): string {
  if (!name) return 'AD'
  const clean = name.replace(/^(Dr\.|Dra\.|Sr\.|Sra\.)\s+/i, '').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'AD'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function DarkAppShell({
  children,
  activeView,
  onViewChange,
  userFullName = 'Administrador',
  userRole = 'Administrador',
  metrics,
  imminentAppointments = [],
  onSearch,
  onQuickBookingSuccess
}: DarkAppShellProps) {
  const pathname = usePathname()
  const [isWalkInOpen, setIsWalkInOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const initials = getInitials(userFullName)

  // Navigation Items mapped to real routes & view modes
  const navItems = [
    {
      id: 'grid',
      label: 'Grade Semanal',
      icon: 'bi bi-grid-fill',
      action: () => onViewChange('grid'),
      isActive: pathname === '/admin' && activeView === 'grid'
    },
    {
      id: 'table',
      label: 'Lista de Agendamentos',
      icon: 'bi bi-list-ul',
      action: () => onViewChange('table'),
      isActive: pathname === '/admin' && activeView === 'table'
    },
    {
      id: 'completed',
      label: 'Atendimentos Realizados',
      icon: 'bi bi-check2-all',
      action: () => onViewChange('completed'),
      isActive: pathname === '/admin' && activeView === 'completed'
    },
    {
      id: 'relatorios',
      label: 'Relatórios & Estatísticas',
      icon: 'bi bi-bar-chart-fill',
      href: '/admin/relatorios',
      isActive: pathname === '/admin/relatorios'
    },
    {
      id: 'configuracoes',
      label: 'Configurações do Sistema',
      icon: 'bi bi-gear-fill',
      href: '/admin/configuracoes',
      isActive: pathname === '/admin/configuracoes'
    }
  ]

  // Layered Cards Data for Right Deck (Paleta de Cores dos Botões/Ícones)
  const deckCards = [
    {
      label: 'Agendamentos Hoje',
      value: metrics.dailyAppointments,
      subtext: 'Marcados para hoje',
      color: '#60A5FA',
      bg: '#1E293B',
      border: 'rgba(96, 165, 250, 0.25)',
      icon: 'bi bi-calendar-check',
      iconBg: '#038C33',
      iconColor: '#FFFFFF'
    },
    {
      label: 'Vagas Restantes no Mês',
      value: metrics.restantes,
      subtext: `${metrics.monthlyAppointments} usadas de ${metrics.limit}`,
      color: '#34D399',
      bg: '#132E27',
      border: 'rgba(52, 211, 153, 0.25)',
      icon: 'bi bi-ticket-perforated',
      iconBg: '#0DF205',
      iconColor: '#0D0D0D'
    },
    {
      label: 'Não Compareceu / Atrasados',
      value: metrics.overdueCount || 0,
      subtext: 'Horário ultrapassado',
      color: '#F87171',
      bg: '#2A1719',
      border: 'rgba(248, 113, 113, 0.25)',
      icon: 'bi bi-clock-history',
      iconBg: '#F2CB05',
      iconColor: '#0D0D0D'
    },
    {
      label: 'Atendimentos Concluídos',
      value: metrics.completedCount || 0,
      subtext: 'Realizados com sucesso',
      color: '#38BDF8',
      bg: '#142838',
      border: 'rgba(56, 189, 248, 0.25)',
      icon: 'bi bi-person-check',
      iconBg: '#20593F',
      iconColor: '#0DF205'
    }
  ]

  // Active Desk Staff (Guichês)
  const activeAttendants: AttendantItem[] = [
    {
      guiche: 'Guichê 01',
      attendant: 'Dra. Lima',
      service: '1ª Via RG',
      active: true,
      count: Math.ceil(metrics.dailyAppointments / 2)
    },
    {
      guiche: 'Guichê 02',
      attendant: 'Dr. Silva',
      service: '2ª Via RG',
      active: true,
      count: Math.floor(metrics.dailyAppointments / 2)
    }
  ]

  return (
    <div 
      className="p-3 p-md-4 min-vh-100"
      style={{
        backgroundColor: '#0B0F17',
        color: '#E2E8F0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }}
    >
      {/* Outer Rounded Application Frame */}
      <div 
        className="d-flex flex-column flex-lg-row gap-3 rounded-4 p-3 p-lg-4"
        style={{
          backgroundColor: '#111827',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          borderRadius: '24px',
          minHeight: 'calc(100vh - 48px)'
        }}
      >
        
        {/* ========================================================= */}
        {/* 1. LEFT VERTICAL SIDEBAR (Navegação em Cápsula & Ação Rápida) */}
        {/* ========================================================= */}
        <aside 
          className="d-flex flex-row flex-lg-column align-items-center justify-content-between flex-shrink-0"
          style={{ width: 'auto', minWidth: '68px', gap: '14px' }}
        >
          {/* Top Quick Action Star Button (✨) */}
          <button
            type="button"
            onClick={() => setIsWalkInOpen(true)}
            className="btn rounded-circle d-flex align-items-center justify-content-center border-0 shadow-lg text-white"
            title="Novo Agendamento Presencial (Ação Rápida)"
            style={{
              width: '52px',
              height: '52px',
              backgroundColor: '#1F2937',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3B82F6'
              e.currentTarget.style.transform = 'scale(1.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1F2937'
              e.currentTarget.style.transform = 'none'
            }}
          >
            {/* Sparkle / Star Icon */}
            <i className="bi bi-stars fs-4" style={{ color: '#FCD34D' }}></i>
          </button>

          {/* Middle Rounded Capsule with Navigation Icons */}
          <div 
            className="d-flex flex-row flex-lg-column align-items-center gap-2 p-2 rounded-pill"
            style={{
              backgroundColor: '#1F2937',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)'
            }}
          >
            {navItems.map(item => {
              const active = item.isActive

              const content = (
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center position-relative"
                  title={item.label}
                  style={{
                    width: '42px',
                    height: '42px',
                    backgroundColor: active ? '#3B82F6' : 'transparent',
                    color: active ? '#FFFFFF' : '#9CA3AF',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.color = '#FFFFFF'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = '#9CA3AF'
                    }
                  }}
                >
                  <i className={`${item.icon} fs-5`}></i>
                  
                  {/* Notch / Indicator on active */}
                  {active && (
                    <span 
                      className="position-absolute end-0 top-50 translate-middle-y d-none d-lg-block rounded-pill"
                      style={{
                        width: '3px',
                        height: '16px',
                        backgroundColor: '#93C5FD',
                        right: '-6px'
                      }}
                    />
                  )}
                </div>
              )

              if (item.href) {
                return (
                  <Link key={item.id} href={item.href} className="text-decoration-none">
                    {content}
                  </Link>
                )
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  className="btn p-0 border-0 bg-transparent"
                >
                  {content}
                </button>
              )
            })}
          </div>

          {/* Bottom Avatar / Profile & Logout */}
          <div className="d-flex flex-column align-items-center gap-2 mt-lg-auto">
            <div 
              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm"
              title={`${userFullName} (${userRole})`}
              style={{
                width: '46px',
                height: '46px',
                backgroundColor: '#374151',
                border: '2px solid #4B5563',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {initials}
            </div>

            <form action={logout} className="m-0 p-0">
              <button
                type="submit"
                className="btn btn-link p-1 text-decoration-none rounded-circle d-flex align-items-center justify-content-center"
                style={{
                  width: '32px',
                  height: '32px',
                  color: '#6B7280',
                  transition: 'all 0.15s ease'
                }}
                title="Sair do sistema"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#EF4444'
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6B7280'
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <i className="bi bi-box-arrow-right fs-6"></i>
              </button>
            </form>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* MAIN BODY GRID (Centro-Hero + Lateral Direita + Inferiores) */}
        {/* ========================================================= */}
        <div className="flex-grow-1 d-flex flex-column gap-3 overflow-hidden">
          
          {/* Top Row: Hero Main Viewport (Left 70%) + Metrics Deck (Right 30%) */}
          <div className="row g-3 flex-grow-1">
            
            {/* 2. MAIN HERO VIEWPORT (Grade / Conteúdo Central) */}
            <div className="col-12 col-xl-8 d-flex flex-column">
              <div 
                className="flex-grow-1 rounded-4 p-3 p-md-4 d-flex flex-column justify-content-between position-relative overflow-hidden"
                style={{
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                  minHeight: '480px'
                }}
              >
                {/* Viewport Content */}
                <div className="flex-grow-1 overflow-auto mb-3">
                  {children}
                </div>

                {/* Bottom Action / Search Bar Pill */}
                <div className="pt-2 border-top border-secondary border-opacity-25">
                  <div 
                    className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill"
                    style={{
                      backgroundColor: '#0F172A',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <span
                      className="d-flex align-items-center justify-content-center ps-1 flex-shrink-0"
                      style={{ width: '24px', height: '24px', color: '#94A3B8' }}
                      title="Buscar"
                    >
                      <i className="bi bi-search" style={{ fontSize: '14px' }}></i>
                    </span>

                    <input
                      type="text"
                      className="form-control form-control-sm bg-transparent border-0 text-white shadow-none"
                      placeholder="Buscar por cidadão, protocolo, guichê ou horário..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        onSearch?.(e.target.value)
                      }}
                      style={{ fontSize: '13px', color: '#F8FAFC' }}
                    />

                    {searchQuery && (
                      <button
                        type="button"
                        className="btn btn-sm p-0"
                        style={{ color: '#CBD5E1' }}
                        onClick={() => {
                          setSearchQuery('')
                          onSearch?.('')
                        }}
                      >
                        <i className="bi bi-x-circle-fill"></i>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* 3. RIGHT METRICS DECK (Cards Empilhados / Cascata) */}
            <div className="col-12 col-xl-4 d-flex flex-column gap-3">
              
              {/* Stacked Cards with Layered Depth */}
              <div className="d-flex flex-column gap-2 flex-grow-1 justify-content-between">
                {deckCards.map((card, idx) => (
                  <div
                    key={card.label}
                    className="p-3 rounded-4 d-flex align-items-center justify-content-between transition-all"
                    style={{
                      backgroundColor: card.bg,
                      border: `1px solid ${card.border}`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                      minHeight: '84px',
                      transform: `translateY(${idx * 0}px)`
                    }}
                  >
                    <div>
                      <div className="small fw-semibold" style={{ fontSize: '11.5px', color: '#CBD5E1', letterSpacing: '0.01em' }}>
                        {card.label}
                      </div>
                      <div className="fw-bold" style={{ fontSize: '24px', color: card.color, lineHeight: '1.2' }}>
                        {card.value}
                      </div>
                      {card.subtext && (
                        <div className="small" style={{ fontSize: '11px', color: '#E2E8F0', opacity: 0.9 }}>
                          {card.subtext}
                        </div>
                      )}
                    </div>

                    <div 
                      className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: '42px',
                        height: '42px',
                        backgroundColor: card.iconBg || 'rgba(255, 255, 255, 0.06)',
                        color: card.iconColor || card.color,
                        fontSize: '18px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)'
                      }}
                    >
                      <i className={card.icon}></i>
                    </div>
                  </div>
                ))}
              </div>

            </div>

          </div>

          {/* Bottom Row: 4. Activity Feed (Left) + 5. Attendants Stack (Right) */}
          <div className="row g-3">
            
            {/* 4. ACTIVITY FEED (Linhas / Próximos Atendimentos) */}
            <div className="col-12 col-xl-8">
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
                    onClick={() => onViewChange('table')}
                    className="btn btn-link btn-sm text-decoration-none p-0 text-primary small"
                    style={{ fontSize: '11.5px' }}
                  >
                    Ver todos →
                  </button>
                </div>

                {imminentAppointments.length === 0 ? (
                  <div className="text-center py-3 small" style={{ color: '#CBD5E1' }}>
                    Nenhum agendamento imediato na fila no momento.
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-1">
                    {imminentAppointments.slice(0, 3).map(item => (
                      <div 
                        key={item.id}
                        className="d-flex align-items-center justify-content-between p-2 rounded-3"
                        style={{ backgroundColor: '#0F172A', border: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '12px' }}
                      >
                        <div className="d-flex align-items-center gap-2 overflow-hidden">
                          <span className="badge bg-dark font-monospace text-primary">{item.protocol}</span>
                          <strong className="text-white text-truncate">{item.name}</strong>
                          <span className="small" style={{ color: '#CBD5E1' }}>({item.service})</span>
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

            {/* 5. ATTENDANTS STACK (Cards Sobrepostos / Guichês Ativos) */}
            <div className="col-12 col-xl-4">
              <div 
                className="p-3 rounded-4 h-100 position-relative overflow-hidden"
                style={{
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                  <div className="fw-bold small d-flex align-items-center gap-2 text-white" style={{ fontSize: '13px' }}>
                    <i className="bi bi-person-workspace text-info"></i>
                    Guichês em Atendimento
                  </div>
                  <span className="badge bg-success small">Operacional</span>
                </div>

                {/* Overlapping Stack Deck Cards */}
                <div className="d-flex flex-column gap-2">
                  {activeAttendants.map((att, idx) => (
                    <div 
                      key={att.guiche}
                      className="p-2 px-3 rounded-3 d-flex align-items-center justify-content-between"
                      style={{
                        backgroundColor: idx === 0 ? '#132E27' : '#142838',
                        border: `1px solid ${idx === 0 ? 'rgba(52, 211, 153, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        fontSize: '12px'
                      }}
                    >
                      <div>
                        <strong className="text-white d-block">{att.guiche} · {att.attendant}</strong>
                        <span className="small" style={{ color: '#CBD5E1' }}>{att.service}</span>
                      </div>

                      <div className="text-end">
                        <span className="badge bg-dark border border-secondary text-white">{att.count} atendimentos</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Quick Booking Modal */}
      <WalkInBookingModal
        isOpen={isWalkInOpen}
        onClose={() => setIsWalkInOpen(false)}
        onSuccess={(protocol) => {
          onQuickBookingSuccess?.(protocol)
        }}
      />
    </div>
  )
}
