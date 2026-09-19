BEGIN;

-- 1. Remove strict constraint that prevents multiple shifts per day
DROP INDEX IF EXISTS working_hours_day_idx;

-- 2. Clean any existing working hours
DELETE FROM public.working_hours;

-- 3. Seed Monday to Friday shifts (0 = Sunday, 1 = Monday ... 6 = Saturday)
-- Morning Shift: 08:00 - 12:30
-- Afternoon Shift: 13:30 - 17:00

DO $$ 
DECLARE
  v_day INT;
BEGIN
  FOR v_day IN 1..5 LOOP
    INSERT INTO public.working_hours (day_of_week, start_time, end_time, is_active)
    VALUES (v_day, '08:00:00', '12:30:00', true);

    INSERT INTO public.working_hours (day_of_week, start_time, end_time, is_active)
    VALUES (v_day, '13:30:00', '17:00:00', true);
  END LOOP;
END $$;

COMMIT;
