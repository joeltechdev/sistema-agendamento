'use client'

import { useActionState, use } from 'react'
import { requestPasswordReset, executePasswordReset } from '@/app/actions/auth'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { Suspense } from 'react'

function RecoverPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const emailParam = searchParams.get('email') || ''

  const isResetStep = Boolean(token)

  // Step 1: Solicitar link (quando não tem token)
  const [requestState, requestAction, isRequestPending] = useActionState(
    requestPasswordReset, 
    undefined as { error?: string; success?: string } | undefined
  )

  // Step 2: Redefinir senha (quando tem token na URL)
  const [resetState, resetAction, isResetPending] = useActionState(
    executePasswordReset, 
    undefined as { error?: string; success?: string } | undefined
  )

  const state = isResetStep ? resetState : requestState
  const isPending = isResetStep ? isResetPending : isRequestPending
  const formAction = isResetStep ? resetAction : requestAction

  return (
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
            background: isResetStep 
              ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' 
              : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            color: '#FFFFFF'
          }}
        >
          <i className={`bi ${isResetStep ? 'bi-shield-lock-fill' : 'bi-key-fill'} fs-3`}></i>
        </div>
        <h1 className="h4 fw-bold mb-1 text-white">
          {isResetStep ? 'Redefinir Senha' : 'Recuperar Senha'}
        </h1>
        <p className="small mb-0" style={{ color: '#94A3B8' }}>
          {isResetStep 
            ? 'Digite sua nova senha de acesso' 
            : 'Enviaremos um link de redefinição para seu e-mail'}
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

      {/* Success Alert */}
      {state?.success && (
        <div 
          className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-4 rounded-3 border-0"
          role="alert"
          style={{ backgroundColor: '#064E3B', color: '#D1FAE5' }}
        >
          <i className="bi bi-check-circle-fill flex-shrink-0"></i>
          <div>{state.success}</div>
        </div>
      )}

      {/* Forms */}
      {!state?.success && (
        <form action={formAction} className="d-flex flex-column gap-3">
          {isResetStep ? (
            // Passo 2: Digitar nova senha com token
            <>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="email" value={emailParam} />

              <div>
                <label 
                  htmlFor="password" 
                  className="form-label small fw-semibold mb-1" 
                  style={{ color: '#CBD5E1', fontSize: '12.5px' }}
                >
                  Nova Senha (mín. 8 caracteres, maiúscula, minúscula, número/símbolo)
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
                    placeholder="Nova senha segura" 
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
                  Confirmar Nova Senha
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
                    placeholder="Repita a nova senha" 
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
                    <span>Salvando nova senha...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    <span>Salvar Nova Senha</span>
                  </>
                )}
              </button>
            </>
          ) : (
            // Passo 1: Solicitar link de redefinição
            <>
              <div>
                <label 
                  htmlFor="email" 
                  className="form-label small fw-semibold mb-1" 
                  style={{ color: '#CBD5E1', fontSize: '12.5px' }}
                >
                  E-mail cadastrado
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
                    placeholder="seu.email@prefeitura.gov.br" 
                    required 
                    style={{ backgroundColor: '#1E293B', fontSize: '13.5px' }}
                  />
                </div>
              </div>

              <button 
                className="btn btn-warning w-100 py-2 fw-semibold mt-2 rounded-3 shadow d-flex align-items-center justify-content-center gap-2" 
                type="submit" 
                disabled={isPending}
                style={{
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  color: '#000000',
                  border: 'none',
                  fontSize: '14px'
                }}
              >
                {isPending ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span>Enviando link...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-send-fill"></i>
                    <span>Enviar Link de Recuperação</span>
                  </>
                )}
              </button>
            </>
          )}
        </form>
      )}

      {/* Voltar ao Login */}
      <div className="text-center mt-4">
        <Link 
          href="/login" 
          className="text-decoration-none fw-semibold"
          style={{ color: '#60A5FA', fontSize: '13px' }}
        >
          &larr; Voltar para o Login
        </Link>
      </div>

      {/* Footer Institucional */}
      <div className="text-center mt-4 pt-3 border-top" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
        <span style={{ fontSize: '12px', color: '#94A3B8', letterSpacing: '0.2px' }}>
          Sistema de Agendamento Municipal &bull; Versão 2.4
        </span>
      </div>
    </div>
  )
}

export default function RecoverPasswordPage() {
  return (
    <div 
      className="min-vh-100 d-flex align-items-center justify-content-center p-3"
      style={{
        background: 'linear-gradient(135deg, #0B1220 0%, #0F172A 50%, #1E293B 100%)',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}
    >
      <Suspense fallback={<div className="text-white small">Carregando...</div>}>
        <RecoverPasswordForm />
      </Suspense>
    </div>
  )
}
