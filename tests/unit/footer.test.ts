import { INSTITUTIONAL_CONFIG } from '@/lib/config/institutional'

describe('Institutional Configuration and Footer Specs', () => {
  it('should have correct municipality and state', () => {
    expect(INSTITUTIONAL_CONFIG.municipality).toBe('Prefeitura Municipal de Poranga')
    expect(INSTITUTIONAL_CONFIG.state).toBe('Estado do Ceará')
  })

  it('should contain exact mayor and vice-mayor leadership names', () => {
    expect(INSTITUTIONAL_CONFIG.mayor).toBe('Antonio Roberto Uchoa de Almeida')
    expect(INSTITUTIONAL_CONFIG.viceMayor).toBe('Quelma Maria de Abreu Felício')
  })

  it('should have standard full title and leadership line formats', () => {
    expect(INSTITUTIONAL_CONFIG.fullTitle).toBe('Prefeitura Municipal de Poranga • Estado do Ceará')
    expect(INSTITUTIONAL_CONFIG.leadershipLine).toBe(
      'Prefeito: Antonio Roberto Uchoa de Almeida • Vice-Prefeita: Quelma Maria de Abreu Felício'
    )
  })

  it('should maintain the sector identification', () => {
    expect(INSTITUTIONAL_CONFIG.sector).toBe('Setor de Identificação Civil')
  })
})
