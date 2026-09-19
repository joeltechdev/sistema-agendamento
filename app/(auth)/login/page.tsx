'use client'

import { useActionState, Suspense } from 'react'
import { login } from '@/app/actions/auth'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const [state, action, isPending] = useActionState(login, undefined as { error?: string; success?: string } | undefined)
  const searchParams = useSearchParams()
  const prefillEmail = searchParams?.get('email') || ''

  return (
    <>
      {/* Error Alert */}
      {state?.error && (
        <div 
          className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-4 rounded-3 border-0"
          role="alert"
          style={{ backgroundColor: '#7F1D1D', color: '#FEE2E2' }}
        >
          <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
          <div>{state.error}</div>
        </div>
      )}

      {/* Login Form */}
      <form action={action} className="d-flex flex-column gap-3">
        <div>
          <label 
            htmlFor="email" 
            className="form-label small fw-semibold mb-1" 
            style={{ color: '#CBD5E1', fontSize: '12.5px' }}
          >
            Usuário ou E-mail
          </label>
          <div className="input-group">
            <span 
              className="input-group-text border-0" 
              style={{ backgroundColor: '#1E293B', color: '#94A3B8' }}
            >
              <i className="bi bi-person-fill"></i>
            </span>
            <input 
              type="email" 
              className="form-control border-0 text-white shadow-none" 
              id="email" 
              name="email" 
              placeholder="seu.email@exemplo.com" 
              defaultValue={prefillEmail}
              autoComplete="email"
              required 
              style={{ backgroundColor: '#1E293B', fontSize: '13.5px' }}
            />
          </div>
        </div>

        <div>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label 
              htmlFor="password" 
              className="form-label small fw-semibold mb-0" 
              style={{ color: '#CBD5E1', fontSize: '12.5px' }}
            >
              Senha
            </label>
            <Link 
              href="/recuperar-senha" 
              className="text-decoration-none"
              style={{ color: '#60A5FA', fontSize: '12px' }}
            >
              Esqueci minha senha
            </Link>
          </div>
          <div className="input-group">
            <span 
              className="input-group-text border-0" 
              style={{ backgroundColor: '#1E293B', color: '#94A3B8' }}
            >
              <i className="bi bi-key-fill"></i>
            </span>
            <input 
              type="password" 
              className="form-control border-0 text-white shadow-none" 
              id="password" 
              name="password" 
              placeholder="Digite sua senha" 
              autoComplete="current-password"
              required 
              style={{ backgroundColor: '#1E293B', fontSize: '13.5px' }}
            />
          </div>
        </div>

        <button 
          className="btn btn-primary w-100 py-2 fw-semibold mt-2 rounded-3 shadow d-flex align-items-center justify-content-center gap-2" 
          type="submit" 
          disabled={isPending}
          style={{
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            border: 'none',
            fontSize: '14px'
          }}
        >
          {isPending ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <span>Acessando...</span>
            </>
          ) : (
            <>
              <i className="bi bi-box-arrow-in-right"></i>
              <span>Entrar no Sistema</span>
            </>
          )}
        </button>
      </form>
    </>
  )
}

export default function LoginPage() {
  return (
    <div 
      className="min-vh-100 d-flex align-items-center justify-content-center p-3"
      style={{
        background: 'linear-gradient(135deg, #0B1220 0%, #0F172A 50%, #1E293B 100%)',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}
    >
      <div 
        className="w-100 p-4 p-sm-5 rounded-4 shadow-lg text-white"
        style={{ 
          maxWidth: '440px',
          backgroundColor: '#111827',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Brand Header */}
        <div className="text-center mb-4">
          <div 
            className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 shadow"
            style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              color: '#FFFFFF'
            }}
          >
            <i className="bi bi-shield-lock-fill fs-3"></i>
          </div>
          <h1 className="h4 fw-bold mb-1 text-white">Identificação Civil</h1>
          <p className="small mb-0" style={{ color: '#94A3B8' }}>
            Acesso ao Painel de Atendimento e Gestão
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-muted small py-3"><span className="spinner-border spinner-border-sm me-2"></span>Carregando...</div>}>
          <LoginForm />
        </Suspense>

        {/* Link para Criar Conta */}
        <div className="text-center mt-3">
          <span style={{ fontSize: '13px', color: '#94A3B8' }}>Não tem uma conta? </span>
          <Link 
            href="/cadastro" 
            className="text-decoration-none fw-semibold"
            style={{ color: '#60A5FA', fontSize: '13px' }}
          >
            Criar conta
          </Link>
        </div>

        {/* Footer Institucional com Contraste Adequado */}
        <div className="text-center mt-4 pt-3 border-top" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <span style={{ fontSize: '12px', color: '#94A3B8', letterSpacing: '0.2px' }}>
            Sistema de Agendamento Municipal &bull; Versão 2.4
          </span>
        </div>
      </div>
    </div>
  )
}
