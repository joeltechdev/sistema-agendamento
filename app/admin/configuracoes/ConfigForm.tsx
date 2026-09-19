'use client'

import React, { useTransition, useState, useEffect } from 'react'
import Link from 'next/link'
import { updateSystemSetting } from '@/app/actions/admin'

interface OperatingHoursConfig {
  morning: { start: string; end: string; enabled: boolean }
  afternoon: { start: string; end: string; enabled: boolean }
}

interface ConfigFormProps {
  limitValue: string
  initialDays?: number[]
  initialHours?: OperatingHoursConfig
}

const ALL_DAYS = [
  { id: 1, label: 'Segunda-feira', short: 'Seg' },
  { id: 2, label: 'Terça-feira', short: 'Ter' },
  { id: 3, label: 'Quarta-feira', short: 'Qua' },
  { id: 4, label: 'Quinta-feira', short: 'Qui' },
  { id: 5, label: 'Sexta-feira', short: 'Sex' },
  { id: 6, label: 'Sábado', short: 'Sáb' },
  { id: 0, label: 'Domingo', short: 'Dom' },
]

export default function ConfigForm({
  limitValue,
  initialDays = [1, 2, 3, 4, 5],
  initialHours = {
    morning: { start: '08:00', end: '12:00', enabled: true },
    afternoon: { start: '13:00', end: '17:00', enabled: true }
  }
}: ConfigFormProps) {
  // Bloco Limite
  const [isPendingLimit, startTransitionLimit] = useTransition()
  const [limit, setLimit] = useState(limitValue)
  const [limitMsg, setLimitMsg] = useState('')

  // Bloco Dias da Semana
  const [isPendingDays, startTransitionDays] = useTransition()
  const [selectedDays, setSelectedDays] = useState<number[]>(initialDays)
  const [daysMsg, setDaysMsg] = useState('')

  // Bloco Horários
  const [isPendingHours, startTransitionHours] = useTransition()
  const [hours, setHours] = useState<OperatingHoursConfig>(initialHours)
  const [hoursMsg, setHoursMsg] = useState('')

  // Handlers de Salvar
  const handleSaveLimit = () => {
    setLimitMsg('')
    startTransitionLimit(async () => {
      const res = await updateSystemSetting('monthly_limit', limit, 'Limite máximo de agendamentos confirmados por mês')
      if (res.success) setLimitMsg('Salvo com sucesso!')
      else setLimitMsg('Erro ao salvar')
    })
  }

  const handleToggleDay = (dayId: number) => {
    setSelectedDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId].sort()
    )
  }

  const handleSetWeekdaysOnly = () => {
    setSelectedDays([1, 2, 3, 4, 5])
  }

  const handleSetAllDays = () => {
    setSelectedDays([0, 1, 2, 3, 4, 5, 6])
  }

  const handleSaveDays = () => {
    setDaysMsg('')
    startTransitionDays(async () => {
      const res = await updateSystemSetting(
        'available_days', 
        JSON.stringify(selectedDays), 
        'Dias da semana disponíveis para agendamentos'
      )
      if (res.success) setDaysMsg('Dias de atendimento salvos com sucesso!')
      else setDaysMsg('Erro ao salvar dias')
    })
  }

  const handleSaveHours = () => {
    setHoursMsg('')
    startTransitionHours(async () => {
      const res = await updateSystemSetting(
        'operating_hours', 
        JSON.stringify(hours), 
        'Turnos e horários de atendimento'
      )
      if (res.success) setHoursMsg('Horários de atendimento salvos com sucesso!')
      else setHoursMsg('Erro ao salvar horários')
    })
  }

  const isDaysUnchanged = JSON.stringify(selectedDays.slice().sort()) === JSON.stringify(initialDays.slice().sort())
  const isHoursUnchanged = JSON.stringify(hours) === JSON.stringify(initialHours)

  return (
    <div className="row g-4">
      
      {/* Coluna Esquerda */}
      <div className="col-lg-6 d-flex flex-column gap-4">
        
        {/* Bloco 1: Limite de Vagas Mensais (ORIGINAL PRESERVADO) */}
        <div className="card shadow-sm border-0 rounded-4 bg-white" style={{ border: '1px solid #E2E8F0' }}>
          <div className="card-body p-4">
            <h5 className="card-title fw-bold mb-3 text-dark d-flex align-items-center gap-2">
              <i className="bi bi-speedometer2 text-primary"></i>
              Limite de Vagas Mensais
            </h5>
            
            <div className="mb-3">
              <label className="form-label fw-semibold text-secondary">Total de vagas disponíveis por mês</label>
              <input 
                type="number" 
                className="form-control form-control-lg" 
                value={limit} 
                onChange={e => setLimit(e.target.value)}
                disabled={isPendingLimit}
                style={{ maxWidth: '200px', fontSize: '15px' }}
              />
              <div className="form-text text-muted mt-2" style={{ fontSize: '12.5px' }}>
                Este valor bloqueia novos agendamentos caso o número de confirmações no mês atinja o limite.
              </div>
            </div>

            <div className="d-flex align-items-center gap-3">
              <button 
                className="btn btn-primary px-3 py-2 fw-semibold shadow-sm" 
                onClick={handleSaveLimit} 
                disabled={isPendingLimit || limit === limitValue}
                style={{ borderRadius: '8px' }}
              >
                {isPendingLimit ? 'Salvando...' : 'Salvar Alteração'}
              </button>

              {limitMsg && (
                <span className={`small fw-semibold ${limitMsg.includes('Erro') ? 'text-danger' : 'text-success'}`}>
                  {limitMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bloco 2: Horário de Atendimento (Turnos) */}
        <div className="card shadow-sm border-0 rounded-4 bg-white" style={{ border: '1px solid #E2E8F0' }}>
          <div className="card-body p-4">
            <h5 className="card-title fw-bold mb-3 text-dark d-flex align-items-center gap-2">
              <i className="bi bi-clock-history text-primary"></i>
              Horário de Atendimento
            </h5>
            <p className="text-muted small mb-3">
              Configure os turnos de funcionamento da manhã e da tarde para recepção dos cidadãos.
            </p>

            {/* Turno Manhã */}
            <div className="p-3 rounded-3 bg-light border mb-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="fw-semibold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-brightness-alt-high text-warning"></i>
                  Turno da Manhã
                </span>
                <div className="form-check form-switch m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="morningSwitch"
                    checked={hours.morning.enabled}
                    onChange={e => setHours(prev => ({
                      ...prev,
                      morning: { ...prev.morning, enabled: e.target.checked }
                    }))}
                  />
                  <label className="form-check-label small text-muted" htmlFor="morningSwitch">
                    {hours.morning.enabled ? 'Ativo' : 'Inativo'}
                  </label>
                </div>
              </div>

              <div className="row g-2 align-items-center">
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Início</label>
                  <input
                    type="time"
                    className="form-control form-control-sm"
                    value={hours.morning.start}
                    disabled={!hours.morning.enabled || isPendingHours}
                    onChange={e => setHours(prev => ({
                      ...prev,
                      morning: { ...prev.morning, start: e.target.value }
                    }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Término</label>
                  <input
                    type="time"
                    className="form-control form-control-sm"
                    value={hours.morning.end}
                    disabled={!hours.morning.enabled || isPendingHours}
                    onChange={e => setHours(prev => ({
                      ...prev,
                      morning: { ...prev.morning, end: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* Turno Tarde */}
            <div className="p-3 rounded-3 bg-light border mb-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="fw-semibold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-sunset text-danger"></i>
                  Turno da Tarde
                </span>
                <div className="form-check form-switch m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="afternoonSwitch"
                    checked={hours.afternoon.enabled}
                    onChange={e => setHours(prev => ({
                      ...prev,
                      afternoon: { ...prev.afternoon, enabled: e.target.checked }
                    }))}
                  />
                  <label className="form-check-label small text-muted" htmlFor="afternoonSwitch">
                    {hours.afternoon.enabled ? 'Ativo' : 'Inativo'}
                  </label>
                </div>
              </div>

              <div className="row g-2 align-items-center">
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Início</label>
                  <input
                    type="time"
                    className="form-control form-control-sm"
                    value={hours.afternoon.start}
                    disabled={!hours.afternoon.enabled || isPendingHours}
                    onChange={e => setHours(prev => ({
                      ...prev,
                      afternoon: { ...prev.afternoon, start: e.target.value }
                    }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Término</label>
                  <input
                    type="time"
                    className="form-control form-control-sm"
                    value={hours.afternoon.end}
                    disabled={!hours.afternoon.enabled || isPendingHours}
                    onChange={e => setHours(prev => ({
                      ...prev,
                      afternoon: { ...prev.afternoon, end: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-3">
              <button 
                className="btn btn-primary px-3 py-2 fw-semibold shadow-sm" 
                onClick={handleSaveHours} 
                disabled={isPendingHours || isHoursUnchanged}
                style={{ borderRadius: '8px' }}
              >
                {isPendingHours ? 'Salvando...' : 'Salvar Horários'}
              </button>

              {hoursMsg && (
                <span className={`small fw-semibold ${hoursMsg.includes('Erro') ? 'text-danger' : 'text-success'}`}>
                  {hoursMsg}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Coluna Direita */}
      <div className="col-lg-6 d-flex flex-column gap-4">

        {/* Bloco 3: Dias da Semana Disponíveis */}
        <div className="card shadow-sm border-0 rounded-4 bg-white" style={{ border: '1px solid #E2E8F0' }}>
          <div className="card-body p-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="card-title fw-bold m-0 text-dark d-flex align-items-center gap-2">
                <i className="bi bi-calendar-check text-primary"></i>
                Dias de Atendimento
              </h5>
              
              <div className="btn-group btn-group-sm">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary" 
                  onClick={handleSetWeekdaysOnly}
                >
                  Seg-Sex
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-secondary" 
                  onClick={handleSetAllDays}
                >
                  Todos
                </button>
              </div>
            </div>

            <p className="text-muted small mb-3">
              Selecione quais dias da semana o posto de atendimento realiza agendamentos.
            </p>

            <div className="d-flex flex-column gap-2 mb-3">
              {ALL_DAYS.map(day => {
                const isSelected = selectedDays.includes(day.id)
                return (
                  <div
                    key={day.id}
                    onClick={() => handleToggleDay(day.id)}
                    className={`p-2 px-3 rounded-3 border d-flex align-items-center justify-content-between ${
                      isSelected ? 'bg-light border-primary' : 'bg-white border-light-subtle opacity-75'
                    }`}
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        className="form-check-input m-0"
                        checked={isSelected}
                        onChange={() => {}} // Handled by div click
                      />
                      <span className={`fw-semibold ${isSelected ? 'text-dark' : 'text-muted'}`}>
                        {day.label}
                      </span>
                    </div>

                    <span className={`badge ${isSelected ? 'bg-primary' : 'bg-light text-muted border'}`}>
                      {isSelected ? 'Habilitado' : 'Desabilitado'}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="d-flex align-items-center gap-3">
              <button 
                className="btn btn-primary px-3 py-2 fw-semibold shadow-sm" 
                onClick={handleSaveDays} 
                disabled={isPendingDays || isDaysUnchanged}
                style={{ borderRadius: '8px' }}
              >
                {isPendingDays ? 'Salvando...' : 'Salvar Dias'}
              </button>

              {daysMsg && (
                <span className={`small fw-semibold ${daysMsg.includes('Erro') ? 'text-danger' : 'text-success'}`}>
                  {daysMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bloco 4: Atalho para Relatórios & Impressão */}
        <div className="card shadow-sm border-0 rounded-4 bg-white" style={{ border: '1px solid #E2E8F0' }}>
          <div className="card-body p-4">
            <h5 className="card-title fw-bold mb-2 text-dark d-flex align-items-center gap-2">
              <i className="bi bi-file-earmark-bar-graph text-primary"></i>
              Relatórios & Impressão
            </h5>
            <p className="text-muted small mb-3">
              Acesse a central de relatórios para visualizar o histórico de agendamentos agrupados por <strong>Semana</strong> ou por <strong>Mês</strong> e emitir relatórios oficiais formatados para impressão em folha A4.
            </p>

            <Link
              href="/admin/relatorios"
              className="btn btn-outline-primary d-inline-flex align-items-center gap-2 fw-semibold px-3 py-2 shadow-sm"
              style={{ borderRadius: '8px' }}
            >
              <i className="bi bi-bar-chart-line"></i>
              <span>Abrir Relatórios de Agendamentos</span>
              <i className="bi bi-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>

      </div>

    </div>
  )
}
