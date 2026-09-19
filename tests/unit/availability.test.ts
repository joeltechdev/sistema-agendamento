import { generateTimeSlots, WorkingHour, Appointment } from '@/services/availabilityService';

describe('Availability Engine', () => {
  const duration = 30;
  
  // Turnos mockados: 08:00-12:30 e 13:30-17:00
  const standardWorkingHours: WorkingHour[] = [
    { start_time: '08:00:00', end_time: '12:30:00' },
    { start_time: '13:30:00', end_time: '17:00:00' }
  ];
  
  const noAppointments: Appointment[] = [];

  it('segunda-feira válida deve retornar os slots corretos', () => {
    const monday = new Date('2026-09-14T12:00:00Z'); // Segunda-feira
    const slots = generateTimeSlots(monday, standardWorkingHours, noAppointments, duration, false, false);
    
    expect(slots.length).toBeGreaterThan(0);
    expect(slots).toContain('08:00');
    expect(slots).toContain('13:30');
    expect(slots).toContain('16:30');
  });

  it('sexta-feira válida deve retornar os slots corretos', () => {
    const friday = new Date('2026-09-18T12:00:00Z'); // Sexta-feira
    const slots = generateTimeSlots(friday, standardWorkingHours, noAppointments, duration, false, false);
    expect(slots.length).toBeGreaterThan(0);
  });

  it('sábado inválido', () => {
    const saturday = new Date('2026-09-19T12:00:00Z');
    const slots = generateTimeSlots(saturday, standardWorkingHours, noAppointments, duration, false, false);
    expect(slots).toHaveLength(0);
  });

  it('domingo inválido', () => {
    const sunday = new Date('2026-09-20T12:00:00Z');
    const slots = generateTimeSlots(sunday, standardWorkingHours, noAppointments, duration, false, false);
    expect(slots).toHaveLength(0);
  });

  it('feriado inválido', () => {
    const monday = new Date('2026-09-14T12:00:00Z');
    const slots = generateTimeSlots(monday, standardWorkingHours, noAppointments, duration, true, false);
    expect(slots).toHaveLength(0);
  });

  it('data bloqueada inválida', () => {
    const monday = new Date('2026-09-14T12:00:00Z');
    const slots = generateTimeSlots(monday, standardWorkingHours, noAppointments, duration, false, true);
    expect(slots).toHaveLength(0);
  });

  it('horário 08:00 válido e horário 12:30 inválido como início', () => {
    const monday = new Date('2026-09-14T12:00:00Z');
    const slots = generateTimeSlots(monday, standardWorkingHours, noAppointments, duration, false, false);
    
    expect(slots).toContain('08:00');
    expect(slots).not.toContain('12:30'); // 12:30 é o fim do turno, não cabe 30 min
  });

  it('horário durante almoço inválido (12:30 a 13:30)', () => {
    const monday = new Date('2026-09-14T12:00:00Z');
    const slots = generateTimeSlots(monday, standardWorkingHours, noAppointments, duration, false, false);
    
    expect(slots).not.toContain('12:30');
    expect(slots).not.toContain('13:00');
    expect(slots).toContain('13:30');
  });

  it('horário 17:00 deve respeitar duração e ser inválido como início', () => {
    const monday = new Date('2026-09-14T12:00:00Z');
    const slots = generateTimeSlots(monday, standardWorkingHours, noAppointments, duration, false, false);
    
    expect(slots).toContain('16:30'); // Último slot válido da tarde
    expect(slots).not.toContain('17:00'); // 17:00 termina o expediente
  });

  it('deve desconsiderar slots ocupados (ocupando 08:00 e 13:30)', () => {
    const monday = new Date('2026-09-14T12:00:00Z');
    const appointments = [{ appointment_time: '08:00:00' }, { appointment_time: '13:30:00' }];
    
    const slots = generateTimeSlots(monday, standardWorkingHours, appointments, duration, false, false);
    
    expect(slots).not.toContain('08:00');
    expect(slots).not.toContain('13:30');
    expect(slots).toContain('08:30'); // O próximo está livre
  });
});
