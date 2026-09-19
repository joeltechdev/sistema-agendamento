BEGIN;

-- 1. Insert default monthly limit if it doesn't exist
INSERT INTO public.system_settings (key, value, description) 
VALUES ('monthly_limit', '200', 'Limite máximo de agendamentos confirmados por mês')
ON CONFLICT (key) DO NOTHING;

-- 2. Create the Booking Function (RPC) for atomic/transactional reservation
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_citizen_id UUID,
  p_service_id UUID,
  p_appointment_date DATE,
  p_appointment_time TIME,
  p_appointment_type VARCHAR,
  p_full_name VARCHAR,
  p_cpf VARCHAR,
  p_phone VARCHAR
) RETURNS JSONB AS $$
DECLARE
  v_monthly_limit INT;
  v_current_month_count INT;
  v_generated_protocol VARCHAR;
  v_appointment_id UUID;
BEGIN
  -- A. Fetch the dynamic monthly limit
  SELECT (value->>0)::INT INTO v_monthly_limit 
  FROM public.system_settings 
  WHERE key = 'monthly_limit';

  IF v_monthly_limit IS NULL THEN
    v_monthly_limit := 200; -- Fallback seguro
  END IF;

  -- B. Lock the table implicitly by counting and inserting
  -- We count how many non-cancelled appointments exist in the same month and year
  SELECT COUNT(*) INTO v_current_month_count
  FROM public.appointments
  WHERE date_trunc('month', appointment_date) = date_trunc('month', p_appointment_date)
  AND status != 'cancelled';

  -- C. Enforce monthly limit
  IF v_current_month_count >= v_monthly_limit THEN
    RAISE EXCEPTION 'MONTHLY_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;

  -- D. Generate Protocol (YYYYMMDD + 6 random alphanumeric chars)
  v_generated_protocol := to_char(p_appointment_date, 'YYYYMMDD') || upper(substr(md5(random()::text), 1, 6));

  -- E. Try to insert. 
  -- The unique constraint "prevent_double_booking_idx" ON (appointment_date, appointment_time, service_id) 
  -- will throw a unique_violation if someone else took the exact slot concurrently.
  BEGIN
    INSERT INTO public.appointments (
      citizen_id,
      service_id,
      appointment_date,
      appointment_time,
      appointment_type,
      status,
      protocol_number
    ) VALUES (
      p_citizen_id,
      p_service_id,
      p_appointment_date,
      p_appointment_time,
      p_appointment_type::public.appointment_type,
      'confirmed',
      v_generated_protocol
    ) RETURNING id INTO v_appointment_id;
  EXCEPTION 
    WHEN unique_violation THEN
      RAISE EXCEPTION 'SLOT_ALREADY_TAKEN' USING ERRCODE = 'P0002';
  END;

  -- F. Return success JSON
  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'protocol', v_generated_protocol
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
REVOKE EXECUTE ON FUNCTION public.book_appointment FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment TO authenticated;

COMMIT;
