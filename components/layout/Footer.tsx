import React from 'react'
import { INSTITUTIONAL_CONFIG } from '@/lib/config/institutional'

interface FooterProps {
  className?: string
  style?: React.CSSProperties
  theme?: 'dark' | 'light'
}

export default function Footer({ className = '', style = {}, theme = 'dark' }: FooterProps) {
  const isDark = theme === 'dark'

  return (
    <div 
      className={`card-footer px-4 px-md-5 py-3 small d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 ${className}`}
      style={{
        backgroundColor: isDark ? '#09100C' : '#F8FAFC',
        borderTop: isDark ? '1px solid rgba(13, 242, 5, 0.12)' : '1px solid #E2E8F0',
        color: isDark ? '#94A3B8' : '#64748B',
        ...style
      }}
    >
      <div className="d-flex flex-column" style={{ gap: '6px' }}>
        {/* Linha 1: Município e Estado */}
        <div 
          className="d-flex align-items-center flex-wrap"
          style={{ 
            color: isDark ? '#E2E8F0' : '#1E293B',
            fontWeight: 500,
            fontSize: '13px',
            lineHeight: 1.4
          }}
        >
          <span 
            className="d-inline-flex align-items-center justify-content-center me-2" 
            style={{ 
              color: '#0DF205', 
              fontSize: '9px',
              lineHeight: 1
            }}
          >
            ●
          </span>
          <span>{INSTITUTIONAL_CONFIG.municipality}</span>
          <span className="mx-2" style={{ color: isDark ? '#475569' : '#94A3B8' }}>•</span>
          <span>{INSTITUTIONAL_CONFIG.state}</span>
        </div>

        {/* Linha 2: Prefeito e Vice-Prefeita - Perfeitamente alinhado com o texto acima */}
        <div 
          className="d-flex flex-wrap align-items-center"
          style={{ 
            fontSize: '12px', 
            color: isDark ? '#94A3B8' : '#64748B',
            paddingLeft: '17px',
            lineHeight: 1.4
          }}
        >
          <span>
            Prefeito: <strong style={{ color: isDark ? '#CBD5E1' : '#334155', fontWeight: 500 }}>{INSTITUTIONAL_CONFIG.mayor}</strong>
          </span>
          <span className="mx-2" style={{ color: isDark ? '#475569' : '#94A3B8' }}>•</span>
          <span>
            Vice-Prefeita: <strong style={{ color: isDark ? '#CBD5E1' : '#334155', fontWeight: 500 }}>{INSTITUTIONAL_CONFIG.viceMayor}</strong>
          </span>
        </div>
      </div>

      {/* Lado Direito: Setor de Identificação Civil */}
      <div 
        className="text-md-end mt-1 mt-md-0 fw-medium" 
        style={{ 
          color: isDark ? '#86EFAC' : '#038C33', 
          fontSize: '12px',
          letterSpacing: '0.2px'
        }}
      >
        {INSTITUTIONAL_CONFIG.sector}
      </div>
    </div>
  )
}
