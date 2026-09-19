'use client'

import React from 'react'

interface EmptyStateCanvasProps {
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyStateCanvas({
  title = 'Nenhum Agendamento Encontrado',
  description = 'Não há atendimentos programados para o período ou filtros selecionados.',
  actionLabel = 'Novo Agendamento Presencial',
  onAction
}: EmptyStateCanvasProps) {
  return (
    <div 
      className="d-flex flex-column align-items-center justify-content-center text-center p-5 h-100 w-100"
      style={{
        minHeight: '420px',
        backgroundColor: '#111827',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#E5E7EB'
      }}
    >
      {/* Landscape / Mountain Illustration matching the wireframe avatar */}
      <div 
        className="d-flex align-items-center justify-content-center mb-4 position-relative"
        style={{
          width: '110px',
          height: '110px',
          borderRadius: '28px',
          backgroundColor: '#1F2937',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
        }}
      >
        <svg 
          width="54" 
          height="54" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#9CA3AF" 
          strokeWidth="1.6" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          {/* Sun / Moon circle */}
          <circle cx="9" cy="9" r="2.5" fill="#9CA3AF" />
          {/* Landscape Mountains */}
          <path d="M21 17l-5.5-6.5-4.5 5.5-3-3.5L3 17" fill="none" strokeWidth="2" />
          <rect x="3" y="3" width="18" height="18" rx="4" strokeWidth="1.6" />
        </svg>

        {/* Ambient glow */}
        <div 
          className="position-absolute rounded-circle"
          style={{
            width: '80px',
            height: '80px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />
      </div>

      <h4 className="fw-bold mb-2 text-white" style={{ fontSize: '18px', letterSpacing: '-0.01em' }}>
        {title}
      </h4>

      <p className="mb-4" style={{ maxWidth: '420px', fontSize: '14px', color: '#CBD5E1', lineHeight: '1.5' }}>
        {description}
      </p>

      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn btn-primary btn-sm px-4 py-2 fw-semibold rounded-3 shadow-sm d-inline-flex align-items-center gap-2"
          style={{
            backgroundColor: '#3B82F6',
            borderColor: '#2563EB',
            fontSize: '13px'
          }}
        >
          <i className="bi bi-plus-lg"></i>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
