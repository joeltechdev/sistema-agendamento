import { z } from 'zod';
import { generateTimeSlots } from '@/services/availabilityService';

describe('Validation Unit Tests (Simplified Form without CPF, with Sexo)', () => {
  const phoneSchema = z.string().min(10, 'Telefone inválido.').max(20, 'Telefone inválido.');
  const nameSchema = z.string().min(3, 'Nome incompleto.');
  const sexoSchema = z.preprocess(
    (val) => (typeof val === 'string' && val.trim().length > 0 ? val.trim() : ''),
    z.string()
      .min(1, 'Selecione o sexo')
      .refine(val => ['Masculino', 'Feminino', 'Outro / Não informado', 'Prefiro não informar', 'Outro', 'M', 'F'].includes(val), {
        message: 'Selecione o sexo'
      })
  );

  it('Deve rejeitar telefones muito curtos', () => {
    const result = phoneSchema.safeParse('12345');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Telefone inválido.');
    }
  });

  it('Deve aceitar telefones formatados corretamente', () => {
    expect(phoneSchema.safeParse('(11) 98765-4321').success).toBe(true);
    expect(phoneSchema.safeParse('88999998888').success).toBe(true);
  });

  it('Deve validar nomes com pelo menos 3 caracteres', () => {
    expect(nameSchema.safeParse('Jo').success).toBe(false);
    expect(nameSchema.safeParse('João Silva').success).toBe(true);
  });

  it('Deve exigir o campo sexo e rejeitar valores vazios ou inválidos', () => {
    expect(sexoSchema.safeParse('').success).toBe(false);
    expect(sexoSchema.safeParse(undefined).success).toBe(false);
    expect(sexoSchema.safeParse('Invalido').success).toBe(false);
    expect(sexoSchema.safeParse('Masculino').success).toBe(true);
    expect(sexoSchema.safeParse('Feminino').success).toBe(true);
    expect(sexoSchema.safeParse('Outro / Não informado').success).toBe(true);
  });
});

describe('Availability TimeSlots Constraints', () => {
  it('Não deve gerar slots durante o horário de almoço (12:30 - 13:30)', () => {
    // Simulando a configuração do banco
    const mockHours = [
      { start_time: '08:00:00', end_time: '12:30:00' },
      { start_time: '13:30:00', end_time: '17:00:00' }
    ];
    
    // Segunda-feira
    const testDate = new Date('2026-09-14T12:00:00Z');
    
    // Gerando com slots de 30 minutos
    const slots = generateTimeSlots(testDate, mockHours, [], 30, false, false);
    
    expect(slots).toContain('08:00');
    expect(slots).toContain('12:00');
    expect(slots).toContain('13:30');
    expect(slots).toContain('16:30');
    expect(slots).not.toContain('12:30');
    expect(slots).not.toContain('13:00');
  });
});
