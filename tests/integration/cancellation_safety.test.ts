import { adminUpdateAppointmentStatus, adminConfirmAttendance } from '@/app/actions/admin';
import { cancelAppointment } from '@/app/actions/appointments';
import { isAppointmentOverdue } from '@/components/admin/WeeklyCalendarGrid';
import { isOverdue } from '@/components/admin/AppointmentsManagementClient';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

// In-memory appointments database simulating 5 active appointments
let mockDatabase: Array<{
  id: string
  protocol_number: string
  full_name: string
  appointment_date: string
  appointment_time: string
  status: string
}> = []

const resetMockDatabase = () => {
  mockDatabase = [
    { id: 'apt-1', protocol_number: 'RG-2026-0001', full_name: 'Ana Souza', appointment_date: '2026-09-20', appointment_time: '08:00:00', status: 'confirmed' },
    { id: 'apt-2', protocol_number: 'RG-2026-0002', full_name: 'Bruno Lima', appointment_date: '2026-09-20', appointment_time: '08:30:00', status: 'confirmed' },
    { id: 'apt-3', protocol_number: 'RG-2026-0003', full_name: 'Carlos Dias', appointment_date: '2026-09-20', appointment_time: '09:00:00', status: 'confirmed' },
    { id: 'apt-4', protocol_number: 'RG-2026-0004', full_name: 'Daniela Reis', appointment_date: '2026-09-20', appointment_time: '09:30:00', status: 'confirmed' },
    { id: 'apt-5', protocol_number: 'RG-2026-0005', full_name: 'Eduardo Paz', appointment_date: '2026-09-20', appointment_time: '10:00:00', status: 'confirmed' }
  ]
}

jest.mock('@/lib/supabase/server', () => {
  return {
    createClient: jest.fn().mockImplementation(async () => {
      return {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-user-id' } } }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
            };
          }
          if (table === 'appointments') {
            let updatePayload: any = null
            let targetFilterId: string | null = null

            const queryObj: any = {
              update: jest.fn().mockImplementation((payload) => {
                updatePayload = payload
                return queryObj
              }),
              eq: jest.fn().mockImplementation((col: string, val: string) => {
                if (col === 'id') {
                  targetFilterId = val
                }
                return queryObj
              }),
              select: jest.fn().mockImplementation(() => queryObj),
              single: jest.fn().mockImplementation(async () => {
                if (!targetFilterId) {
                  throw new Error('Unconstrained update attempt detected!')
                }
                const item = mockDatabase.find(a => a.id === targetFilterId)
                if (item && updatePayload) {
                  Object.assign(item, updatePayload)
                  return { data: item, error: null }
                }
                return { data: null, error: { message: 'Not found' } }
              }),
              insert: jest.fn().mockResolvedValue({ error: null })
            }

            return queryObj
          }
          if (table === 'audit_logs') {
            return {
              insert: jest.fn().mockResolvedValue({ error: null })
            }
          }
          return {}
        })
      };
    })
  };
});

