'use client'

import React, { useState } from 'react'
import AdminSidebar from './AdminSidebar'
import WalkInBookingModal from './WalkInBookingModal'

interface Props {
  userFullName: string
  userRole: string
  initialDailyCount: number
  children: React.ReactNode
}

function getInitials(name?: string): string {
  if (!name) return 'AD'
  const clean = name.replace(/^(Dr\.|Dra\.|Sr\.|Sra\.)\s+/i, '').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'AD'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function AdminLayoutShell({
  userFullName,
  userRole,
  initialDailyCount,
  children
}: Props) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isQuickWalkInOpen, setIsQuickWalkInOpen] = useState(false)

  const initials = getInitials(userFullName)

  return (
    <div 
      className="d-flex flex-column flex-lg-row" 
      style={{ 
        height: '100vh', 
        maxHeight: '100vh',
        width: '100vw', 
        overflow: 'hidden', 
        backgroundColor: 'var(--main-bg, #262626)' 
      }}
    >
      {/* 1. Header Mobile Exclusivo (< 992px) */}
      <header 
        className="d-flex d-lg-none align-items-center justify-content-between px-3 py-2 border-bottom flex-shrink-0"
        style={{
          backgroundColor: 'var(--sidebar-bg, #0D0D0D)',
          borderColor: 'rgba(74, 222, 128, 0.18) !important',
          zIndex: 1020,
          minHeight: '56px'
        }}
      >
        <div className="d-flex align-items-center gap-2">
          {/* Botão Hambúrguer para abrir Gaveta Mobile */}
          <button
            type="button"
            className="btn btn-sm text-white p-1.5 d-flex align-items-center justify-content-center border-0 rounded-3"
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Abrir menu de navegação"
            style={{ backgroundColor: 'rgba(74, 222, 128, 0.12)', color: '#86EFAC' }}
          >
            <i className="bi bi-list fs-4"></i>
          </button>

          {/* Logo e Título Compacto Mobile */}
          <div className="d-flex align-items-center gap-2">
            <div className="p-1 px-1.5 rounded-2 bg-white d-flex align-items-center shadow-xs">
              <img 
                src="/logo-poranga.png" 
                alt="Prefeitura de Poranga" 
                style={{ maxHeight: '26px', objectFit: 'contain' }}
              />
            </div>
            <div className="overflow-hidden">
              <div className="fw-bold text-white text-truncate" style={{ fontSize: '13px', lineHeight: '1.2' }}>
                Identificação Civil
              </div>
              <div className="text-truncate" style={{ fontSize: '10px', color: '#86EFAC' }}>
                Prefeitura de Poranga
              </div>
            </div>
          </div>
        </div>

        {/* Ações Rápidas Mobile */}
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm fw-bold text-white d-flex align-items-center gap-1 shadow-xs border-0"
            onClick={() => setIsQuickWalkInOpen(true)}
            title="Agendar presencialmente"
            style={{
              backgroundColor: '#16A34A',
              fontSize: '11px',
              padding: '6px 10px',
              borderRadius: '7px'
            }}
          >
            <i className="bi bi-plus-lg"></i>
            <span className="d-none d-sm-inline">Presencial</span>
          </button>

          {/* Avatar com Iniciais */}
          <div 
            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-xs"
            style={{
              width: '30px',
              height: '30px',
              backgroundColor: '#166534',
              border: '1px solid #4ADE80',
              fontSize: '11px'
            }}
            title={`Conectado como: ${userFullName}`}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* 2. Sidebar Slate-Navy (Desktop Sticky / Mobile Drawer) */}
      <AdminSidebar 
        userFullName={userFullName}
        userRole={userRole}
        initialDailyCount={initialDailyCount}
        isMobileOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* 3. Conteúdo Central com Rolagem Independente */}
      <main 
        className="flex-grow-1 p-2 p-sm-3 p-lg-4 overflow-y-auto" 
        style={{ 
          height: '100%', 
          backgroundColor: 'var(--main-bg, #262626)' 
        }}
      >
        {children}
      </main>

      {/* Modal de Agendamento Presencial acionado pelo Header Mobile */}
      <WalkInBookingModal 
        isOpen={isQuickWalkInOpen}
        onClose={() => setIsQuickWalkInOpen(false)}
      />
    </div>
  )
}
