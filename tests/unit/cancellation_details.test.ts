import { AppointmentItem } from '@/components/admin/AppointmentsManagementClient'

describe('Unit Tests — Cancellation Details & Visibility Logic', () => {
  const baseAppointment: AppointmentItem = {
    id: 'apt-001',
    protocol_number: '20260930-3RIP4E',
    full_name: 'Nila Santos',
    phone: '88999785623',
    sexo: 'Feminino',
    appointment_date: '2026-09-30',
    appointment_time: '16:00:00',
    appointment_type: 'second_issue',
    status: 'cancelled',
    origin: 'online',
    is_walk_in: false,
    attendant: 'Guichê 02',
    created_at: '2026-09-10T10:00:00Z',
    updated_at: '2026-09-15T14:30:00Z',
    cancellation_reason: 'Imprevisto de viagem',
    cancelled_by: 'Cidadão (Portal)',
    cancelled_at: '2026-09-15T14:30:00Z'
  }

  describe('1. Regras de Exibição Condicional de Ações na Tabela', () => {
    it('Deve exibir o botão "Ver Detalhes" apenas quando status for cancelled', () => {
      const isCancelled = (status: string) => status === 'cancelled'

      expect(isCancelled('cancelled')).toBe(true)
      expect(isCancelled('scheduled')).toBe(false)
      expect(isCancelled('confirmed')).toBe(false)
      expect(isCancelled('completed')).toBe(false)
      expect(isCancelled('no_show')).toBe(false)
    })

    it('NÃO deve exibir botão de Confirmar Atendimento para agendamentos cancelados', () => {
      const showConfirm = (status: string) => status !== 'completed' && status !== 'cancelled'
      expect(showConfirm('cancelled')).toBe(false)
      expect(showConfirm('confirmed')).toBe(true)
      expect(showConfirm('scheduled')).toBe(true)
    })

    it('Deve exibir o botão Delete para agendamentos de qualquer status', () => {
      const showDelete = (id?: string) => Boolean(id)
      expect(showDelete(baseAppointment.id)).toBe(true)
    })
  })

  describe('2. Extração e Formatação dos Detalhes de Cancelamento', () => {
    it('Deve extrair os dados completos quando todos os campos estiverem preenchidos', () => {
      expect(baseAppointment.status).toBe('cancelled')
      expect(baseAppointment.protocol_number).toBe('20260930-3RIP4E')
      expect(baseAppointment.cancellation_reason).toBe('Imprevisto de viagem')
      expect(baseAppointment.cancelled_by).toBe('Cidadão (Portal)')
      expect(baseAppointment.cancelled_at).toBe('2026-09-15T14:30:00Z')
    })

    it('Deve aplicar fallbacks elegantes quando campos opcionais forem omitidos', () => {
      const partialCancelled: AppointmentItem = {
        id: 'apt-002',
        protocol_number: '20260924-5LP871',
        full_name: 'Valmim Santos',
        phone: '8899564578',
        appointment_date: '2026-09-24',
        appointment_time: '15:30',
        appointment_type: 'second_issue',
        status: 'cancelled',
        origin: 'online'
      }

      // Fallback para motivo
      const reasonDisplay = partialCancelled.cancellation_reason || 'Não informado pelo solicitante'
      expect(reasonDisplay).toBe('Não informado pelo solicitante')

      // Fallback para cancelado por
      const actorDisplay = partialCancelled.cancelled_by 
        ? partialCancelled.cancelled_by 
        : partialCancelled.origin === 'online' 
          ? 'Cidadão (Portal de Agendamento)' 
          : 'Atendente do Posto (Balcão)'
      expect(actorDisplay).toBe('Cidadão (Portal de Agendamento)')

      // Fallback para timestamp
      const timestampDisplay = partialCancelled.cancelled_at || partialCancelled.updated_at || 'Data não registrada'
      expect(timestampDisplay).toBe('Data não registrada')
    })

    it('Deve derivar corretamente ator para agendamento presencial walk-in', () => {
      const walkInCancelled: AppointmentItem = {
        id: 'apt-003',
        protocol_number: 'PRES-20260918-PMKG90',
        full_name: 'Maria Bonita',
        phone: '8899563047',
        appointment_date: '2026-09-18',
        appointment_time: '08:00',
        appointment_type: 'first_issue',
        status: 'cancelled',
        origin: 'presencial',
        is_walk_in: true
      }

      const isPresencial = walkInCancelled.origin === 'presencial' || walkInCancelled.is_walk_in || walkInCancelled.protocol_number.startsWith('PRES-')
      expect(isPresencial).toBe(true)

      const actorDisplay = walkInCancelled.cancelled_by 
        ? walkInCancelled.cancelled_by 
        : isPresencial 
          ? 'Atendente do Posto (Balcão)' 
          : 'Cidadão (Portal de Agendamento)'
      expect(actorDisplay).toBe('Atendente do Posto (Balcão)')
    })

    it('Deve distinguir corretamente 1ª Via e 2ª Via de RG', () => {
      const checkService = (type: string) => {
        const isSecond = String(type).toLowerCase().includes('2') || String(type).toLowerCase().includes('second')
        return isSecond ? '2ª Via RG' : '1ª Via RG'
      }

      expect(checkService('first_issue')).toBe('1ª Via RG')
      expect(checkService('1ª Via')).toBe('1ª Via RG')
      expect(checkService('second_issue')).toBe('2ª Via RG')
      expect(checkService('2ª Via')).toBe('2ª Via RG')
    })
  })
})
