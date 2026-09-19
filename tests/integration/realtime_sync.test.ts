import { isSecondIssueAppointment, normalizeDateStringToYMD, normalizeTimeStringToHHMM } from '@/components/admin/WeeklyCalendarGrid';
import { getDashboardMetrics } from '@/app/actions/admin';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

const mockAppointmentsDb: any[] = [
  {
    id: 'apt-1',
    citizen_id: 'user-1',
    appointment_date: '2026-09-16',
    appointment_time: '08:00:00',
    appointment_type: 'first_issue',
    status: 'confirmed',
    protocol_number: '20260916-1VIA01',
    profiles: { full_name: 'Ana Silva', phone: '88999990001', cpf: '111.222.333-44' }
  },
  {
    id: 'apt-2',
    citizen_id: 'user-2',
    appointment_date: '2026-09-16',
    appointment_time: '08:30:00',
    appointment_type: 'second_issue',
    status: 'confirmed',
    protocol_number: '20260916-2VIA02',
    profiles: { full_name: 'Bruno Lima', phone: '88999990002', cpf: '222.333.444-55' }
  }
];

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockImplementation(async () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } } }),
    },
    from: jest.fn().mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        };
      }
      if (table === 'system_settings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { value: '200' }, error: null })
        };
      }
      if (table === 'appointments') {
        return {
          select: jest.fn().mockImplementation((sel, opts) => {
            if (opts?.head) {
              return {
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                neq: jest.fn().mockResolvedValue({ count: mockAppointmentsDb.length, error: null })
              };
            }
            return {
              neq: jest.fn().mockReturnThis(),
              gte: jest.fn().mockReturnThis(),
              lte: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({ data: mockAppointmentsDb, error: null })
            };
          })
        };
      }
      return {};
    })
  }))
}));

describe('Controle de Agendamentos — Painel e Sincronização em Tempo Real', () => {
  it('Critério 1: Deve identificar e mapear corretamente o card de 1ª Via (Verde)', () => {
    const apt1 = mockAppointmentsDb[0];
    expect(isSecondIssueAppointment(apt1)).toBe(false);
    expect(normalizeDateStringToYMD(apt1.appointment_date)).toBe('2026-09-16');
    expect(normalizeTimeStringToHHMM(apt1.appointment_time)).toBe('08:00');
  });

  it('Critério 2: Deve identificar e mapear corretamente o card de 2ª Via (Azul)', () => {
    const apt2 = mockAppointmentsDb[1];
    expect(isSecondIssueAppointment(apt2)).toBe(true);
    expect(normalizeDateStringToYMD(apt2.appointment_date)).toBe('2026-09-16');
    expect(normalizeTimeStringToHHMM(apt2.appointment_time)).toBe('08:30');
  });

  it('Critério 3: Deve persistir e recalcular métricas e lista de agendamentos no reload (getDashboardMetrics)', async () => {
    const metrics = await getDashboardMetrics();
    expect(metrics.limit).toBe(200);
    expect(metrics.upcomingAppointments.length).toBe(2);
    
    // Confere join com profiles e normalização
    const first = metrics.upcomingAppointments[0];
    expect(first.full_name).toBe('Ana Silva');
    expect(first.protocol_number).toBe('20260916-1VIA01');
    expect(first.categoria).toBe('1ª Via RG');

    const second = metrics.upcomingAppointments[1];
    expect(second.full_name).toBe('Bruno Lima');
    expect(second.protocol_number).toBe('20260916-2VIA02');
    expect(second.categoria).toBe('2ª Via RG');
  });

  it('Critério 4: Normalização robusta de data e hora para qualquer fuso horário ou string ISO', () => {
    expect(normalizeDateStringToYMD('2026-09-16T12:30:00.000Z')).toBe('2026-09-16');
    expect(normalizeDateStringToYMD('16/09/2026')).toBe('2026-09-16');
    expect(normalizeTimeStringToHHMM('08:00:00')).toBe('08:00');
    expect(normalizeTimeStringToHHMM('8:00')).toBe('08:00');
    expect(normalizeTimeStringToHHMM('2026-09-16T14:30:00')).toBe('14:30');
  });
});
