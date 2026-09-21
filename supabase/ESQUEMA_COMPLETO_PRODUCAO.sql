-- ==============================================================================
-- SISTEMA DE AGENDAMENTO (IDENTIFICAÇÃO CIVIL / RG) - ESQUEMA COMPLETO DE PRODUÇÃO
-- Execute este script no SQL Editor do Supabase para criar todo o banco de uma só vez
-- ==============================================================================

BEGIN;

-- 1. ENUMS E TIPOS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('citizen', 'admin', 'manager', 'atendente');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_type') THEN
        CREATE TYPE appointment_type AS ENUM ('first_issue', 'second_issue');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
    END IF;
END $$;

-- 2. TABELAS PRINCIPAIS

-- Perfis (vinculados a auth.users ou cadastrados via sistema)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role user_role NOT NULL DEFAULT 'citizen',
    full_name TEXT NOT NULL,
    email TEXT,
    cpf TEXT UNIQUE,
    phone TEXT,
    sexo TEXT DEFAULT 'Não informado',
    password_hash TEXT,
    reset_token_hash TEXT,
    reset_token_expires_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active',
    monthly_limit INTEGER DEFAULT 200,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Serviços (Emissão de RG)
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profissionais / Atendentes
CREATE TABLE IF NOT EXISTS public.professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Horários de Atendimento (Segunda a Sexta)
CREATE TABLE IF NOT EXISTS public.working_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT valid_working_hours CHECK (start_time < end_time)
);

-- Feriados e Datas Bloqueadas
CREATE TABLE IF NOT EXISTS public.blocked_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Agendamentos
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    appointment_type appointment_type NOT NULL,
    tipo TEXT,
    status appointment_status NOT NULL DEFAULT 'confirmed',
    protocol_number TEXT UNIQUE NOT NULL,
    full_name TEXT,
    cpf TEXT,
    phone TEXT,
    sexo TEXT DEFAULT 'Não informado',
    attendant TEXT,
    origin TEXT DEFAULT 'online',
    is_walk_in BOOLEAN DEFAULT false,
    cancellation_reason TEXT,
    cancelled_by TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurações Globais do Sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Logs de Auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Recuperação de Senhas
