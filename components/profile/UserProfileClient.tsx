'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { logout, deleteMyAccount } from '@/app/actions/auth'
import AppointmentCard from '@/components/ui/AppointmentCard'

interface Props {
  user: {
    id: string
    email: string
    full_name: string
    role: string
    cpf?: string
  }
  appointments: any[]
  secondIssueWarning?: string
}

export default function UserProfileClient({
  user,
  appointments,
  secondIssueWarning
}: Props) {
  const router = useRouter()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const initials = (user.full_name || user.email || 'AD')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()

  const isStaff = user.role === 'admin' || user.role === 'manager' || user.role === 'atendente'

  const handleDeleteAccount = () => {
    if (confirmText.trim().toUpperCase() !== 'EXCLUIR') {
      setErrorMessage('Digite a palavra EXCLUIR para confirmar a exclusão da sua conta.')
      return
    }

    setErrorMessage(null)
    startTransition(async () => {
      try {
        const result = await deleteMyAccount(passwordConfirm || undefined)
        if (result.error) {
          setErrorMessage(result.error)
        } else {
          setIsDeleteModalOpen(false)
          router.push('/login?deleted=true')
          router.refresh()
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Erro inesperado ao excluir conta. Tente novamente.')
      }
    })
  }

  return (
    <main className="container py-4 py-lg-5" style={{ maxWidth: '960px' }}>
      {/* 1. Header do Perfil */}
      <div 
        className="card shadow-sm mb-4 border-0 rounded-4 overflow-hidden" 
        style={{ 
          backgroundColor: '#111827', 
          color: '#FFFFFF', 
          border: '1px solid rgba(255,255,255,0.1)' 
        }}
      >
        <div 
          className="card-header d-flex justify-content-between align-items-center py-3 px-4" 
          style={{ 
            backgroundColor: '#06170E', 
            borderBottom: '1px solid rgba(74, 222, 128, 0.2)' 
          }}
        >
          <div className="d-flex align-items-center gap-2">
            {isStaff ? (
              <Link 
                href="/admin" 
                className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1.5 text-white border-success"
                style={{ fontSize: '13px' }}
              >
                <i className="bi bi-arrow-left"></i>
                <span>Voltar ao Painel</span>
              </Link>
            ) : (
              <Link 
                href="/agendamento" 
                className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1.5 text-white border-success"
                style={{ fontSize: '13px' }}
              >
                <i className="bi bi-calendar-plus"></i>
                <span>Agendar Atendimento</span>
              </Link>
            )}
            <h1 className="h5 mb-0 ms-2 text-white d-flex align-items-center">
              <i className="bi bi-person-circle me-2 text-success"></i> 
              Meu Perfil
            </h1>
          </div>

          <form action={logout} className="m-0">
            <button 
              type="submit" 
              className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1.5"
              style={{ fontSize: '13px' }}
            >
              <i className="bi bi-box-arrow-right"></i>
              <span>Sair</span>
            </button>
          </form>
        </div>

        <div className="card-body p-4">
          {/* Avatar & Identificação Principal */}
          <div className="d-flex align-items-center gap-3 mb-4">
            <div 
              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm flex-shrink-0"
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: '#166534',
                border: '2px solid #4ADE80',
                fontSize: '22px'
              }}
            >
              {initials || 'AD'}
            </div>
            <div>
              <h2 className="h4 fw-bold mb-0 text-white">{user.full_name}</h2>
              <div className="text-success small fw-medium mt-0.5">
                {user.role === 'admin' 
                  ? 'Administrador Geral' 
                  : user.role === 'manager' 
                    ? 'Supervisor de Atendimento' 
                    : user.role === 'atendente' 
                      ? 'Atendente de Guichê' 
                      : 'Cidadão'}
              </div>
            </div>
          </div>
          
          {/* Grid de Dados Pessoais */}
          <div className="row g-3 mb-4 p-3 rounded-3" style={{ backgroundColor: '#1E293B' }}>
            <div className="col-sm-6 col-md-4">
              <div className="small text-muted mb-1" style={{ fontSize: '12px' }}>E-mail de Acesso</div>
              <div className="fw-semibold text-white text-break" style={{ fontSize: '13.5px' }}>{user.email}</div>
            </div>
            <div className="col-sm-6 col-md-4">
              <div className="small text-muted mb-1" style={{ fontSize: '12px' }}>CPF Cadastrado</div>
              <div className="fw-semibold text-white" style={{ fontSize: '13.5px' }}>{user.cpf || 'Não cadastrado'}</div>
            </div>
            <div className="col-sm-6 col-md-4">
              <div className="small text-muted mb-1" style={{ fontSize: '12px' }}>Nível de Permissão</div>
              <span className={`badge ${user.role === 'admin' ? 'bg-danger' : 'bg-success'} px-2.5 py-1`} style={{ fontSize: '12px' }}>
                {user.role === 'admin' ? 'Administrador' : user.role === 'atendente' ? 'Atendente' : 'Cidadão'}
              </span>
            </div>
          </div>

          {/* Banner Operacional */}
          {/* Ações Administrativas para Equipe e Operadores */}
          {isStaff && (
            <div className="mt-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h3 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-grid-fill text-success"></i>
                  <span>Atalhos Administrativos do Sistema</span>
                </h3>
                <Link href="/admin" className="btn btn-sm btn-success fw-semibold px-3" style={{ fontSize: '12px' }}>
                  Ir para o Painel Geral
                </Link>
              </div>

              <div className="row g-2">
                <div className="col-sm-6 col-md-4">
                  <Link 
                    href="/admin/agendamentos" 
                    className="p-3 rounded-3 text-decoration-none text-white d-block border h-100" 
                    style={{ backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.08)', transition: 'all 0.15s ease' }}
                  >
                    <div className="d-flex align-items-center gap-2.5">
                      <i className="bi bi-calendar2-check fs-4 text-success"></i>
                      <div>
                        <div className="fw-bold" style={{ fontSize: '13px' }}>Agendamentos</div>
                        <div className="text-white-50" style={{ fontSize: '11px' }}>Atendimentos do dia</div>
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="col-sm-6 col-md-4">
                  <Link 
                    href="/admin/administradores" 
                    className="p-3 rounded-3 text-decoration-none text-white d-block border h-100" 
                    style={{ backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.08)', transition: 'all 0.15s ease' }}
                  >
                    <div className="d-flex align-items-center gap-2.5">
                      <i className="bi bi-shield-lock fs-4 text-primary"></i>
                      <div>
                        <div className="fw-bold" style={{ fontSize: '13px' }}>Administradores</div>
                        <div className="text-white-50" style={{ fontSize: '11px' }}>Gestão de operadores</div>
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="col-sm-6 col-md-4">
                  <Link 
                    href="/admin/configuracoes" 
                    className="p-3 rounded-3 text-decoration-none text-white d-block border h-100" 
                    style={{ backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.08)', transition: 'all 0.15s ease' }}
                  >
                    <div className="d-flex align-items-center gap-2.5">
                      <i className="bi bi-gear fs-4 text-warning"></i>
                      <div>
                        <div className="fw-bold" style={{ fontSize: '13px' }}>Configurações</div>
                        <div className="text-white-50" style={{ fontSize: '11px' }}>Vagas e horários</div>
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="col-sm-6 col-md-4">
                  <Link 
                    href="/admin/cidadaos" 
                    className="p-3 rounded-3 text-decoration-none text-white d-block border h-100" 
                    style={{ backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.08)', transition: 'all 0.15s ease' }}
                  >
                    <div className="d-flex align-items-center gap-2.5">
                      <i className="bi bi-people fs-4 text-info"></i>
                      <div>
                        <div className="fw-bold" style={{ fontSize: '13px' }}>Cidadãos</div>
                        <div className="text-white-50" style={{ fontSize: '11px' }}>Base de cadastros</div>
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="col-sm-6 col-md-4">
                  <Link 
                    href="/admin/relatorios" 
                    className="p-3 rounded-3 text-decoration-none text-white d-block border h-100" 
                    style={{ backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.08)', transition: 'all 0.15s ease' }}
                  >
                    <div className="d-flex align-items-center gap-2.5">
                      <i className="bi bi-bar-chart-line fs-4 text-success"></i>
                      <div>
                        <div className="fw-bold" style={{ fontSize: '13px' }}>Relatórios</div>
                        <div className="text-white-50" style={{ fontSize: '11px' }}>Métricas e impressão</div>
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="col-sm-6 col-md-4">
                  <Link 
                    href="/admin" 
                    className="p-3 rounded-3 text-decoration-none text-white d-block border h-100" 
                    style={{ backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.08)', transition: 'all 0.15s ease' }}
                  >
                    <div className="d-flex align-items-center gap-2.5">
                      <i className="bi bi-speedometer2 fs-4 text-light"></i>
                      <div>
                        <div className="fw-bold" style={{ fontSize: '13px' }}>Painel Geral</div>
                        <div className="text-white-50" style={{ fontSize: '11px' }}>Visão em tempo real</div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ⚠️ ZONA DE PERIGO: EXCLUIR CONTA */}
          <div 
            className="p-3.5 p-sm-4 rounded-3 border mt-4" 
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.04)', 
              borderColor: 'rgba(239, 68, 68, 0.25)' 
            }}
          >
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
              <div>
                <div className="d-flex align-items-center gap-2 text-danger fw-bold mb-1" style={{ fontSize: '14px' }}>
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <span>Zona de Perigo &bull; Excluir Conta</span>
                </div>
                <p className="mb-0 text-white-50 small" style={{ fontSize: '12px', maxWidth: '580px' }}>
                  Caso deseje encerrar seu acesso permanentemente, você pode excluir sua conta. Todos os seus dados de operador serão desvinculados do sistema. Esta ação não poderá ser desfeita.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null)
                  setConfirmText('')
                  setPasswordConfirm('')
                  setIsDeleteModalOpen(true)
                }}
                className="btn btn-outline-danger d-inline-flex align-items-center justify-content-center gap-2 fw-semibold px-3 py-2 flex-shrink-0 text-nowrap"
                style={{ fontSize: '13px', borderRadius: '8px' }}
              >
                <i className="bi bi-trash3-fill"></i>
                <span>Excluir Minha Conta</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Meus Agendamentos (Exclusivo para Cidadãos) */}
      {!isStaff && (
        <div className="mt-5">
          <h3 className="h4 fw-bold text-white mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-calendar-check text-success"></i>
            <span>Meus Agendamentos</span>
          </h3>
          
          {appointments.length === 0 ? (
            <div 
              className="text-center p-5 rounded-4 border border-dashed" 
              style={{ 
                backgroundColor: '#111827', 
                borderColor: 'rgba(255,255,255,0.15)',
                color: '#94A3B8'
              }}
            >
              <i className="bi bi-calendar-x display-4 d-block mb-3 opacity-50 text-white"></i>
              <p className="mb-3 text-white-50">Você não possui agendamentos ativos no momento.</p>
              <Link href="/agendamento" className="btn btn-success fw-semibold px-4 py-2">
                <i className="bi bi-plus-lg me-1.5"></i>
                <span>Fazer Novo Agendamento</span>
              </Link>
            </div>
          ) : (
            <div>
              <div className="mb-3 d-flex justify-content-end">
                <Link href="/agendamento" className="btn btn-sm btn-success fw-semibold px-3 py-1.5">
                  <i className="bi bi-plus-lg me-1"></i>
                  <span>Novo Agendamento</span>
                </Link>
              </div>
              <div className="row g-3">
                {appointments.map(app => (
                  <div className="col-md-6" key={app.id}>
                    <AppointmentCard 
                      appointment={app} 
                      isSecondIssueWarning={secondIssueWarning || null} 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CONTA */}
      {isDeleteModalOpen && (
        <div 
          className="modal fade show d-block" 
          tabIndex={-1} 
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '460px' }}>
            <div 
              className="modal-content border-0 text-white rounded-4 shadow-lg" 
              style={{ backgroundColor: '#111827', border: '1px solid rgba(239, 68, 68, 0.4)' }}
            >
              <div className="modal-header border-0 pb-0 pt-4 px-4">
                <div className="d-flex align-items-center gap-2.5 text-danger">
                  <div 
                    className="rounded-circle d-flex align-items-center justify-content-center bg-danger-subtle text-danger"
                    style={{ width: '40px', height: '40px' }}
                  >
                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                  </div>
                  <h5 className="modal-title fw-bold text-white mb-0" style={{ fontSize: '17px' }}>
                    Excluir Minha Conta
                  </h5>
                </div>
                <button 
                  type="button" 
                  className="btn-close btn-close-white shadow-none" 
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isPending}
                ></button>
              </div>

              <div className="modal-body px-4 py-3">
                <p className="text-white-50 small mb-3" style={{ fontSize: '13px', lineHeight: '1.5' }}>
                  Você está prestes a excluir permanentemente a conta <strong className="text-white">{user.email}</strong>. Esta ação é irreversível e encerrará seu acesso imediatamente.
                </p>

                {errorMessage && (
                  <div 
                    className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3 border-0 rounded-3"
                    style={{ backgroundColor: '#7F1D1D', color: '#FEE2E2' }}
                  >
                    <i className="bi bi-exclamation-circle-fill flex-shrink-0"></i>
                    <div>{errorMessage}</div>
                  </div>
                )}

                <div className="mb-3">
                  <label 
                    htmlFor="confirmText" 
                    className="form-label small fw-semibold text-white-50 mb-1" 
                    style={{ fontSize: '12px' }}
                  >
                    Para confirmar, digite a palavra <span className="text-danger fw-bold">EXCLUIR</span> abaixo:
                  </label>
                  <input
                    type="text"
                    id="confirmText"
                    className="form-control border-0 text-white shadow-none"
                    placeholder="EXCLUIR"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    disabled={isPending}
                    autoFocus
                    style={{ backgroundColor: '#1E293B', fontSize: '13.5px' }}
                  />
                </div>
              </div>

              <div className="modal-footer border-0 pt-0 pb-4 px-4 d-flex justify-content-end gap-2">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary text-white border-secondary fw-semibold px-3"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isPending}
                  style={{ fontSize: '13px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger fw-semibold px-3.5 d-flex align-items-center gap-1.5 shadow"
                  onClick={handleDeleteAccount}
                  disabled={isPending || confirmText.trim().toUpperCase() !== 'EXCLUIR'}
                  style={{ fontSize: '13px' }}
                >
                  {isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash3-fill"></i>
                      <span>Sim, Excluir Minha Conta</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
