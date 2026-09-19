import { getMondayOfCurrentWeek, normalizeDateStringToYMD, normalizeTimeStringToHHMM } from '@/components/admin/WeeklyCalendarGrid';
import { getMockStore, resetMockStoreAppointments } from '@/lib/supabase/server';
import { getDashboardMetrics } from '@/app/actions/admin';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/security/session';
import { cookies } from 'next/headers';

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

describe('Regressão Grade Semanal: Exibição de Agendamentos Ativos com Sessão Válida', () => {
  const mockCookiesStore: Record<string, string> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockCookiesStore).forEach(k => delete mockCookiesStore[k]);
    resetMockStoreAppointments();

    (cookies as unknown as jest.Mock).mockResolvedValue({
      get: (name: string) => (mockCookiesStore[name] ? { name, value: mockCookiesStore[name] } : undefined),
      set: (name: string, value: string) => { mockCookiesStore[name] = value; },
      delete: (name: string) => { delete mockCookiesStore[name]; }
    });
  });

  it('1. Deve ancorar agendamentos ativos nos dias úteis da semana atual mesmo quando o servidor roda no fim de semana', () => {
    // Simula data em um Sábado (ex: 19/09/2026)
    const saturday = new Date(2026, 8, 19, 10, 0, 0); // 19 de Setembro de 2026 (Sábado)
    const monday = getMondayOfCurrentWeek(saturday);
    
    expect(monday.getDate()).toBe(14);
    expect(monday.getMonth()).toBe(8); // Setembro (0-indexed 8)
    expect(monday.getFullYear()).toBe(2026);

    const weekDays: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      weekDays.push(`${y}-${m}-${day}`);
    }

    expect(weekDays).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18'
    ]);

    const store = getMockStore();
    const activeAppointments = store.appointments.filter(
      (apt: { status: string; appointment_date: string }) => 
        apt.status !== 'completed' && apt.status !== 'cancelled'
    );

    // Deve haver agendamentos ativos caindo dentro dos 5 dias úteis da semana atual exibida (14/09 a 18/09)
    const appointmentsInDisplayedWeek = activeAppointments.filter(
      (apt: { appointment_date: string }) => weekDays.includes(apt.appointment_date)
    );

    expect(appointmentsInDisplayedWeek.length).toBeGreaterThanOrEqual(2);
  });

  it('2. Com sessão válida de ATENDENTE, deve retornar agendamentos ativos na action getDashboardMetrics', async () => {
    const store = getMockStore();
    
    // Assegura perfil de atendente no mock store
    const attendantProfile = {
      id: 'attendant-user-1',
      role: 'atendente',
      full_name: 'Atendente Operacional',
      email: 'atendente@prefeitura.gov.br',
      status: 'active'
    };
    
    const existingIndex = store.profiles.findIndex((p: { id: string }) => p.id === attendantProfile.id);
    if (existingIndex >= 0) {
      store.profiles[existingIndex] = attendantProfile;
    } else {
      store.profiles.push(attendantProfile);
    }

    // Assina token de sessão JWT válido para o atendente
    const token = await createSessionToken(attendantProfile.id);

    mockCookiesStore[SESSION_COOKIE_NAME] = token;

    const metrics = await getDashboardMetrics();
    expect(metrics).toBeDefined();
    expect(Array.isArray(metrics.upcomingAppointments)).toBe(true);
    expect(metrics.upcomingAppointments.length).toBeGreaterThan(0);

    // Deve conter agendamentos ativos de 1ª e 2ª via
    interface DashboardAppointmentItem {
      tipo?: string
      appointment_type?: string
      status?: string
      id?: string
      appointment_date?: string
      appointment_time?: string
      date?: string
      start_time?: string
    }

    const firstIssue = (metrics.upcomingAppointments as DashboardAppointmentItem[]).some(
      a => a.tipo === 'PRIMEIRA_VIA' || a.appointment_type === 'first_issue'
    );
    const secondIssue = (metrics.upcomingAppointments as DashboardAppointmentItem[]).some(
      a => a.tipo === 'SEGUNDA_VIA' || a.appointment_type === 'second_issue'
    );
    expect(firstIssue).toBe(true);
    expect(secondIssue).toBe(true);
  });

  it('3. Com sessão válida de ADMIN, deve retornar métricas e agendamentos', async () => {
    const store = getMockStore();
    
    const adminProfile = {
      id: 'admin-user-1',
      role: 'admin',
      full_name: 'Administrador Geral',
      email: 'admin.geral@prefeitura.gov.br',
      status: 'active'
    };

    const existingIndex = store.profiles.findIndex((p: { id: string }) => p.id === adminProfile.id);
    if (existingIndex >= 0) {
      store.profiles[existingIndex] = adminProfile;
    } else {
      store.profiles.push(adminProfile);
    }

    const token = await createSessionToken(adminProfile.id);

    mockCookiesStore[SESSION_COOKIE_NAME] = token;

    const metrics = await getDashboardMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.upcomingAppointments.length).toBeGreaterThan(0);
  });

  it('4. Sem sessão autenticada (401), getDashboardMetrics deve rejeitar com erro de autenticação', async () => {
    // Sem cookies de sessão
    delete mockCookiesStore[SESSION_COOKIE_NAME];

    await expect(getDashboardMetrics()).rejects.toThrow('Não autenticado');
  });

  it('5. Slot Matcher da grade semanal deve posicionar os agendamentos no dia e horário exatos', () => {
    interface TestAppointmentItem {
      id: string
      status: string
      appointment_date?: string
      appointment_time?: string
      date?: string
      start_time?: string
    }

    const store = getMockStore();
    const apts = store.appointments as TestAppointmentItem[];

    // Função exata de matching do WeeklyCalendarGrid
    const getAppointmentsForSlot = (appointmentsList: TestAppointmentItem[], dateStr: string, slotStr: string) => {
      const targetDate = normalizeDateStringToYMD(dateStr);
      const targetSlot = normalizeTimeStringToHHMM(slotStr);

      return appointmentsList.filter(apt => {
        if (apt.status === 'completed' || apt.status === 'cancelled') return false;
        const rawDate = apt.appointment_date || apt.date;
        const aptDate = normalizeDateStringToYMD(rawDate);
        if (aptDate !== targetDate) return false;

        const rawTime = apt.appointment_time || apt.start_time || '';
        const aptTime = normalizeTimeStringToHHMM(rawTime);
        return aptTime === targetSlot;
      });
    };

    // Testa se para cada agendamento ativo, ele é encontrado em seu slot específico
    const active = apts.filter(a => a.status === 'confirmed');
    expect(active.length).toBeGreaterThan(0);

    const firstActive = active[0];
    const matched = getAppointmentsForSlot(apts, firstActive.appointment_date || '', firstActive.appointment_time || '');
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched.some(m => m.id === firstActive.id)).toBe(true);
  });
});
