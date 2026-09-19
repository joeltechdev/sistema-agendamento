'use client'

import Link from 'next/link'
import Image from 'next/image'
import Footer from '@/components/layout/Footer'

export default function Home() {
  return (
    <main 
      className="min-vh-100 d-flex align-items-center justify-content-center p-3 p-md-4 position-relative overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 15%, #20593F 0%, #0D0D0D 60%, #050806 100%)',
      }}
    >
      {/* Ambient Glow Background Effect */}
      <div 
        className="position-absolute top-50 start-50 translate-middle pointer-events-none"
        style={{
          width: '650px',
          height: '650px',
          background: 'radial-gradient(circle, rgba(13, 242, 5, 0.08) 0%, transparent 70%)',
          filter: 'blur(50px)',
          zIndex: 0
        }}
      />

      {/* Main Premium Card */}
      <div 
        className="card border-0 rounded-4 overflow-hidden w-100 position-relative shadow-2xl" 
        style={{ 
          maxWidth: '880px', 
          backgroundColor: '#121A15',
          border: '1px solid rgba(13, 242, 5, 0.22)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 40px rgba(13, 242, 5, 0.06)',
          zIndex: 1
        }}
      >
        <div className="card-body p-4 p-md-5">
          
          {/* Top Logo & Institutional Badge */}
          <div 
            className="mb-4 pb-4 d-flex align-items-center justify-content-between flex-wrap gap-3"
            style={{ borderBottom: '1px solid rgba(13, 242, 5, 0.15)' }}
          >
            {/* Logo Oficial de Poranga com Fundo Branco Limpo */}
            <div 
              className="p-2 px-3 rounded-3 bg-white d-inline-flex align-items-center shadow-sm"
              style={{ 
                border: '1px solid rgba(242, 203, 5, 0.35)',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)' 
              }}
            >
              <Image 
                src="/logo-poranga.png" 
                alt="Prefeitura Municipal de Poranga - Força e Coragem para Mudar" 
                width={200} 
                height={60}
                priority
                style={{ objectFit: 'contain', height: 'auto', maxHeight: '56px', width: 'auto' }}
              />
            </div>

            {/* Badge "Portal Oficial do Cidadão" com Realce Neon */}
            <span 
              className="badge px-3 py-2 rounded-pill fw-semibold d-inline-flex align-items-center gap-1.5 shadow-sm"
              style={{
                backgroundColor: 'rgba(3, 140, 51, 0.22)',
                color: '#0DF205',
                border: '1px solid rgba(13, 242, 5, 0.45)',
                fontSize: '12px',
                letterSpacing: '0.02em'
              }}
            >
              <i className="bi bi-shield-check fs-6 text-warning" style={{ color: '#F2CB05' }}></i>
              <span>Portal Oficial do Cidadão</span>
            </span>
          </div>

          {/* Hero Content Section */}
          <div className="py-2">
            
            {/* Tag de Localidade / Posto Municipal */}
            <div className="d-flex align-items-center gap-2 mb-3">
              <span 
                className="badge px-2.5 py-1.5 rounded-pill fw-semibold d-inline-flex align-items-center gap-1"
                style={{
                  backgroundColor: 'rgba(242, 203, 5, 0.12)',
                  color: '#F2CB05',
                  border: '1px solid rgba(242, 203, 5, 0.3)',
                  fontSize: '11.5px',
                  letterSpacing: '0.04em'
                }}
              >
                <i className="bi bi-geo-alt-fill"></i>
                POSTO MUNICIPAL DE IDENTIFICAÇÃO CIVIL
              </span>
            </div>

            {/* Main Title */}
            <h1 
              className="display-6 fw-bold mb-3 text-white" 
              style={{ 
                letterSpacing: '-0.025em',
                lineHeight: '1.2' 
              }}
            >
              Sistema de Agendamento de RG
            </h1>

            {/* Description Text with WCAG AA Legibility */}
            <p 
              className="fs-5 mb-4 col-lg-11" 
              style={{ 
                color: '#CBD5E1', 
                lineHeight: '1.65',
                fontSize: '17px' 
              }}
            >
              Bem-vindo ao sistema online para agendamento de emissão da sua Carteira de Identidade Nacional (CIN / RG). 
              Realize seu agendamento de forma rápida e segura para atendimento no posto municipal.
            </p>

            {/* CTA Principal de Agendamento */}
            <div className="pt-2 d-flex flex-wrap gap-3 align-items-center">
              <Link 
                href="/agendamento" 
                className="btn btn-lg px-4 py-3 fw-bold d-inline-flex align-items-center gap-2 text-decoration-none transition-all shadow-lg rounded-3"
                style={{
                  background: 'linear-gradient(135deg, #038C33 0%, #0DF205 100%)',
                  color: '#0D0D0D',
                  border: 'none',
                  fontSize: '15.5px',
                  letterSpacing: '0.01em',
                  boxShadow: '0 4px 20px rgba(13, 242, 5, 0.35), 0 2px 6px rgba(0, 0, 0, 0.4)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 6px 28px rgba(13, 242, 5, 0.55), 0 4px 12px rgba(0, 0, 0, 0.5)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(13, 242, 5, 0.35), 0 2px 6px rgba(0, 0, 0, 0.4)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <i className="bi bi-calendar-check fs-5" style={{ color: '#0D0D0D' }}></i>
                <span>Agendar Atendimento</span>
                <i className="bi bi-arrow-right ms-1" style={{ color: '#0D0D0D' }}></i>
              </Link>
            </div>

          </div>
        </div>
        
        {/* Card Footer Institucional */}
        <Footer theme="dark" />
      </div>
    </main>
  );
}
