import { getDashboardMetrics, updateSystemSetting, getAuditLogs, adminCreateUser } from '@/app/actions/admin';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

// Mock behavior control
let mockRole = 'admin';

jest.mock('@/lib/supabase/server', () => {
  return {
    createClient: jest.fn().mockImplementation(async () => {
      return {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
        },
        from: jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            let filterCol: string | null = null;
            let filterVal: any = null;
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockImplementation((col: string, val: any) => {
                filterCol = col;
                filterVal = val;
                return {
                  single: jest.fn().mockImplementation(async () => {
                    if (filterCol === 'email' && filterVal !== 'existente@poranga.ce.gov.br') {
                      return { data: null, error: null };
                    }
                    return { data: { id: filterVal, role: mockRole, email: filterVal }, error: null };
                  })
                };
              }),
              insert: jest.fn().mockResolvedValue({ error: null }),
              single: jest.fn().mockResolvedValue({ data: { role: mockRole }, error: null })
            };
          }
          if (table === 'appointments' || table === 'system_settings' || table === 'audit_logs') {
            return {
              select: jest.fn().mockReturnThis(),
              insert: jest.fn().mockResolvedValue({ error: null }),
              upsert: jest.fn().mockResolvedValue({ error: null }),
              eq: jest.fn().mockReturnThis(),
              neq: jest.fn().mockReturnThis(),
              gte: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              range: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: { value: '200' }, error: null })
            };
          }
          return {};
        })
      };
    })
  };
});

describe('Admin Panel Security (RBAC & SSR Guard)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve permitir acesso ao Dashboard para roles admin', async () => {
    mockRole = 'admin';
    const metrics = await getDashboardMetrics();
    expect(metrics.limit).toBe(200);
  });

  it('deve bloquear (lançar erro) ao Dashboard para roles citizen', async () => {
    mockRole = 'citizen';
    await expect(getDashboardMetrics()).rejects.toThrow('Permissão negada');
  });

  it('deve permitir update de system_settings para admin', async () => {
    mockRole = 'admin';
    const result = await updateSystemSetting('test_key', 'test_val', 'desc');
    expect(result.success).toBe(true);
  });

  it('deve permitir update de available_days e operating_hours para admin', async () => {
    mockRole = 'admin';
    const resDays = await updateSystemSetting('available_days', JSON.stringify([1, 2, 3, 4, 5]), 'Dias úteis');
    expect(resDays.success).toBe(true);

    const resHours = await updateSystemSetting(
      'operating_hours', 
      JSON.stringify({ morning: { start: '08:00', end: '12:00', enabled: true }, afternoon: { start: '13:00', end: '17:00', enabled: true } }), 
      'Horários'
    );
    expect(resHours.success).toBe(true);
  });

  it('deve bloquear update de system_settings para citizen', async () => {
    mockRole = 'citizen';
    await expect(updateSystemSetting('test_key', 'test_val', 'desc')).rejects.toThrow('Permissão negada');
  });

  it('deve listar auditoria para admin', async () => {
    mockRole = 'admin';
    const logs = await getAuditLogs();
    expect(logs.totalCount).toBeDefined();
  });

  it('deve bloquear listagem de auditoria para citizen', async () => {
    mockRole = 'citizen';
    await expect(getAuditLogs()).rejects.toThrow('Permissão negada');
  });

  it('deve permitir que o administrador crie novo usuário sem perder a permissão de admin', async () => {
    mockRole = 'admin';

    const formData = new FormData();
    formData.set('name', 'Novo Atendente Silva');
    formData.set('email', 'novo.atendente@poranga.ce.gov.br');
    formData.set('password', 'SenhaForte#2026');
    formData.set('role', 'atendente');

    const result = await adminCreateUser(formData);
    expect(result.success).toBe(true);

    // O admin continua como admin e consegue acessar o dashboard normalmente
    const metrics = await getDashboardMetrics();
    expect(metrics.limit).toBe(200);
  });

  it('deve bloquear criação de usuário via adminCreateUser se o executor não for admin', async () => {
    mockRole = 'citizen';

    const formData = new FormData();
    formData.set('name', 'Atendente Inválido');
    formData.set('email', 'invalido@poranga.ce.gov.br');
    formData.set('password', 'SenhaForte#2026');

    await expect(adminCreateUser(formData)).rejects.toThrow('Permissão negada');
  });
});
