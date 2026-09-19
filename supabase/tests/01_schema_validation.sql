-- Script de Validação de Constraints e RLS (Executar no SQL Editor)

BEGIN;

-- 1. Teste de Constraint: Horário de início deve ser menor que o término
-- Esperado: Erro de constraint (valid_working_hours)
SAVEPOINT constraint_test_1;
DO $$ 
BEGIN
    INSERT INTO public.working_hours (day_of_week, start_time, end_time) 
    VALUES (1, '18:00', '08:00');
    RAISE EXCEPTION 'Constraint valid_working_hours falhou em pegar o erro';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Sucesso: Constraint valid_working_hours funcionando';
END $$;
ROLLBACK TO constraint_test_1;

-- 2. Teste de Concorrência: Impedir dois agendamentos no mesmo horário para o mesmo serviço
-- Esperado: Erro de constraint de unicidade (prevent_double_booking_idx)
SAVEPOINT constraint_test_2;
DO $$
DECLARE 
    v_service_id UUID;
    v_profile_id UUID;
BEGIN
    -- Setup dummy data
    INSERT INTO auth.users (id) VALUES (gen_random_uuid()) RETURNING id INTO v_profile_id;
    INSERT INTO public.profiles (id, full_name, cpf) VALUES (v_profile_id, 'Test User', '12345678900');
    INSERT INTO public.services (name, duration_minutes) VALUES ('Test Service', 30) RETURNING id INTO v_service_id;
    
    -- Inserir o primeiro agendamento
    INSERT INTO public.appointments (citizen_id, service_id, appointment_date, start_time, end_time, type)
    VALUES (v_profile_id, v_service_id, '2026-10-10', '10:00', '10:30', 'first_issue');
    
    -- Tentar inserir o segundo exatamente no mesmo horário/serviço
    BEGIN
        INSERT INTO public.appointments (citizen_id, service_id, appointment_date, start_time, end_time, type)
        VALUES (v_profile_id, v_service_id, '2026-10-10', '10:00', '10:30', 'second_issue');
        RAISE EXCEPTION 'Constraint prevent_double_booking_idx falhou em pegar o erro';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Sucesso: Constraint prevent_double_booking_idx (Concorrência) funcionando';
    END;
END $$;
ROLLBACK TO constraint_test_2;

ROLLBACK;