CREATE TABLE IF NOT EXISTS public.password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ÍNDICES DE PERFORMANCE E PREVENÇÃO DE DUPLICIDADE
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles(cpf);
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON public.appointments(appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_protocol ON public.appointments(protocol_number);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON public.password_resets(email);

-- 4. FUNÇÃO E TRIGGER DE NOVO USUÁRIO (Supabase Auth -> Profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, cpf, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Cidadão'),
    NEW.email,
    NEW.raw_user_meta_data->>'cpf',
    NEW.raw_user_meta_data->>'phone',
    'citizen'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. FUNÇÃO DE VERIFICAÇÃO DE PERMISSÕES
CREATE OR REPLACE FUNCTION public.is_admin_or_attendant()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager', 'atendente')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. MOTOR DE AGENDAMENTO TRANSACIONAL (RPC)
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_citizen_id UUID,
  p_service_id UUID,
  p_appointment_date DATE,
  p_appointment_time TIME,
  p_appointment_type VARCHAR,
  p_full_name VARCHAR,
  p_cpf VARCHAR,
  p_phone VARCHAR,
  p_sexo VARCHAR DEFAULT 'Não informado'
) RETURNS JSONB AS $$
DECLARE
  v_monthly_limit INT;
  v_current_month_count INT;
  v_generated_protocol VARCHAR;
  v_appointment_id UUID;
  v_assigned_attendant TEXT;
BEGIN
  -- Limite mensal configurado
  SELECT (value->>0)::INT INTO v_monthly_limit 
  FROM public.system_settings 
  WHERE key = 'monthly_limit';

  IF v_monthly_limit IS NULL THEN
    v_monthly_limit := 200;
  END IF;

  SELECT COUNT(*) INTO v_current_month_count
  FROM public.appointments
  WHERE date_trunc('month', appointment_date) = date_trunc('month', p_appointment_date)
  AND status NOT IN ('cancelled');

  IF v_current_month_count >= v_monthly_limit THEN
    RAISE EXCEPTION 'MONTHLY_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;

  v_generated_protocol := to_char(p_appointment_date, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  IF p_appointment_type ILIKE '%second%' OR p_appointment_type ILIKE '%2%' THEN
    v_assigned_attendant := 'Guichê 02 - Dr. Silva';
  ELSE
    v_assigned_attendant := 'Guichê 01 - Dra. Lima';
  END IF;

  INSERT INTO public.appointments (
    citizen_id,
    service_id,
    appointment_date,
    appointment_time,
    appointment_type,
    tipo,
    status,
    protocol_number,
    full_name,
    cpf,
    phone,
    sexo,
    attendant
  ) VALUES (
    p_citizen_id,
    p_service_id,
    p_appointment_date,
    p_appointment_time,
    p_appointment_type::public.appointment_type,
    p_appointment_type,
    'confirmed',
    v_generated_protocol,
    p_full_name,
    p_cpf,
    p_phone,
    COALESCE(p_sexo, 'Não informado'),
    v_assigned_attendant
  ) RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'protocol', v_generated_protocol
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. DADOS INICIAIS (SEEDS)
INSERT INTO public.services (id, name, description, duration_minutes, is_active)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Emissão de RG', 'Emissão da Carteira de Identidade Nacional (1ª e 2ª Via)', 30, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('monthly_limit', '200'::jsonb, 'Limite mensal padrão de atendimentos'),
  ('second_issue_warning', '"Para emissão de 2ª via, é necessário apresentar o comprovante de pagamento da taxa DAE ou declaração de isenção."'::jsonb, 'Aviso sobre taxa de 2ª via'),
  ('available_days', '[1,2,3,4,5]'::jsonb, 'Dias úteis (Segunda a Sexta)'),
  ('operating_hours', '{"morning":{"start":"08:00","end":"12:00","enabled":true},"afternoon":{"start":"13:00","end":"17:00","enabled":true}}'::jsonb, 'Turnos de atendimento')
ON CONFLICT (key) DO NOTHING;

-- Horários de Segunda a Sexta
DELETE FROM public.working_hours;
INSERT INTO public.working_hours (day_of_week, start_time, end_time, is_active) VALUES
  (1, '08:00:00', '12:30:00', true),
  (2, '08:00:00', '12:30:00', true),
  (3, '08:00:00', '12:30:00', true),
  (4, '08:00:00', '12:30:00', true),
  (5, '08:00:00', '12:30:00', true),
  (1, '13:30:00', '17:00:00', true),
  (2, '13:30:00', '17:00:00', true),
  (3, '13:30:00', '17:00:00', true),
  (4, '13:30:00', '17:00:00', true),
  (5, '13:30:00', '17:00:00', true);

-- Administrador Padrão inicial (admin@prefeitura.gov.br / 123456)
INSERT INTO public.profiles (
  id,
  full_name,
  email,
  role,
  status,
  monthly_limit,
  password_hash
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Administrador Geral',
  'admin@prefeitura.gov.br',
  'admin',
  'active',
  200,
  '$2b$10$hket2Y5rNVt.mE1/jHQPjunjA330nKO8zlESghVQbVBAYhKcMQGOu' -- '123456'
)
ON CONFLICT (id) DO UPDATE 
SET role = 'admin', status = 'active', password_hash = EXCLUDED.password_hash;

-- 8. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas Públicas de Leitura
DROP POLICY IF EXISTS "Public can view active services" ON public.services;
CREATE POLICY "Public can view active services" ON public.services FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can view working hours" ON public.working_hours;
CREATE POLICY "Public can view working hours" ON public.working_hours FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can view blocked dates" ON public.blocked_dates;
CREATE POLICY "Public can view blocked dates" ON public.blocked_dates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view system settings" ON public.system_settings;
CREATE POLICY "Public can view system settings" ON public.system_settings FOR SELECT USING (true);

-- Políticas de Agendamento
DROP POLICY IF EXISTS "Staff can manage all appointments" ON public.appointments;
CREATE POLICY "Staff can manage all appointments" ON public.appointments FOR ALL USING (is_admin_or_attendant());

DROP POLICY IF EXISTS "Citizens can view own appointments" ON public.appointments;
CREATE POLICY "Citizens can view own appointments" ON public.appointments FOR SELECT USING (citizen_id = auth.uid() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Public can insert appointments" ON public.appointments;
CREATE POLICY "Public can insert appointments" ON public.appointments FOR INSERT WITH CHECK (true);

COMMIT;
