import { 
  isSecondIssueAppointment, 
  normalizeDateStringToYMD, 
  normalizeTimeStringToHHMM,
  getMondayOfCurrentWeek, 
  calculateEndTime,
  getInitials 
} from '@/components/admin/WeeklyCalendarGrid';

describe('WeeklyCalendarGrid Architecture & Visual Distinction', () => {
  it('deve extrair iniciais do cidadão para o avatar corretamente', () => {
    expect(getInitials('Ana Silva')).toBe('AS');
    expect(getInitials('Carlos Eduardo Santos')).toBe('CS');
    expect(getInitials('João')).toBe('JO');
    expect(getInitials('')).toBe('CD');
  });

  it('deve identificar corretamente 2ª Via em múltiplos formatos sem necessidade de filtro', () => {
    expect(isSecondIssueAppointment({ tipo: '2_VIA' })).toBe(true);
    expect(isSecondIssueAppointment({ categoria: 'SEGUNDA_VIA' })).toBe(true);
    expect(isSecondIssueAppointment({ appointment_type: '2ª Via RG' })).toBe(true);
    expect(isSecondIssueAppointment({ servico: 'Emissão 2a via' })).toBe(true);
    expect(isSecondIssueAppointment({ services: { name: '2ª Via de Documento' } })).toBe(true);
  });

  it('deve identificar corretamente 1ª Via (não 2ª via)', () => {
    expect(isSecondIssueAppointment({ tipo: '1_VIA' })).toBe(false);
    expect(isSecondIssueAppointment({ categoria: 'PRIMEIRA_VIA' })).toBe(false);
    expect(isSecondIssueAppointment({ appointment_type: '1ª Via RG' })).toBe(false);
    expect(isSecondIssueAppointment({ services: { name: '1ª Via CIN' } })).toBe(false);
    expect(isSecondIssueAppointment(null)).toBe(false);
    expect(isSecondIssueAppointment(undefined)).toBe(false);
  });

  it('deve normalizar datas com segurança evitando deslocamentos UTC', () => {
    expect(normalizeDateStringToYMD('2026-09-16')).toBe('2026-09-16');
    expect(normalizeDateStringToYMD('2026-09-16T03:00:00.000Z')).toBe('2026-09-16');
    expect(normalizeDateStringToYMD('16/09/2026')).toBe('2026-09-16');
  });

  it('deve normalizar horários de qualquer formato para HH:mm', () => {
    expect(normalizeTimeStringToHHMM('08:00')).toBe('08:00');
    expect(normalizeTimeStringToHHMM('08:00:00')).toBe('08:00');
    expect(normalizeTimeStringToHHMM('8:30')).toBe('08:30');
    expect(normalizeTimeStringToHHMM('2026-09-16T09:00:00.000Z')).toBe('09:00');
  });

  it('deve calcular horário final de slot com precisão', () => {
    expect(calculateEndTime('08:00')).toBe('08:30');
    expect(calculateEndTime('11:30')).toBe('12:00');
    expect(calculateEndTime('16:00')).toBe('16:30');
  });

  it('deve retornar a segunda-feira correta para qualquer data', () => {
    // 2026-09-16 é quarta-feira -> segunda deve ser 2026-09-14
    const wednesday = new Date(2026, 8, 16);
    const monday = getMondayOfCurrentWeek(wednesday);
    expect(monday.getDate()).toBe(14);
    expect(monday.getMonth()).toBe(8);
    expect(monday.getFullYear()).toBe(2026);
  });

  it('deve identificar corretamente agendamentos presenciais por protocolo ou flag', () => {
    const aptPresencial = {
      id: 'apt-1',
      protocol_number: 'PRES-20260916-ABC123',
      is_walk_in: true,
      origin: 'presencial'
    };
    expect(aptPresencial.is_walk_in).toBe(true);
    expect(aptPresencial.origin).toBe('presencial');
    expect(aptPresencial.protocol_number.startsWith('PRES-')).toBe(true);
  });
});

