import { isSecondIssueAppointment, normalizeDateStringToYMD, normalizeTimeStringToHHMM, calculateEndTime } from '@/components/admin/WeeklyCalendarGrid';
import { adminUpdateAppointmentStatus } from '@/app/actions/admin';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

const mockAppointmentsDb: any[] = [
  {
    id: 'apt-sync-1',
    citizen_id: 'user-1',
    appointment_date: '2026-09-16',
    appointment_time: '09:00:00',
    appointment_type: 'first_issue',
    status: 'confirmed',
    protocol_number: 'PRES-20260916-1VIA01',
    sexo: 'Feminino',
    is_walk_in: true,
    profiles: { full_name: 'Maria Ruty Silva', phone: '88999991111', sexo: 'Feminino' }
  },
  {
    id: 'apt-sync-2',
    citizen_id: 'user-2',
    appointment_date: '2026-09-16',
    appointment_time: '09:30:00',
    appointment_type: 'second_issue',
    status: 'confirmed',
    protocol_number: 'WEB-20260916-2VIA02',
    sexo: 'Masculino',
    is_walk_in: false,
    profiles: { full_name: 'Carlos Eduardo Santos', phone: '88999992222', sexo: 'Masculino' }
  }
];

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockImplementation(async () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } } }),
    },
    from: jest.fn().mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        };
      }
      if (table === 'appointments') {
        return {
          update: jest.fn().mockImplementation((values) => ({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'apt-sync-1',
                    protocol_number: 'PRES-20260916-1VIA01',
                    status: values.status,
                    full_name: 'Maria Ruty Silva'
                  },
                  error: null
                })
              })
            })
          })),
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockAppointmentsDb[0], error: null })
        };
      }
      if (table === 'audit_logs') {
        return {
          insert: jest.fn().mockResolvedValue({ data: null, error: null })
        };
      }
      return {};
    })
  }))
}));

describe('Grid Synchronization & Interactivity Regression Tests', () => {
  it('1. Deve sincronizar e mapear agendamento criado no slot correto da grade', () => {
    const apt = mockAppointmentsDb[0];
    const dateYMD = normalizeDateStringToYMD(apt.appointment_date);
    const timeHHMM = normalizeTimeStringToHHMM(apt.appointment_time);

    expect(dateYMD).toBe('2026-09-16');
    expect(timeHHMM).toBe('09:00');
    expect(isSecondIssueAppointment(apt)).toBe(false);
    expect(calculateEndTime(timeHHMM)).toBe('09:30');
  });

  it('2. Deve distinguir 1ª Via (Verde) e 2ª Via (Azul) para ambos agendamentos online e presencial', () => {
    const firstIssue = mockAppointmentsDb[0];
    const secondIssue = mockAppointmentsDb[1];

    expect(isSecondIssueAppointment(firstIssue)).toBe(false);
    expect(isSecondIssueAppointment(secondIssue)).toBe(true);

    expect(firstIssue.is_walk_in).toBe(true);
    expect(secondIssue.is_walk_in).toBe(false);
  });

  it('3. Deve atualizar o status do agendamento (Confirmado -> Concluído / Cancelado) via admin server action', async () => {
    const result = await adminUpdateAppointmentStatus('apt-sync-1', 'completed');
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('completed');
  });

  it('4. Deve formatar corretamente horários e intervalos de slots', () => {
    expect(calculateEndTime('08:00')).toBe('08:30');
    expect(calculateEndTime('11:30')).toBe('12:00');
    expect(calculateEndTime('16:00')).toBe('16:30');
  });
});
