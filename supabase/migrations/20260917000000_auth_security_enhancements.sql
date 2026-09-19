-- Migration: Auth Security Enhancements (Self-Signup, Password Reset, Rate Limiting & Bcrypt)
-- Date: 2026-09-17

-- 1. Ensure 'atendente' role is present in user_role enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'user_role' AND e.enumlabel = 'atendente'
    ) THEN
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'atendente';
    END IF;
END$$;

-- 2. Add email, password_hash and reset token fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS reset_token_hash TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE;

-- 3. Create index for fast token and email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_reset_token ON public.profiles(reset_token_hash);

-- 4. Create dedicated password_resets table for audit trail of password recoveries
CREATE TABLE IF NOT EXISTS public.password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON public.password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON public.password_resets(email);
