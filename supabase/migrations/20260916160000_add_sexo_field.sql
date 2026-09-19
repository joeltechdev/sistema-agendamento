-- ==========================================
-- Migration: Add Sexo (Gender/Sex) Field
-- ==========================================

-- UP Migration:
-- 1. Add sexo column to public.profiles table (nullable for legacy records)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sexo TEXT;

-- 2. Add sexo column to public.appointments table (nullable for legacy records)
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS sexo TEXT;

-- 3. Comment describing allowed domain values
COMMENT ON COLUMN public.profiles.sexo IS 'Sexo/Gênero do cidadão: Masculino, Feminino, Outro / Não informado';
COMMENT ON COLUMN public.appointments.sexo IS 'Sexo/Gênero registrado no momento do agendamento';

-- ==========================================
-- DOWN Migration (Rollback):
-- ALTER TABLE public.appointments DROP COLUMN IF EXISTS sexo;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS sexo;
-- ==========================================
