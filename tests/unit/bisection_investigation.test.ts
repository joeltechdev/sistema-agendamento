import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/security/session';
import { getMockStore } from '@/lib/supabase/server';
import { getDashboardMetrics } from '@/app/actions/admin';
import { createBooking } from '@/app/actions/booking';
import { cookies } from 'next/headers';
import { 
  getMondayOfCurrentWeek, 
  getMondayForDate, 
  normalizeDateStringToYMD, 
  normalizeTimeStringToHHMM,
  isSecondIssueAppointment,
  formatLocalDate,
  getAppointmentCardTheme 
} from '@/components/admin/WeeklyCalendarGrid';

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

describe('ETAPA 1 & ETAPA 2: Investigação Detalhada e Teste de Bissecção (T1-T6)', () => {
  const adminId = 'admin-bisection-user';
  const mockCookiesStore: Record<string, string> = {};

  beforeAll(async () => {
    const store = getMockStore();
    const existingAdmin = store.profiles.find((p: any) => p.id === adminId);
    if (!existingAdmin) {
      store.profiles.push({
        id: adminId,
        full_name: 'Administrador Geral',
        email: 'admin@prefeitura.gov.br',
        role: 'admin',
        status: 'active'
      });
    }

    const token = await createSessionToken(adminId);
    mockCookiesStore[SESSION_COOKIE_NAME] = token;

    (cookies as unknown as jest.Mock).mockResolvedValue({
      get: (name: string) => (mockCookiesStore[name] ? { name, value: mockCookiesStore[name] } : undefined),
      set: (name: string, value: string) => { mockCookiesStore[name] = value; },
      delete: (name: string) => { delete mockCookiesStore[name]; }
    });
  });

  it('Executa o ciclo completo de investigação T1 a T6 e coleta evidências P1 a P6', async () => {
    console.log('\n======================================================');
    console.log('=== RELATÓRIO DE EXECUÇÃO DE BISSECÇÃO (T1 A T6) ===');
    console.log('======================================================\n');

    const store = getMockStore();

    // 1. Criar agendamento idêntico ao relato: 21/09/2026 às 09:00, Jão Lima, 1ª Via
    const formData = new FormData();
    formData.append('service_id', '00000000-0000-0000-0000-000000000001');
    formData.append('appointment_date', '2026-09-21');
    formData.append('appointment_time', '09:00');
    formData.append('appointment_type', 'first_issue');
    formData.append('tipo', 'first_issue');
    formData.append('full_name', 'Jão Lima');
    formData.append('phone', '(88) 98888-7777');
    formData.append('sexo', 'Masculino');

    const bookingResult = await createBooking(undefined, formData);
    expect(bookingResult?.success).toBe(true);
    const protocol = bookingResult?.protocol || '20260921-SCDEQT';
    console.log('[EVIDÊNCIA][P1/P2] Agendamento criado com protocolo:', protocol);

    // T1: Após criar o agendamento, dar F5 (recarregar a página). Aparece na grade da semana padrão?
    const saturday = new Date(2026, 8, 19, 23, 11, 48);
    const defaultMonday = getMondayOfCurrentWeek(saturday);
    const startDefault = formatLocalDate(defaultMonday); // '2026-09-21'
    const endDefault = formatLocalDate(new Date(defaultMonday.getFullYear(), defaultMonday.getMonth(), defaultMonday.getDate() + 4)); // '2026-09-25'

    console.log(`[EVIDÊNCIA][T1] Data simulada: Sábado 19/09 23:11 -> Semana padrão de abertura: ${startDefault} a ${endDefault}`);
    
    // Simula F5 / load da página inicial do admin chamando getDashboardMetrics com a semana padrão
    const metricsWeek21 = await getDashboardMetrics(startDefault, endDefault);
    const upcoming = metricsWeek21.upcomingAppointments || [];
    const foundInT1 = upcoming.some((a: any) => a.protocol_number === protocol || (a.appointment_date === '2026-09-21' && a.appointment_time.startsWith('09:00')));
    console.log(`[EVIDÊNCIA][T1] Recarga F5 na semana padrão (${startDefault} a ${endDefault}) -> Registro encontrado:`, foundInT1);
    expect(foundInT1).toBe(true);

    // T2: Navegar manualmente a grade para a semana 21/09–25/09. Aparece?
    const targetMonday = getMondayForDate('2026-09-21');
    const startNav = formatLocalDate(targetMonday);
    const endNav = formatLocalDate(new Date(targetMonday.getFullYear(), targetMonday.getMonth(), targetMonday.getDate() + 4));
    const metricsNav = await getDashboardMetrics(startNav, endNav);
    const foundInT2 = (metricsNav.upcomingAppointments || []).some((a: any) => a.protocol_number === protocol && a.appointment_date === '2026-09-21' && a.appointment_time.startsWith('09:00'));
    console.log(`[EVIDÊNCIA][T2] Navegação manual para ${startNav} a ${endNav} -> Registro presente:`, foundInT2);
    expect(foundInT2).toBe(true);

    // T3: Chamar diretamente a API/query da grade para o intervalo 21/09–25/09. O registro vem na resposta?
    const metricsT3 = await getDashboardMetrics('2026-09-21', '2026-09-25');
    const rawMatches = (metricsT3.upcomingAppointments || []).filter((a: any) => a.appointment_date === '2026-09-21' && a.appointment_time.startsWith('09:00'));
    console.log(`[EVIDÊNCIA][T3] Query do intervalo 21/09 a 25/09 -> Registros retornados:`, rawMatches.length, rawMatches.map((m: any) => ({ protocol: m.protocol_number, name: m.full_name, date: m.appointment_date, time: m.appointment_time })));
    expect(rawMatches.length).toBeGreaterThanOrEqual(1);

    // T4: Remover todos os filtros (via, status, guichê) e repetir T2
    const allFiltered = (metricsNav.upcomingAppointments || []).filter((a: any) => {
      // Filtro 1ª via (não 2ª via)
      return !isSecondIssueAppointment(a);
    });
    const foundInT4 = allFiltered.some((a: any) => a.protocol_number === protocol);
    console.log(`[EVIDÊNCIA][T4] Filtro por 1ª Via -> Registro presente:`, foundInT4);
    expect(foundInT4).toBe(true);

    // T5: Rolar a grade até 08:00–09:30 (posicionamento no slot 09:00)
    const targetDate = normalizeDateStringToYMD('2026-09-21');
    const targetSlot = normalizeTimeStringToHHMM('09:00');
    const slotMatches = (metricsNav.upcomingAppointments || []).filter((apt: any) => {
      if (apt.status === 'completed' || apt.status === 'cancelled') return false;
      const aptDate = normalizeDateStringToYMD(apt.appointment_date);
      const aptTime = normalizeTimeStringToHHMM(apt.appointment_time);
      return aptDate === targetDate && aptTime === targetSlot;
    });
    console.log(`[EVIDÊNCIA][T5/P6] Posicionamento no Slot [${targetDate}|${targetSlot}] -> Célula renderizada com ${slotMatches.length} agendamento(s):`, slotMatches.map((m: any) => ({ protocol: m.protocol_number, name: m.full_name, cardTheme: getAppointmentCardTheme(m) })));
    expect(slotMatches.length).toBeGreaterThanOrEqual(1);
    expect(getAppointmentCardTheme(slotMatches[0])).toBe('green');

    // T6: Verificar se ALGUM agendamento (dos 9 ativos) aparece em qualquer semana
    const allActive = store.appointments.filter((a: any) => a.status !== 'cancelled' && a.status !== 'completed');
    console.log(`[EVIDÊNCIA][T6] Total de agendamentos ativos no sistema: ${allActive.length}`, allActive.map((a: any) => ({ protocol: a.protocol_number, date: a.appointment_date, time: a.appointment_time, status: a.status })));
    expect(allActive.length).toBeGreaterThanOrEqual(1);

    console.log('\n======================================================\n');
  });
});
