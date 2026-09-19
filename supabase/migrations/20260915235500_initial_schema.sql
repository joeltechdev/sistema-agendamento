-- Migration: Initial Schema for ID Scheduling System

-- ==========================================
-- 1. ENUMS AND CUSTOM TYPES
-- ==========================================
CREATE TYPE user_role AS ENUM ('citizen', 'admin', 'manager');
CREATE TYPE appointment_type AS ENUM ('first_issue', 'second_issue');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

-- ==========================================
-- 2. CORE TABLES
-- ==========================================

-- PROFILES (Linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'citizen',
    full_name TEXT NOT NULL,
    cpf TEXT UNIQUE,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SERVICES
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PROFESSIONALS (Optional for desk attendants)
CREATE TABLE public.professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- WORKING HOURS
CREATE TABLE public.working_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT valid_working_hours CHECK (start_time < end_time)
);
-- Ensure one config per day
CREATE UNIQUE INDEX working_hours_day_idx ON public.working_hours (day_of_week);

-- HOLIDAYS & BLOCKED DATES
CREATE TABLE public.blocked_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    description TEXT NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT false, -- For annual holidays
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE UNIQUE INDEX blocked_dates_date_idx ON public.blocked_dates (date) WHERE is_recurring = false;

-- APPOINTMENTS
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    type appointment_type NOT NULL,
    status appointment_status NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_appointment_time CHECK (start_time < end_time)
);

-- REQUIRED DOCUMENTS
CREATE TABLE public.required_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    appointment_type appointment_type NOT NULL,
    document_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SYSTEM SETTINGS
CREATE TABLE public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. CONCURRENCY & INDEXES
-- ==========================================
-- Prevent double booking for the exact same service, date and time unless it's cancelled/no show
CREATE UNIQUE INDEX prevent_double_booking_idx 
ON public.appointments (service_id, appointment_date, start_time) 
WHERE status NOT IN ('cancelled', 'no_show');

-- Fast lookups
CREATE INDEX appointments_citizen_id_idx ON public.appointments(citizen_id);
CREATE INDEX appointments_date_idx ON public.appointments(appointment_date);
CREATE INDEX profiles_cpf_idx ON public.profiles(cpf);

-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.required_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function for Admin Check
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
-- Citizens can read and update their own profile
CREATE POLICY "Citizens can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Citizens can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
-- Admins can do everything
CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL USING (is_admin());

-- SERVICES POLICIES
CREATE POLICY "Anyone can view active services" ON public.services
    FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage services" ON public.services
    FOR ALL USING (is_admin());

-- PROFESSIONALS POLICIES
CREATE POLICY "Admins can manage professionals" ON public.professionals
    FOR ALL USING (is_admin());

-- WORKING HOURS POLICIES
CREATE POLICY "Anyone can view working hours" ON public.working_hours
    FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage working hours" ON public.working_hours
    FOR ALL USING (is_admin());

-- BLOCKED DATES POLICIES
CREATE POLICY "Anyone can view blocked dates" ON public.blocked_dates
    FOR SELECT USING (true);
CREATE POLICY "Admins can manage blocked dates" ON public.blocked_dates
    FOR ALL USING (is_admin());

-- APPOINTMENTS POLICIES
CREATE POLICY "Citizens can view own appointments" ON public.appointments
    FOR SELECT USING (auth.uid() = citizen_id);
CREATE POLICY "Citizens can insert own appointments" ON public.appointments
    FOR INSERT WITH CHECK (auth.uid() = citizen_id);
CREATE POLICY "Citizens can update own appointments (e.g. cancel)" ON public.appointments
    FOR UPDATE USING (auth.uid() = citizen_id);
CREATE POLICY "Admins can manage all appointments" ON public.appointments
    FOR ALL USING (is_admin());

-- REQUIRED DOCUMENTS POLICIES
CREATE POLICY "Anyone can view required documents" ON public.required_documents
    FOR SELECT USING (true);
CREATE POLICY "Admins can manage required documents" ON public.required_documents
    FOR ALL USING (is_admin());

-- SYSTEM SETTINGS POLICIES
CREATE POLICY "Admins can manage system settings" ON public.system_settings
    FOR ALL USING (is_admin());

-- AUDIT LOGS POLICIES
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (is_admin());
-- Insert trigger to be added via functions later. No direct insert policy allowed for users.

-- ==========================================
-- 5. TRIGGERS (Updated_At)
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
