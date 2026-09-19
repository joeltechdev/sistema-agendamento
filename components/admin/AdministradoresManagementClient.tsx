'use client'

import React, { useState, useMemo, useTransition } from 'react'
import { 
  adminCreateUser, 
  adminUpdateUser, 
  adminToggleUserStatus, 
  adminResetUserPassword, 
  adminDeleteUser 
} from '@/app/actions/admin'

export interface AdminUser {
  id: string
  full_name: string
  email: string
  role: string
  phone?: string
  status: 'active' | 'inactive'
  created_at: string
}

interface KPIStats {
  total: number
  admins: number
  attendants: number
  active: number
  inactive: number
}

interface Props {
  initialUsers: AdminUser[]
  initialKPI: KPIStats
  currentAdminId?: string
  currentAdminEmail?: string
}

function getInitials(name?: string): string {
  if (!name) return 'AD'
  const clean = name.replace(/^(Dr\.|Dra\.|Sr\.|Sra\.)\s+/i, '').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'AD'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function AdministradoresManagementClient({
  initialUsers,
  initialKPI,
  currentAdminId,
  currentAdminEmail
}: Props) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [passwordResetUser, setPasswordResetUser] = useState<AdminUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null)

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'atendente',
    status: 'active'
  })
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'atendente',
    status: 'active'
  })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Filtered list
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = 
        !search ||
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.phone && u.phone.includes(search))

      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, search, roleFilter, statusFilter])

  // Calculated dynamic KPI
  const kpi = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      attendants: users.filter(u => u.role === 'atendente' || u.role === 'manager').length,
      active: users.filter(u => u.status === 'active').length,
      inactive: users.filter(u => u.status === 'inactive').length
    }
  }, [users])

  // Handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    const formData = new FormData()
    formData.set('name', createForm.name.trim())
    formData.set('email', createForm.email.trim().toLowerCase())
    formData.set('password', createForm.password)
    formData.set('phone', createForm.phone.trim())
    formData.set('role', createForm.role)
    formData.set('status', createForm.status)

    startTransition(async () => {
      try {
        const res = await adminCreateUser(formData)
        if (res.error) {
          setFeedback({ type: 'error', text: res.error })
        } else {
          setFeedback({ type: 'success', text: res.message || 'Usuário criado com sucesso!' })
          setIsCreateOpen(false)
          setCreateForm({ name: '', email: '', password: '', phone: '', role: 'atendente', status: 'active' })
          
          // Optimistic local add
          const optimisticUser: AdminUser = {
            id: `temp-${Date.now()}`,
            full_name: createForm.name.trim(),
            email: createForm.email.trim().toLowerCase(),
            role: createForm.role,
            phone: createForm.phone.trim() || '—',
            status: createForm.status as 'active' | 'inactive',
            created_at: new Date().toISOString()
          }
          setUsers(prev => [optimisticUser, ...prev])
        }
      } catch (err: any) {
        setFeedback({ type: 'error', text: err.message || 'Erro inesperado ao criar usuário.' })
      }
    })
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setFeedback(null)

    startTransition(async () => {
      try {
        const res = await adminUpdateUser(editingUser.id, {
          full_name: editForm.name.trim(),
          email: editForm.email.trim().toLowerCase(),
          phone: editForm.phone.trim(),
          role: editForm.role,
          status: editForm.status as 'active' | 'inactive'
        })

        if (res.error) {
          setFeedback({ type: 'error', text: res.error })
        } else {
          setFeedback({ type: 'success', text: res.message || 'Dados atualizados com sucesso!' })
          setUsers(prev => prev.map(u => u.id === editingUser.id ? {
            ...u,
            full_name: editForm.name.trim(),
            email: editForm.email.trim().toLowerCase(),
            phone: editForm.phone.trim() || '—',
            role: editForm.role,
            status: editForm.status as 'active' | 'inactive'
          } : u))
          setEditingUser(null)
        }
      } catch (err: any) {
        setFeedback({ type: 'error', text: err.message || 'Erro ao atualizar usuário.' })
      }
    })
  }

  const handleToggleStatus = async (user: AdminUser) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    setActionLoadingId(user.id)
    setFeedback(null)

    try {
      const res = await adminToggleUserStatus(user.id, newStatus)
      if (res.error) {
        setFeedback({ type: 'error', text: res.error })
      } else {
        setFeedback({ type: 'success', text: res.message || 'Status alterado com sucesso.' })
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u))
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao alterar status.' })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordResetUser) return
    setFeedback(null)

    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', text: 'As senhas digitadas não coincidem.' })
      return
    }

    startTransition(async () => {
      try {
        const res = await adminResetUserPassword(passwordResetUser.id, newPassword)
        if (res.error) {
          setFeedback({ type: 'error', text: res.error })
        } else {
          setFeedback({ type: 'success', text: res.message || 'Senha redefinida com sucesso!' })
          setPasswordResetUser(null)
          setNewPassword('')
          setConfirmPassword('')
        }
      } catch (err: any) {
        setFeedback({ type: 'error', text: err.message || 'Erro ao redefinir senha.' })
      }
    })
  }

  const handleDelete = async () => {
    if (!deletingUser) return
    setFeedback(null)
    setActionLoadingId(deletingUser.id)

    try {
      const res = await adminDeleteUser(deletingUser.id)
      if (res.error) {
        setFeedback({ type: 'error', text: res.error })
      } else {
        if ((res as any).isSelf) {
          window.location.href = '/login?deleted=true'
          return
        }
        setFeedback({ type: 'success', text: res.message || 'Usuário excluído com sucesso.' })
        setUsers(prev => prev.filter(u => u.id !== deletingUser.id))
        setDeletingUser(null)
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao excluir usuário.' })
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div style={{ color: '#E2E8F0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* 1. Header Section */}
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="fw-bold mb-1 text-white" style={{ fontSize: '22px', letterSpacing: '-0.02em' }}>
            Gestão de Administradores & Atendentes
          </h2>
          <p className="mb-0" style={{ color: '#94A3B8', fontSize: '13px' }}>
            Controle de acesso, credenciais e permissões da equipe do posto de identificação civil.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-sm rounded-3"
          onClick={() => {
            setFeedback(null)
            setIsCreateOpen(true)
          }}
        >
          <i className="bi bi-person-plus-fill"></i>
          Novo Administrador / Atendente
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div 
          className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-danger'} alert-dismissible fade show mb-4 shadow-sm`} 
          role="alert"
        >
          <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback(null)}></button>
        </div>
      )}

      {/* 2. Top KPI Metric Cards */}
      <div className="row g-3 mb-4">
        {/* Total Users */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div 
            className="p-3 rounded-4 d-flex align-items-center justify-content-between shadow-sm"
            style={{ backgroundColor: '#1E293B', border: '1px solid rgba(147, 197, 253, 0.25)', minHeight: '84px' }}
          >
            <div>
              <div className="fw-semibold" style={{ fontSize: '12px', color: '#93C5FD' }}>Total de Operadores</div>
              <div className="fw-bold" style={{ fontSize: '24px', color: '#60A5FA' }}>{kpi.total}</div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Cadastrados no sistema</div>
            </div>
            <div 
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '40px', height: '40px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', fontSize: '18px' }}
            >
              <i className="bi bi-people-fill"></i>
            </div>
          </div>
        </div>

        {/* Admins */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div 
            className="p-3 rounded-4 d-flex align-items-center justify-content-between shadow-sm"
            style={{ backgroundColor: '#1E293B', border: '1px solid rgba(248, 113, 113, 0.25)', minHeight: '84px' }}
          >
            <div>
              <div className="fw-semibold" style={{ fontSize: '12px', color: '#FCA5A5' }}>Administradores Gerais</div>
              <div className="fw-bold" style={{ fontSize: '24px', color: '#EF4444' }}>{kpi.admins}</div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Acesso total irrestrito</div>
            </div>
            <div 
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '40px', height: '40px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontSize: '18px' }}
            >
              <i className="bi bi-shield-lock-fill"></i>
            </div>
          </div>
        </div>

        {/* Attendants */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div 
            className="p-3 rounded-4 d-flex align-items-center justify-content-between shadow-sm"
            style={{ backgroundColor: '#1E293B', border: '1px solid rgba(52, 211, 153, 0.25)', minHeight: '84px' }}
          >
            <div>
              <div className="fw-semibold" style={{ fontSize: '12px', color: '#6EE7B7' }}>Atendentes de Guichê</div>
              <div className="fw-bold" style={{ fontSize: '24px', color: '#10B981' }}>{kpi.attendants}</div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Operação e balcão</div>
            </div>
            <div 
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '40px', height: '40px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontSize: '18px' }}
            >
              <i className="bi bi-person-badge-fill"></i>
            </div>
          </div>
        </div>

        {/* Active vs Inactive */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div 
            className="p-3 rounded-4 d-flex align-items-center justify-content-between shadow-sm"
            style={{ backgroundColor: '#1E293B', border: '1px solid rgba(251, 191, 36, 0.25)', minHeight: '84px' }}
          >
            <div>
              <div className="fw-semibold" style={{ fontSize: '12px', color: '#FCD34D' }}>Status da Equipe</div>
              <div className="fw-bold" style={{ fontSize: '24px', color: '#F59E0B' }}>{kpi.active} <small style={{ fontSize: '14px', fontWeight: 'normal', color: '#94A3B8' }}>/ {kpi.inactive} inativo(s)</small></div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>{kpi.active} contas habilitadas</div>
            </div>
            <div 
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '40px', height: '40px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontSize: '18px' }}
            >
              <i className="bi bi-person-check-fill"></i>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search and Filters Card */}
      <div className="card shadow-sm border-0 rounded-4 mb-4 bg-white p-3" style={{ border: '1px solid #E2E8F0' }}>
        <div className="row g-2 align-items-center">
          {/* Search Box */}
          <div className="col-12 col-md-5">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: '13px' }}
              />
              {search && (
                <button className="btn btn-outline-secondary" type="button" onClick={() => setSearch('')}>
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>

          {/* Role Filter Pills */}
          <div className="col-12 col-md-4 d-flex align-items-center gap-1">
            <span className="text-muted small me-1">Papel:</span>
            <button
              type="button"
              className={`btn btn-sm py-1 px-2.5 rounded-pill fw-semibold ${roleFilter === 'all' ? 'btn-primary' : 'btn-light border text-secondary'}`}
              style={{ fontSize: '12px' }}
              onClick={() => setRoleFilter('all')}
            >
              Todos
            </button>
            <button
              type="button"
              className={`btn btn-sm py-1 px-2.5 rounded-pill fw-semibold ${roleFilter === 'admin' ? 'btn-danger' : 'btn-light border text-secondary'}`}
              style={{ fontSize: '12px' }}
              onClick={() => setRoleFilter('admin')}
            >
              Admins
            </button>
            <button
              type="button"
              className={`btn btn-sm py-1 px-2.5 rounded-pill fw-semibold ${roleFilter === 'atendente' ? 'btn-success' : 'btn-light border text-secondary'}`}
              style={{ fontSize: '12px' }}
              onClick={() => setRoleFilter('atendente')}
            >
              Atendentes
            </button>
          </div>

          {/* Status Filter */}
          <div className="col-12 col-md-3 d-flex justify-content-md-end align-items-center gap-2">
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ fontSize: '12.5px', maxWidth: '160px' }}
            >
              <option value="all">Todos os Status</option>
              <option value="active">Apenas Ativos</option>
              <option value="inactive">Apenas Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Administrators Table */}
      <div className="card shadow-sm border-0 rounded-4 overflow-hidden bg-white" style={{ border: '1px solid #E2E8F0' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <tr style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th className="py-3 px-3">Operador / Administrador</th>
                  <th>Contato</th>
                  <th>Papel / Perfil</th>
                  <th>Status</th>
                  <th>Data de Criação</th>
                  <th className="text-end px-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-5 text-muted" style={{ fontSize: '13.5px' }}>
                      <i className="bi bi-people display-6 d-block text-muted mb-2 opacity-50"></i>
                      Nenhum administrador ou atendente encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    const isCurrentAdmin = (currentAdminId && u.id === currentAdminId) || 
                      (Boolean(currentAdminEmail) && Boolean(u.email) && u.email.toLowerCase() === currentAdminEmail?.toLowerCase())
                    const initials = getInitials(u.full_name)
                    const roleColor = u.role === 'admin' ? '#EF4444' : '#10B981'

                    return (
                      <tr key={u.id} style={{ fontSize: '13px' }}>
                        {/* Name & Avatar */}
                        <td className="px-3 py-3">
                          <div className="d-flex align-items-center gap-2.5">
                            <div 
                              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0 shadow-xs"
                              style={{ 
                                width: '34px', 
                                height: '34px', 
                                backgroundColor: roleColor, 
                                fontSize: '12px' 
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="fw-bold text-dark d-flex align-items-center gap-1.5">
                                {u.full_name}
                                {isCurrentAdmin && (
                                  <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-1.5 py-0.5" style={{ fontSize: '10px' }}>
                                    Você
                                  </span>
                                )}
                              </div>
                              <div className="text-muted small" style={{ fontSize: '11.5px' }}>
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td style={{ color: '#475569' }}>
                          {u.phone || '—'}
                        </td>

                        {/* Role */}
                        <td>
                          <span 
                            className={`badge rounded-pill px-2.5 py-1 fw-semibold ${
                              u.role === 'admin' 
                                ? 'bg-danger text-white' 
                                : 'bg-primary text-white'
                            }`}
                            style={{ fontSize: '11px' }}
                          >
                            <i className={`bi ${u.role === 'admin' ? 'bi-shield-lock-fill' : 'bi-person-badge-fill'} me-1`}></i>
                            {u.role === 'admin' ? 'Administrador Geral' : 'Atendente de Guichê'}
                          </span>
                        </td>

                        {/* Status */}
                        <td>
                          <span 
                            className={`badge rounded-pill px-2 py-1 d-inline-flex align-items-center gap-1 fw-medium ${
                              u.status === 'active' 
                                ? 'bg-success-subtle text-success border border-success-subtle' 
                                : 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                            }`}
                            style={{ fontSize: '11px' }}
                          >
                            <span 
                              className="rounded-circle" 
                              style={{ 
                                width: '6px', 
                                height: '6px', 
                                backgroundColor: u.status === 'active' ? '#10B981' : '#94A3B8' 
                              }}
                            ></span>
                            {u.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>

                        {/* Date */}
                        <td style={{ color: '#64748B', fontSize: '12px' }} suppressHydrationWarning>
                          {new Date(u.created_at).toLocaleDateString('pt-BR')}
                        </td>

                        {/* Actions */}
                        <td className="text-end px-3">
                          <div className="btn-group btn-group-sm" role="group">
                            {/* Edit Button */}
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              title="Editar dados"
                              onClick={() => {
                                setEditingUser(u)
                                setEditForm({
                                  name: u.full_name,
                                  email: u.email,
                                  phone: u.phone || '',
                                  role: u.role,
                                  status: u.status
                                })
                              }}
                            >
                              <i className="bi bi-pencil-fill"></i>
                            </button>

                            {/* Reset Password Button */}
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              title="Redefinir senha"
                              onClick={() => {
                                setPasswordResetUser(u)
                                setNewPassword('')
                                setConfirmPassword('')
                              }}
                            >
                              <i className="bi bi-key-fill"></i>
                            </button>

                            {/* Toggle Status Button */}
                            <button
                              type="button"
                              className={`btn btn-sm ${u.status === 'active' ? 'btn-outline-warning' : 'btn-outline-success'}`}
                              title={u.status === 'active' ? 'Desativar usuário' : 'Ativar usuário'}
                              disabled={actionLoadingId === u.id || (isCurrentAdmin && u.status === 'active')}
                              onClick={() => handleToggleStatus(u)}
                            >
                              <i className={`bi ${u.status === 'active' ? 'bi-person-slash' : 'bi-person-check'}`}></i>
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              title={isCurrentAdmin ? "Excluir sua própria conta" : "Excluir usuário"}
                              disabled={actionLoadingId === u.id}
                              onClick={() => setDeletingUser(u)}
                            >
                              <i className="bi bi-trash-fill"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. MODALS */}
      {/* ========================================================= */}

      {/* MODAL 1: CRIAR USUÁRIO */}
      {isCreateOpen && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg text-dark">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '17px' }}>
                  <i className="bi bi-person-plus-fill text-primary"></i>
                  Novo Administrador / Atendente
                </h5>
                <button type="button" className="btn-close" onClick={() => setIsCreateOpen(false)} disabled={isPending}></button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold small text-secondary">Nome Completo *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: Ana Maria Silva"
                      required
                      value={createForm.name}
                      onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-7">
                      <label className="form-label fw-semibold small text-secondary">E-mail de Acesso *</label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="usuario@poranga.ce.gov.br"
                        required
                        value={createForm.email}
                        onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                      />
                    </div>
                    <div className="col-md-5">
                      <label className="form-label fw-semibold small text-secondary">Telefone / Ramal</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="(88) 99999-0000"
                        value={createForm.phone}
                        onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-secondary">Papel / Perfil *</label>
                      <select
                        className="form-select"
                        value={createForm.role}
                        onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                      >
                        <option value="atendente">Atendente de Guichê</option>
                        <option value="admin">Administrador Geral</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-secondary">Status Inicial *</label>
                      <select
                        className="form-select"
                        value={createForm.status}
                        onChange={e => setCreateForm({ ...createForm, status: e.target.value })}
                      >
                        <option value="active">Ativo (Habilitado)</option>
                        <option value="inactive">Inativo (Bloqueado)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-semibold small text-secondary">Senha de Acesso *</label>
                    <div className="input-group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control"
                        placeholder="Mínimo 8 caracteres (A-Z, 0-9, @#$)"
                        required
                        value={createForm.password}
                        onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                    <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                      Requisitos: 8+ caracteres, maiúscula, minúscula, número e símbolo especial.
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top bg-light p-3">
                  <button type="button" className="btn btn-secondary btn-sm px-3" onClick={() => setIsCreateOpen(false)} disabled={isPending}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm px-4 fw-semibold" disabled={isPending}>
                    {isPending ? 'Cadastrando...' : 'Cadastrar Usuário'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR DADOS */}
      {editingUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg text-dark">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '17px' }}>
                  <i className="bi bi-pencil-square text-primary"></i>
                  Editar Operador: {editingUser.full_name}
                </h5>
                <button type="button" className="btn-close" onClick={() => setEditingUser(null)} disabled={isPending}></button>
              </div>
              <form onSubmit={handleEdit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold small text-secondary">Nome Completo *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-7">
                      <label className="form-label fw-semibold small text-secondary">E-mail *</label>
                      <input
                        type="email"
                        className="form-control"
                        required
                        value={editForm.email}
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      />
                    </div>
                    <div className="col-md-5">
                      <label className="form-label fw-semibold small text-secondary">Telefone / Ramal</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editForm.phone}
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-secondary">Papel / Perfil *</label>
                      <select
                        className="form-select"
                        value={editForm.role}
                        onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                      >
                        <option value="atendente">Atendente de Guichê</option>
                        <option value="admin">Administrador Geral</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-secondary">Status *</label>
                      <select
                        className="form-select"
                        value={editForm.status}
                        onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                      >
                        <option value="active">Ativo (Habilitado)</option>
                        <option value="inactive">Inativo (Bloqueado)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top bg-light p-3">
                  <button type="button" className="btn btn-secondary btn-sm px-3" onClick={() => setEditingUser(null)} disabled={isPending}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm px-4 fw-semibold" disabled={isPending}>
                    {isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REDEFINIR SENHA */}
      {passwordResetUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg text-dark">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '17px' }}>
                  <i className="bi bi-key-fill text-warning"></i>
                  Redefinir Senha: {passwordResetUser.full_name}
                </h5>
                <button type="button" className="btn-close" onClick={() => setPasswordResetUser(null)} disabled={isPending}></button>
              </div>
              <form onSubmit={handleResetPassword}>
                <div className="modal-body p-4">
                  <p className="text-muted small mb-3">
                    Defina uma nova senha segura para o operador <strong>{passwordResetUser.email}</strong>.
                  </p>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small text-secondary">Nova Senha *</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Mínimo 8 caracteres"
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-semibold small text-secondary">Confirmar Nova Senha *</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Repita a nova senha"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer border-top bg-light p-3">
                  <button type="button" className="btn btn-secondary btn-sm px-3" onClick={() => setPasswordResetUser(null)} disabled={isPending}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-warning btn-sm px-4 fw-semibold text-dark" disabled={isPending}>
                    {isPending ? 'Redefinindo...' : 'Confirmar Nova Senha'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRMAR EXCLUSÃO */}
      {deletingUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg text-dark">
              <div className="modal-header border-bottom py-3 bg-danger text-white">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2" style={{ fontSize: '17px' }}>
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  Confirmar Exclusão de Usuário
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setDeletingUser(null)}></button>
              </div>
              <div className="modal-body p-4">
                <p className="mb-2">
                  Você tem certeza que deseja excluir permanentemente a conta do operador:
                </p>
                <div className="p-3 bg-light rounded-3 mb-3 border">
                  <div className="fw-bold text-dark">{deletingUser.full_name}</div>
                  <div className="text-muted small">{deletingUser.email} · {deletingUser.role === 'admin' ? 'Administrador' : 'Atendente'}</div>
                </div>
                {deletingUser.id === currentAdminId ? (
                  <div className="alert alert-danger py-2 px-3 small mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                    <div>
                      <strong>Atenção:</strong> Você está prestes a excluir sua <strong>própria conta</strong>. Caso confirme, sua sessão será encerrada e você será desconectado.
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning py-2 px-3 small mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-shield-exclamation fs-5"></i>
                    Esta ação não pode ser desfeita.
                  </div>
                )}
              </div>
              <div className="modal-footer border-top bg-light p-3">
                <button type="button" className="btn btn-secondary btn-sm px-3" onClick={() => setDeletingUser(null)}>
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger btn-sm px-4 fw-semibold"
                  disabled={actionLoadingId === deletingUser.id}
                  onClick={handleDelete}
                >
                  {actionLoadingId === deletingUser.id ? 'Excluindo...' : 'Sim, Excluir Usuário'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
