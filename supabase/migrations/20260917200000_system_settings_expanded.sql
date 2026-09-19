-- Inserção de configurações expandidas do sistema (idempotente)
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('available_days', '[1, 2, 3, 4, 5]'::jsonb, 'Dias da semana disponíveis para agendamentos (0=Dom, 1=Seg..6=Sáb)'),
  ('operating_hours', '{"morning": {"start": "08:00", "end": "12:00", "enabled": true}, "afternoon": {"start": "13:00", "end": "17:00", "enabled": true}}'::jsonb, 'Turnos e horários de funcionamento do atendimento')
ON CONFLICT (key) DO NOTHING;
