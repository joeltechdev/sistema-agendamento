export interface WorkingHour {
  start_time: string; // 'HH:mm:ss'
  end_time: string; // 'HH:mm:ss'
}

export interface Appointment {
  appointment_time: string; // 'HH:mm:ss'
}

export function generateTimeSlots(
  date: Date,
  workingHours: WorkingHour[],
  appointments: Appointment[],
  durationMinutes: number,
  isHoliday: boolean,
  isBlockedDate: boolean
): string[] {
  // 1. Regras absolutas: Fim de semana, Feriados e Datas Bloqueadas
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday || isBlockedDate) {
    return [];
  }

  const availableSlots: string[] = [];
  const occupiedTimes = new Set(appointments.map(a => a.appointment_time));

  // Função auxiliar para converter 'HH:mm:ss' para minutos desde a meia-noite
  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Função auxiliar para converter minutos para 'HH:mm:ss'
  const minutesToTime = (mins: number) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}:00`;
  };

  // 2. Processar os turnos de trabalho (Trata automaticamente o intervalo de almoço)
  workingHours.forEach(shift => {
    const startMins = timeToMinutes(shift.start_time);
    const endMins = timeToMinutes(shift.end_time);

    let currentMins = startMins;

    // Enquanto o slot couber dentro do turno
    while (currentMins + durationMinutes <= endMins) {
      const timeStr = minutesToTime(currentMins);
      
      // 3. Checa se o horário não está ocupado
      if (!occupiedTimes.has(timeStr)) {
        // Formata para exibição 'HH:mm'
        const [h, m] = timeStr.split(':');
        availableSlots.push(`${h}:${m}`);
      }

      currentMins += durationMinutes;
    }
  });

  return availableSlots;
}

// Wrapper para banco de dados
import { createClient } from '@/lib/supabase/server'

export async function getAvailableSlotsForDate(dateStr: string, serviceDuration: number): Promise<string[]> {
  const date = new Date(`${dateStr}T12:00:00Z`); // Previne timezone offset
  const supabase = await createClient();

  // 1. Feriados e Datas Bloqueadas
  const { data: holidays } = await supabase
    .from('holidays')
    .select('id')
    .eq('holiday_date', dateStr)
    .single();

  const { data: blockedDates } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('blocked_date', dateStr)
    .single();

  const isHoliday = !!holidays;
  const isBlocked = !!blockedDates;

  // 2. Working Hours
  const { data: workingHoursData } = await supabase
    .from('working_hours')
    .select('start_time, end_time')
    .eq('day_of_week', date.getDay())
    .eq('is_active', true);

  const workingHours = (workingHoursData || []) as WorkingHour[];

  // 3. Appointments
  const { data: appointmentsData } = await supabase
    .from('appointments')
    .select('appointment_time')
    .eq('appointment_date', dateStr)
    .not('status', 'eq', 'cancelled');

  const appointments = (appointmentsData || []) as Appointment[];

  return generateTimeSlots(date, workingHours, appointments, serviceDuration, isHoliday, isBlocked);
}
