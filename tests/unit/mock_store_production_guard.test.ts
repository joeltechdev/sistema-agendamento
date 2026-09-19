import { createClient, getMockStore } from '@/lib/supabase/server'

describe('ETAPA E.4: Trava de Mock Store em Produção', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('deve permitir execução em ambiente de teste ou desenvolvimento sem credenciais do Supabase', async () => {
    Object.assign(process.env, { NODE_ENV: 'test' })
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => getMockStore()).not.toThrow()
    await expect(createClient()).resolves.toBeDefined()
  })

  it('deve bloquear estritamente o uso de getMockStore em produção se as credenciais do Supabase não estiverem configuradas', () => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => getMockStore()).toThrow(/ambiente de produção/i)
  })

  it('deve bloquear estritamente o uso de createClient em produção se as credenciais do Supabase não estiverem configuradas', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    await expect(createClient()).rejects.toThrow(/ambiente de produção/i)
  })

  it('não deve lançar erro de bloqueio de mock store em produção quando as credenciais reais do Supabase estiverem presentes', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://xyzcompany.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anonkeyhere'
    })

    expect(() => getMockStore()).not.toThrow()
  })
})
