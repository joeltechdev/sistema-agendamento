-- Migration: Seed Institutional Data

BEGIN;

-- 1. Insert Core Service
DO $$ 
DECLARE
  v_service_id UUID;
BEGIN
  -- Insert Service "Emissão de RG"
  INSERT INTO public.services (name, description, duration_minutes, is_active)
  VALUES ('Emissão de RG', 'Serviço padrão para agendamento e emissão da Carteira de Identidade', 30, true)
  RETURNING id INTO v_service_id;

  -- 2. Insert Required Documents for First Issue
  INSERT INTO public.required_documents (service_id, appointment_type, document_name, description) VALUES 
  (v_service_id, 'first_issue', 'Certidão de nascimento original', 'Obrigatório para comprovação inicial de identidade.'),
  (v_service_id, 'first_issue', 'CPF original', 'Obrigatório.'),
  (v_service_id, 'first_issue', 'Certidão de casamento original', 'Obrigatório quando aplicável (estado civil casado).'),
  (v_service_id, 'first_issue', 'Responsável legal', 'Obrigatório para menores de 16 anos.'),
  (v_service_id, 'first_issue', 'Laudo médico', 'Obrigatório quando aplicável (solicitação de PCD).');

  -- 3. Insert Required Documents for Second Issue
  INSERT INTO public.required_documents (service_id, appointment_type, document_name, description) VALUES 
  (v_service_id, 'second_issue', 'Certidão de nascimento original', 'Obrigatório para validação.'),
  (v_service_id, 'second_issue', 'CPF original', 'Obrigatório.'),
  (v_service_id, 'second_issue', 'Certidão de casamento original', 'Obrigatório quando aplicável (mudança de estado civil).'),
  (v_service_id, 'second_issue', 'Responsável legal', 'Obrigatório para menores de 16 anos.'),
  (v_service_id, 'second_issue', 'Laudo médico', 'Obrigatório quando aplicável (solicitação de PCD).');

END $$;

-- 4. Insert System Settings
INSERT INTO public.system_settings (key, value, description) VALUES 
(
  'second_issue_warning', 
  '"Na emissão de 2ª via, é obrigatória a apresentação do RG anterior (antigo)."', 
  'Aviso obrigatório para a segunda via do RG'
),
(
  'privacy_policy', 
  '"[PENDENTE DE VALIDAÇÃO JURÍDICA] Este sistema armazena informações sensíveis estritamente para o propósito de agendamento do RG, seguindo as diretrizes da LGPD."', 
  'Termos de Privacidade Institucionais'
),
(
  'terms_of_service', 
  '"[PENDENTE DE VALIDAÇÃO JURÍDICA] Ao prosseguir, o cidadão declara ciência de que a ausência ou fraude documental pode impedir o atendimento."', 
  'Termos de Ciência de Agendamento'
);

COMMIT;