describe('P0 Bug Regression Test: Isolated Cancellation & Attendance Confirmation Safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockDatabase();
  });

  it('GIVEN 5 confirmed appointments, WHEN cancelling 1 appointment, THEN only that 1 is cancelled and the other 4 remain unchanged', async () => {
    expect(mockDatabase.length).toBe(5);
    expect(mockDatabase.every(a => a.status === 'confirmed')).toBe(true);

    // Cancel appointment #3 (Carlos Dias)
    const result = await adminUpdateAppointmentStatus('apt-3', 'cancelled');
    expect(result.success).toBe(true);

    // Assert: Only apt-3 is cancelled
    const apt3 = mockDatabase.find(a => a.id === 'apt-3');
    expect(apt3?.status).toBe('cancelled');

    // Assert: The other 4 remain confirmed
    const apt1 = mockDatabase.find(a => a.id === 'apt-1');
    const apt2 = mockDatabase.find(a => a.id === 'apt-2');
    const apt4 = mockDatabase.find(a => a.id === 'apt-4');
    const apt5 = mockDatabase.find(a => a.id === 'apt-5');

    expect(apt1?.status).toBe('confirmed');
    expect(apt2?.status).toBe('confirmed');
    expect(apt4?.status).toBe('confirmed');
    expect(apt5?.status).toBe('confirmed');
  });

  it('GIVEN 5 appointments, WHEN citizen action cancelAppointment is called for 1, THEN only that 1 is cancelled', async () => {
    const result = await cancelAppointment('apt-1');
    expect(result.success).toBe(true);

    expect(mockDatabase.find(a => a.id === 'apt-1')?.status).toBe('cancelled');
    expect(mockDatabase.find(a => a.id === 'apt-2')?.status).toBe('confirmed');
    expect(mockDatabase.find(a => a.id === 'apt-3')?.status).toBe('confirmed');
    expect(mockDatabase.find(a => a.id === 'apt-4')?.status).toBe('confirmed');
    expect(mockDatabase.find(a => a.id === 'apt-5')?.status).toBe('confirmed');
  });

  it('GIVEN invalid, empty or undefined IDs, WHEN calling cancellation/confirmation, THEN it fails fast and safely without modifying data', async () => {
    const resEmpty = await adminUpdateAppointmentStatus('', 'cancelled');
    expect(resEmpty.success).toBe(false);

    const resUndefined = await adminUpdateAppointmentStatus('undefined', 'cancelled');
    expect(resUndefined.success).toBe(false);

    const resCitizenEmpty = await cancelAppointment('');
    expect(resCitizenEmpty.success).toBe(false);

    // All 5 appointments must remain confirmed
    expect(mockDatabase.every(a => a.status === 'confirmed')).toBe(true);
  });

  it('GIVEN an appointment, WHEN confirming attendance, THEN status becomes completed for ONLY that appointment', async () => {
    const result = await adminConfirmAttendance('apt-4');
    expect(result.success).toBe(true);

    expect(mockDatabase.find(a => a.id === 'apt-4')?.status).toBe('completed');
    expect(mockDatabase.find(a => a.id === 'apt-1')?.status).toBe('confirmed');
    expect(mockDatabase.find(a => a.id === 'apt-2')?.status).toBe('confirmed');
    expect(mockDatabase.find(a => a.id === 'apt-3')?.status).toBe('confirmed');
    expect(mockDatabase.find(a => a.id === 'apt-5')?.status).toBe('confirmed');
  });

  it('GIVEN mock query builder with chained .update().eq(), THEN it only updates records matching eq filter, leaving other records intact', async () => {
    // Calling update on apt-2
    const res = await adminUpdateAppointmentStatus('apt-2', 'cancelled');
    expect(res.success).toBe(true);

    expect(mockDatabase.find(a => a.id === 'apt-2')?.status).toBe('cancelled');
    expect(mockDatabase.find(a => a.id === 'apt-1')?.status).toBe('confirmed');
    expect(mockDatabase.find(a => a.id === 'apt-3')?.status).toBe('confirmed');
    expect(mockDatabase.find(a => a.id === 'apt-4')?.status).toBe('confirmed');
    expect(mockDatabase.find(a => a.id === 'apt-5')?.status).toBe('confirmed');
  });

  it('GIVEN 5 appointments in active state, WHEN cancelling 1, THEN filtering out only cancelled leaves 4 active items and never empties to 0', () => {
    const list = [...mockDatabase];
    const targetId = 'apt-1';
    const updatedList = list.map(a => a.id === targetId ? { ...a, status: 'cancelled' } : a);
    const activeList = updatedList.filter(a => a.status !== 'cancelled' && a.status !== 'completed');

    expect(activeList.length).toBe(4);
    expect(activeList.some(a => a.id === 'apt-2')).toBe(true);
    expect(activeList.some(a => a.id === 'apt-3')).toBe(true);
    expect(activeList.some(a => a.id === 'apt-4')).toBe(true);
    expect(activeList.some(a => a.id === 'apt-5')).toBe(true);
    expect(activeList.some(a => a.id === 'apt-1')).toBe(false);
  });
});

describe('Controle de Atendimento & Overdue Detection Unit Logic', () => {
  it('correctly marks past appointments as overdue when status is confirmed or scheduled', () => {
    // Past date (e.g. 2020-01-01)
    const overdueWeekly = isAppointmentOverdue('2020-01-01', '08:00');
    expect(overdueWeekly).toBe(true);

    const overdueTable = isOverdue('2020-01-01', '08:00', 'confirmed');
    expect(overdueTable).toBe(true);
  });

  it('does NOT mark future appointments as overdue', () => {
    // Future date (e.g. 2099-12-31)
    const overdueWeekly = isAppointmentOverdue('2099-12-31', '14:00');
    expect(overdueWeekly).toBe(false);

    const overdueTable = isOverdue('2099-12-31', '14:00', 'confirmed');
    expect(overdueTable).toBe(false);
  });

  it('does NOT mark completed or cancelled appointments as overdue even if scheduled time was in the past', () => {
    const completedOverdue = isOverdue('2020-01-01', '08:00', 'completed');
    expect(completedOverdue).toBe(false);

    const cancelledOverdue = isOverdue('2020-01-01', '08:00', 'cancelled');
    expect(cancelledOverdue).toBe(false);
  });
});

