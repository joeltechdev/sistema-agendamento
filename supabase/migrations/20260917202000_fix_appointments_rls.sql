-- Atualiza políticas de agendamentos para permitir que atendentes e supervisores atualizem o status dos atendimentos
CREATE OR REPLACE FUNCTION public.is_admin_or_attendant()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager', 'atendente')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Admins can manage all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can manage all appointments" ON public.appointments;

CREATE POLICY "Staff can manage all appointments" ON public.appointments
    FOR ALL USING (is_admin_or_attendant());
