import { createBooking } from '@/app/actions/booking';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

jest.mock('@/lib/rateLimit', () => ({
  rateLimit: jest.fn().mockReturnValue(true)
}));

// Vamos mockar o módulo do supabase
jest.mock('@/lib/supabase/server', () => {
  let appointments: string[] = []; // armazena chaves "data-horario"
  let appointmentCount = 0; // limite de 200

  return {
    createClient: jest.fn().mockImplementation(async () => {
      return {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'mock-uuid' } } }),
        },
        rpc: jest.fn().mockImplementation(async (rpcName, args) => {
          if (rpcName === 'book_appointment') {
            // Simulando um delay de rede/banco para testar race conditions realistas
            await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

            // Simula o LOCK do PostgreSQL e Unique Constraints
            const slotKey = `${args.p_appointment_date}-${args.p_appointment_time}`;
            
            if (appointmentCount >= 200) {
              return { data: null, error: { message: 'MONTHLY_LIMIT_REACHED' } };
            }

            if (appointments.includes(slotKey)) {
              return { data: null, error: { message: 'SLOT_ALREADY_TAKEN' } };
            }

            appointments.push(slotKey);
            appointmentCount++;

            return {
              data: {
                success: true,
                appointment_id: 'new-uuid',
                protocol: '20260916MOCK'
              },
              error: null
            };
          }
          return { data: null, error: null };
        }),
        from: jest.fn().mockImplementation((table: string) => ({
          select: jest.fn().mockImplementation((cols: string) => ({
            eq: jest.fn().mockImplementation((col: string, val: string) => ({
              eq: jest.fn().mockImplementation(() => ({
                neq: jest.fn().mockResolvedValue({ data: [] })
              })),
              neq: jest.fn().mockResolvedValue({ data: [] }),
              single: jest.fn().mockResolvedValue({ data: { id: 'service-1' } })
            })),
            limit: jest.fn().mockImplementation(() => ({
              single: jest.fn().mockResolvedValue({ data: { id: 'service-1' } })
            }))
          })),
          insert: jest.fn().mockImplementation((payload: any) => ({
            select: jest.fn().mockImplementation(() => ({
              single: jest.fn().mockResolvedValue({
                data: { id: 'walkin-uuid', protocol_number: 'PRES-20260925-TEST' },
                error: null
              })
            }))
          })),
          update: jest.fn().mockImplementation(() => ({
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      };
    })
  };
});

describe('Booking Action Integration & Concurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createFakeFormData = (data: Record<string, string>) => {
    return {
      forEach: (cb: (val: string, key: string) => void) => {
        Object.entries(data).forEach(([k, v]) => cb(v, k));
      },
      get: (k: string) => data[k]
    } as unknown as FormData;
  };

  const validFormData = createFakeFormData({
    service_id: '123e4567-e89b-12d3-a456-426614174000',
    appointment_date: '2026-09-20',
    appointment_time: '10:00',
    appointment_type: 'first_issue',
    full_name: 'João Silva',
    phone: '11999999999',
    sexo: 'Masculino',
    address: 'Rua Principal, 100'
  });

  it('deve realizar um agendamento de 1ª via com sucesso sem exigir CPF', async () => {
    const result = await createBooking(undefined, validFormData);
    expect(result?.success).toBe(true);
    expect(result?.protocol).toBeDefined();
  });

  it('deve realizar um agendamento de 2ª via com sucesso e normalizar variações de tipo', async () => {
    const secondIssueForm = createFakeFormData({
      service_id: '123e4567-e89b-12d3-a456-426614174000',
      appointment_date: '2026-09-22',
      appointment_time: '11:00',
      appointment_type: '2ª Via RG',
      full_name: 'Carlos Eduardo Santos',
      phone: '(11) 91234-5678',
      sexo: 'Masculino',
      address: 'Av. Central, 500'
    });
    const result = await createBooking(undefined, secondIssueForm);
    expect(result?.success).toBe(true);
    expect(result?.protocol).toBeDefined();
  });

  it('deve rejeitar se o sexo não for informado no agendamento online', async () => {
    const noSexoForm = createFakeFormData({
      service_id: '123e4567-e89b-12d3-a456-426614174000',
      appointment_date: '2026-09-20',
      appointment_time: '10:00',
      appointment_type: 'first_issue',
      full_name: 'João Silva',
      phone: '11999999999'
      // sexo omitido
    });
    const result = await createBooking(undefined, noSexoForm);
    expect(result?.error).toContain('Selecione o sexo');
  });

  it('deve rejeitar se o telefone for inválido', async () => {
    const invalidForm = createFakeFormData({
      service_id: '123e4567-e89b-12d3-a456-426614174000',
      appointment_date: '2026-09-20',
      appointment_time: '10:00',
      appointment_type: 'first_issue',
      full_name: 'João Silva',
      phone: '123', // Telefone inválido (menos de 10 dígitos)
      sexo: 'Masculino'
    });
    const result = await createBooking(undefined, invalidForm);
    expect(result?.error).toContain('Telefone inválido');
  });

  it('deve impedir que duas reservas simultâneas peguem a mesma vaga (Race Condition Realista)', async () => {
    const formA = createFakeFormData({
      service_id: '123e4567-e89b-12d3-a456-426614174000',
      appointment_date: '2026-10-10',
      appointment_time: '14:00',
      appointment_type: 'first_issue',
      full_name: 'João',
      cpf: '12345678901',
      phone: '11999999999',
      sexo: 'Masculino'
    });

    const formB = createFakeFormData({
      service_id: '123e4567-e89b-12d3-a456-426614174000',
      appointment_date: '2026-10-10',
      appointment_time: '14:00',
      appointment_type: 'second_issue',
      full_name: 'Maria',
      cpf: '10987654321',
      phone: '11888888888',
      sexo: 'Feminino'
    });

    // Dispara EXATAMENTE ao mesmo tempo para o servidor
    const [resultA, resultB] = await Promise.all([
      createBooking(undefined, formA),
      createBooking(undefined, formB)
    ]);

    // Apenas um pode dar sucesso, o outro deve receber SLOT_ALREADY_TAKEN
    const successCount = [resultA, resultB].filter(r => r?.success).length;
    const errorCount = [resultA, resultB].filter(r => r?.error?.includes('ocupado')).length;

    expect(successCount).toBe(1);
    expect(errorCount).toBe(1);
  });

  it('deve realizar um agendamento presencial (walk-in) com sucesso via createWalkInBooking', async () => {
    const { createWalkInBooking } = await import('@/app/actions/booking');
    const result = await createWalkInBooking({
      appointment_date: '2026-09-25',
      appointment_time: '09:00',
      appointment_type: '1ª Via RG',
      full_name: 'Francisco Alves de Souza',
      phone: '(88) 98888-7777',
      sexo: 'Masculino',
      address: 'Rua das Flores, 45'
    });

    expect(result.success).toBe(true);
    expect(result.protocol).toBeDefined();
    expect(result.protocol).toContain('PRES-');
  });

  it('deve rejeitar agendamento presencial sem campo sexo', async () => {
    const { createWalkInBooking } = await import('@/app/actions/booking');
    const result = await createWalkInBooking({
      appointment_date: '2026-09-25',
      appointment_time: '09:00',
      appointment_type: '1ª Via RG',
      full_name: 'Francisco Alves de Souza',
      phone: '(88) 98888-7777',
      sexo: ''
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Selecione o sexo');
  });
});
