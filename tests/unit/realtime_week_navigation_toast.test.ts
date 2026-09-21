import { 
  getMondayOfCurrentWeek, 
  getMondayForDate, 
  normalizeDateStringToYMD, 
  normalizeTimeStringToHHMM,
  isSecondIssueAppointment,
  formatLocalDate,
  getAppointmentCardTheme,
  Appointment
} from '@/components/admin/WeeklyCalendarGrid';

describe('Realtime Week Navigation, Toast Deduplication & Timezone Safeguards', () => {
  describe('1. Regra da Semana Padrão no Fim de Semana vs Dias Úteis', () => {
    it('Sábado (19/09/2026) deve abrir a grade na próxima Segunda-feira útil (21/09/2026)', () => {
      const saturday = new Date(2026, 8, 19, 23, 11, 48); // Sábado 19/09 às 23:11
      const monday = getMondayOfCurrentWeek(saturday);
      
      expect(formatLocalDate(monday)).toBe('2026-09-21');
      expect(monday.getDay()).toBe(1); // Segunda
    });

    it('Domingo (20/09/2026) deve abrir a grade na próxima Segunda-feira útil (21/09/2026)', () => {
      const sunday = new Date(2026, 8, 20, 14, 0, 0); // Domingo 20/09
      const monday = getMondayOfCurrentWeek(sunday);
      
      expect(formatLocalDate(monday)).toBe('2026-09-21');
      expect(monday.getDay()).toBe(1); // Segunda
    });

    it('Quarta-feira (16/09/2026) deve abrir a grade na Segunda-feira da semana corrente (14/09/2026)', () => {
      const wednesday = new Date(2026, 8, 16, 10, 30, 0);
      const monday = getMondayOfCurrentWeek(wednesday);
      
      expect(formatLocalDate(monday)).toBe('2026-09-14');
      expect(monday.getDay()).toBe(1); // Segunda
    });

    it('Segunda-feira (21/09/2026) deve manter a própria Segunda-feira (21/09/2026)', () => {
      const mondayInput = new Date(2026, 8, 21, 8, 0, 0);
      const monday = getMondayOfCurrentWeek(mondayInput);
      
      expect(formatLocalDate(monday)).toBe('2026-09-21');
    });

    it('Sexta-feira (25/09/2026) deve manter a Segunda-feira da mesma semana (21/09/2026)', () => {
      const friday = new Date(2026, 8, 25, 17, 0, 0);
      const monday = getMondayOfCurrentWeek(friday);
      
      expect(formatLocalDate(monday)).toBe('2026-09-21');
    });
  });

  describe('2. Navegação para Semana Específica via getMondayForDate', () => {
    it('Deve calcular a Segunda-feira de qualquer data de agendamento alvo para navegação de grade', () => {
      // Agendamento para Segunda 21/09/2026
      expect(formatLocalDate(getMondayForDate('2026-09-21'))).toBe('2026-09-21');
      
      // Agendamento para Quinta 24/09/2026
      expect(formatLocalDate(getMondayForDate('2026-09-24'))).toBe('2026-09-21');

      // Agendamento para Quarta da semana anterior (16/09/2026)
      expect(formatLocalDate(getMondayForDate('2026-09-16'))).toBe('2026-09-14');

      // Agendamento em formato brasileiro DD/MM/YYYY
      expect(formatLocalDate(getMondayForDate('21/09/2026'))).toBe('2026-09-21');
    });
  });

  describe('3. Proteção de Fuso Horário (America/Fortaleza UTC-3 às 23:11)', () => {
    it('formatLocalDate deve retornar o dia civil local 2026-09-19 mesmo às 23:11 (quando UTC já é 20/09)', () => {
      // Simula Date local 19/09/2026 às 23:11:48 (evidência do print)
      const lateNightDate = new Date(2026, 8, 19, 23, 11, 48);
      const formatted = formatLocalDate(lateNightDate);

      expect(formatted).toBe('2026-09-19');
      // Garante que não houve salto para 20/09
      expect(formatted.endsWith('19')).toBe(true);
    });

    it('normalizeDateStringToYMD deve extrair a data correta de strings ISO com offset UTC', () => {
      expect(normalizeDateStringToYMD('2026-09-21')).toBe('2026-09-21');
      expect(normalizeDateStringToYMD('2026-09-21T03:00:00.000Z')).toBe('2026-09-21');
      expect(normalizeDateStringToYMD('2026-09-21 09:00:00')).toBe('2026-09-21');
      expect(normalizeDateStringToYMD('21/09/2026')).toBe('2026-09-21');
    });

    it('normalizeTimeStringToHHMM deve normalizar qualquer formato de hora para slot HH:mm', () => {
      expect(normalizeTimeStringToHHMM('09:00')).toBe('09:00');
      expect(normalizeTimeStringToHHMM('09:00:00')).toBe('09:00');
      expect(normalizeTimeStringToHHMM('9:00')).toBe('09:00');
      expect(normalizeTimeStringToHHMM('2026-09-21T09:00:00Z')).toBe('09:00');
    });
  });

  describe('4. Mapeamento de Slots e Identificação Visual do Agendamento', () => {
    it('Deve posicionar o agendamento 20260921-SCDEQT no slot exato de 21/09/2026 às 09:00', () => {
      const apt: Appointment = {
        id: 'apt-realtime-1',
        protocol_number: '20260921-SCDEQT',
        full_name: 'Jão Lima',
        phone: '(88) 98888-7777',
        appointment_date: '2026-09-21',
        appointment_time: '09:00:00',
        appointment_type: 'first_issue',
        tipo: 'PRIMEIRA_VIA',
        categoria: '1ª Via RG',
        status: 'confirmed',
        attendant: 'Guichê 01 - Dra. Lima'
      };

      const dateMatched = normalizeDateStringToYMD(apt.appointment_date) === '2026-09-21';
      const slotMatched = normalizeTimeStringToHHMM(apt.appointment_time) === '09:00';
      const isSecond = isSecondIssueAppointment(apt);
      const cardTheme = getAppointmentCardTheme(apt);

      expect(dateMatched).toBe(true);
      expect(slotMatched).toBe(true);
      expect(isSecond).toBe(false);
      expect(cardTheme).toBe('green'); // 1ª Via -> Verde
    });

    it('Deve distinguir card 2ª Via (Azul) para agendamentos do Guichê 02', () => {
      const aptSecond: Appointment = {
        id: 'apt-realtime-2',
        protocol_number: '20260921-2VIA99',
        full_name: 'Maria Oliveira',
        phone: '(88) 99999-0000',
        appointment_date: '2026-09-21',
        appointment_time: '09:30:00',
        appointment_type: 'second_issue',
        tipo: 'SEGUNDA_VIA',
        categoria: '2ª Via RG',
        status: 'confirmed',
        attendant: 'Guichê 02 - Dr. Silva'
      };

      expect(isSecondIssueAppointment(aptSecond)).toBe(true);
      expect(getAppointmentCardTheme(aptSecond)).toBe('blue'); // 2ª Via -> Azul
    });
  });

  describe('5. Lógica de Deduplicação Idempotente por Protocolo', () => {
    it('Deve processar apenas a primeira ocorrência do mesmo protocolo e ignorar as subsequentes', () => {
      const processedProtocols = new Map<string, number>();

      const isAlreadyProcessed = (protocol: string, now: number = Date.now()) => {
        if (!protocol) return false;
        const cleanProto = protocol.trim().toUpperCase();
        const lastSeen = processedProtocols.get(cleanProto);
        if (lastSeen && (now - lastSeen < 60000)) {
          return true;
        }
        processedProtocols.set(cleanProto, now);
        return false;
      };

      const protocol = '20260921-SCDEQT';

      // 1ª chegada: SSE
      const firstCall = isAlreadyProcessed(protocol, 1000);
      expect(firstCall).toBe(false); // Processa!

      // 2ª chegada: BroadcastChannel com timestamp ligeiramente diferente
      const secondCall = isAlreadyProcessed(protocol, 1050);
      expect(secondCall).toBe(true); // Ignorado!

      // 3ª chegada: Storage Event
      const thirdCall = isAlreadyProcessed(protocol, 1100);
      expect(thirdCall).toBe(true); // Ignorado!

      // 4ª chegada: Outro protocolo diferente
      const otherCall = isAlreadyProcessed('20260921-OUTRO1', 1200);
      expect(otherCall).toBe(false); // Processa o novo protocolo!
    });
  });
});
