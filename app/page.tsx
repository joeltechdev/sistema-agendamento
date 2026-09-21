'use client'

import Link from 'next/link'
import Image from 'next/image'
import Footer from '@/components/layout/Footer'

export default function Home() {
  return (
    <main 
      className="min-vh-100 d-flex align-items-center justify-content-center p-2 p-sm-3 p-md-4 position-relative overflow-hidden"
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
        className="card border-0 rounded-4 overflow-hidden w-100 position-relative shadow-2xl my-2" 
        style={{ 
          maxWidth: '880px', 
          backgroundColor: '#121A15',
          border: '1px solid rgba(13, 242, 5, 0.22)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 40px rgba(13, 242, 5, 0.06)',
          zIndex: 1
        }}
      >
        <div className="card-body p-3 p-sm-4 p-md-5">
          
          {/* Top Logo & Institutional Badge */}
          <div 
            className="mb-4 pb-4 d-flex flex-column flex-sm-row align-items-center justify-content-between text-center text-sm-start gap-3"
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
                style={{ objectFit: 'contain', height: 'auto', maxHeight: '52px', width: 'auto' }}
              />
            </div>

            {/* Badge e Acesso Servidor / Acompanhamento */}
            <div className="d-flex align-items-center justify-content-center justify-content-sm-end gap-2 flex-wrap w-100 w-sm-auto">
              <span 
                className="badge px-3 py-2 rounded-pill fw-semibold d-inline-flex align-items-center gap-1.5 shadow-sm"
                style={{
                  backgroundColor: 'rgba(3, 140, 51, 0.22)',
                  color: '#0DF205',
                  border: '1px solid rgba(13, 242, 5, 0.45)',
                  fontSize: '11.5px',
                  letterSpacing: '0.02em'
                }}
              >
                <i className="bi bi-shield-check fs-6 text-warning" style={{ color: '#F2CB05' }}></i>
                <span>Portal Oficial do Cidadão</span>
              </span>

              <Link
                href="/login"
                className="btn btn-sm px-3 py-1.5 rounded-pill fw-semibold d-inline-flex align-items-center gap-1 text-decoration-none transition-all touch-target-min"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.07)',
                  color: '#E2E8F0',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  fontSize: '12px'
                }}
              >
                <i className="bi bi-person-fill-lock text-warning"></i>
                <span>Acesso Servidor / Painel</span>
              </Link>
            </div>
          </div>

          {/* Hero Content Section */}
          <div className="py-2">
            
            {/* Tag de Localidade / Posto Municipal */}
            <div className="d-flex align-items-center justify-content-center justify-content-sm-start gap-2 mb-3">
              <span 
                className="badge px-2.5 py-1.5 rounded-pill fw-semibold d-inline-flex align-items-center gap-1"
                style={{
                  backgroundColor: 'rgba(242, 203, 5, 0.12)',
                  color: '#F2CB05',
                  border: '1px solid rgba(242, 203, 5, 0.3)',
                  fontSize: '11px',
                  letterSpacing: '0.04em'
                }}
              >
                <i className="bi bi-geo-alt-fill"></i>
                POSTO MUNICIPAL DE IDENTIFICAÇÃO CIVIL
              </span>
            </div>

            {/* Main Title */}
            <h1 
              className="fw-bold mb-3 text-white text-center text-sm-start" 
              style={{ 
                letterSpacing: '-0.025em',
                lineHeight: '1.25',
                fontSize: 'clamp(1.5rem, 4vw, 2.3rem)'
              }}
            >
              Sistema de Agendamento de RG
            </h1>

            {/* Description Text with WCAG AA Legibility */}
            <p 
              className="mb-4 col-lg-11 text-center text-sm-start" 
              style={{ 
                color: '#CBD5E1', 
                lineHeight: '1.65',
                fontSize: 'clamp(0.95rem, 2.5vw, 1.05rem)' 
              }}
            >
              Bem-vindo ao sistema online para agendamento de emissão da sua Carteira de Identidade Nacional (CIN / RG). 
              Realize seu agendamento de forma rápida e segura para atendimento no posto municipal.
            </p>

            {/* CTA Principal de Agendamento e Acompanhamento */}
            <div className="pt-2 d-flex flex-column flex-sm-row flex-wrap gap-2 gap-sm-3 align-items-stretch align-items-sm-center">
              <Link 
                href="/agendamento" 
                className="btn btn-lg px-4 py-3 fw-bold d-inline-flex align-items-center justify-content-center gap-2 text-decoration-none transition-all shadow-lg rounded-3 w-100 w-sm-auto touch-target-min"
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

              {/* Botão Acompanhamento e Gestão de Agendamentos */}
              <Link 
                href="/admin/agendamentos" 
                className="btn btn-lg px-4 py-3 fw-semibold d-inline-flex align-items-center justify-content-center gap-2 text-decoration-none transition-all rounded-3 w-100 w-sm-auto touch-target-min"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#F8FAFC',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  fontSize: '15px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)'
                }}
              >
                <i className="bi bi-card-checklist fs-5 text-warning"></i>
                <span>Acompanhar Agendamentos</span>
              </Link>

              {/* Documentos Necessários */}
              <Link 
                href="/orientacoes" 
                className="btn btn-lg px-3 py-3 fw-medium d-inline-flex align-items-center justify-content-center gap-2 text-decoration-none transition-all rounded-3 w-100 w-sm-auto touch-target-min"
                style={{
                  backgroundColor: 'transparent',
                  color: '#94A3B8',
                  fontSize: '14.5px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#38BDF8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94A3B8'
                }}
              >
                <i className="bi bi-file-earmark-text"></i>
                <span>Documentação Necessária</span>
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
