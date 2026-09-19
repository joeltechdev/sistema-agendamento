'use client'

import { useActionState } from 'react'
import { registerUser } from '@/app/actions/auth'
import Link from 'next/link'

export default function RegisterPage() {
  const [state, action, isPending] = useActionState(registerUser, undefined as { error?: string; success?: string } | undefined)

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
          maxWidth: '460px',
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
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF'
            }}
          >
            <i className="bi bi-person-plus-fill fs-3"></i>
          </div>
          <h1 className="h4 fw-bold mb-1 text-white">Criar Nova Conta</h1>
          <p className="small mb-0" style={{ color: '#94A3B8' }}>
            Cadastro de Acesso &bull; Identificação Civil
          </p>
        </div>

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

        {/* Register Form */}
        <form action={action} className="d-flex flex-column gap-3">
          <div>
            <label 
              htmlFor="name" 
              className="form-label small fw-semibold mb-1" 
              style={{ color: '#CBD5E1', fontSize: '12.5px' }}
            >
              Nome Completo
            </label>
            <div className="input-group">
              <span 
                className="input-group-text border-0" 
                style={{ backgroundColor: '#1E293B', color: '#94A3B8' }}
              >
                <i className="bi bi-person-badge"></i>
              </span>
              <input 
                type="text" 
                className="form-control border-0 text-white shadow-none" 
                id="name" 
                name="name" 
                placeholder="Ex: João da Silva Santos" 
                required 
                minLength={3}
                style={{ backgroundColor: '#1E293B', fontSize: '13.5px' }}
              />
            </div>
          </div>

          <div>
            <label 
              htmlFor="email" 
              className="form-label small fw-semibold mb-1" 
              style={{ color: '#CBD5E1', fontSize: '12.5px' }}
            >
              E-mail Institucional ou Pessoal
            </label>
            <div className="input-group">
              <span 
                className="input-group-text border-0" 
                style={{ backgroundColor: '#1E293B', color: '#94A3B8' }}
              >
                <i className="bi bi-envelope-fill"></i>
              </span>
              <input 
                type="email" 
                className="form-control border-0 text-white shadow-none" 
                id="email" 
                name="email" 
                placeholder="nome@prefeitura.gov.br" 
                required 
                style={{ backgroundColor: '#1E293B', fontSize: '13.5px' }}
              />
            </div>
          </div>

          <div>
            <label 
              htmlFor="password" 
              className="form-label small fw-semibold mb-1" 
              style={{ color: '#CBD5E1', fontSize: '12.5px' }}
            >
              Senha (mín. 8 caracteres, com maiúscula, minúscula e número/símbolo)
            </label>
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
                placeholder="••••••••" 
                required 
                minLength={8}
                style={{ backgroundColor: '#1E293B', fontSize: '13.5px' }}
              />
            </div>
          </div>

          <div>
            <label 
              htmlFor="confirmPassword" 
              className="form-label small fw-semibold mb-1" 
              style={{ color: '#CBD5E1', fontSize: '12.5px' }}
            >
              Confirmar Senha
            </label>
            <div className="input-group">
              <span 
                className="input-group-text border-0" 
                style={{ backgroundColor: '#1E293B', color: '#94A3B8' }}
              >
                <i className="bi bi-shield-check"></i>
              </span>
              <input 
                type="password" 
                className="form-control border-0 text-white shadow-none" 
                id="confirmPassword" 
                name="confirmPassword" 
                placeholder="••••••••" 
                required 
                minLength={8}
                style={{ backgroundColor: '#1E293B', fontSize: '13.5px' }}
              />
            </div>
          </div>

          <button 
            className="btn btn-success w-100 py-2 fw-semibold mt-2 rounded-3 shadow d-flex align-items-center justify-content-center gap-2" 
            type="submit" 
            disabled={isPending}
            style={{
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              border: 'none',
              fontSize: '14px'
            }}
          >
            {isPending ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span>Cadastrando...</span>
              </>
            ) : (
              <>
                <i className="bi bi-check-circle-fill"></i>
                <span>Finalizar Cadastro</span>
              </>
            )}
          </button>
        </form>

        {/* Link para Login */}
        <div className="text-center mt-3">
          <span style={{ fontSize: '13px', color: '#94A3B8' }}>Já possui uma conta? </span>
          <Link 
            href="/login" 
            className="text-decoration-none fw-semibold"
            style={{ color: '#60A5FA', fontSize: '13px' }}
          >
            Entrar no Sistema
          </Link>
        </div>

        {/* Footer Institucional */}
        <div className="text-center mt-4 pt-3 border-top" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <span style={{ fontSize: '12px', color: '#94A3B8', letterSpacing: '0.2px' }}>
            Sistema de Agendamento Municipal &bull; Versão 2.4
          </span>
        </div>
      </div>
    </div>
  )
}
