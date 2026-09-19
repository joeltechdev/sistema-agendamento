'use client'

import { useState, useTransition } from 'react'
import { cancelAppointment } from '@/app/actions/appointments'

interface Props {
  appointmentId: string
  status: string
}

export default function CancelButton({ appointmentId, status }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  if (status === 'cancelled') {
    return <span className="badge bg-danger text-white p-2">Cancelado</span>
  }
  
  if (status !== 'scheduled' && status !== 'confirmed') {
    return <span className="badge bg-secondary p-2">{status}</span>
  }

  const handleCancel = () => {
    if (confirm('Tem certeza absoluta que deseja cancelar este agendamento? Esta ação liberará sua vaga imediatamente.')) {
      startTransition(async () => {
        const result = await cancelAppointment(appointmentId)
        if (!result.success) {
          setError(result.error || 'Erro desconhecido')
          alert(result.error || 'Erro desconhecido')
        }
      })
    }
  }

  return (
    <div>
      <button 
        onClick={handleCancel} 
        disabled={isPending}
        className="btn btn-outline-danger btn-sm"
        aria-label="Cancelar agendamento ativo"
        title="Cancelar sua reserva"
      >
        {isPending ? 'Cancelando...' : 'Cancelar Vaga'}
      </button>
      {error && <div className="text-danger small mt-1" role="alert">{error}</div>}
    </div>
  )
}
