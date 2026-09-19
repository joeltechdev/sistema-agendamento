-- Validação de RLS para tabelas de conteúdo institucional
BEGIN;

-- Tentativa de INSERT em required_documents como cidadão comum (deve falhar)
SAVEPOINT test_rls_1;
DO $$ 
DECLARE
  v_citizen_id UUID;
BEGIN
  -- Simula estar logado como um cidadão
  -- (No Supabase real usaríamos set_config('request.jwt.claims', '{"role":"authenticated"}', true))
  
  -- Tentativa de burlar e inserir um documento
  INSERT INTO public.required_documents (service_id, appointment_type, document_name) 
  VALUES (gen_random_uuid(), 'first_issue', 'Documento Falso');
  
  RAISE EXCEPTION 'A política RLS falhou. Cidadão conseguiu inserir documento!';
EXCEPTION WHEN insufficient_privilege OR check_violation OR row_security_policy_violation THEN
  -- Pode dar exception de foreign key também porque o service_id não existe, mas a principal é RLS.
  RAISE NOTICE 'Sucesso: Cidadão bloqueado de inserir required_documents';
END $$;
ROLLBACK TO test_rls_1;

ROLLBACK;
