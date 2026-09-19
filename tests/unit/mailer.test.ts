import { sendPasswordResetEmail } from '@/lib/email/mailer'
import nodemailer from 'nodemailer'

jest.mock('nodemailer', () => ({
  createTransport: jest.fn()
}))

describe('Mailer Module - Envio de E-mails via Gmail / SMTP', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('deve utilizar fallback de desenvolvimento quando credenciais SMTP não estiverem preenchidas', async () => {
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    delete process.env.GMAIL_USER
    delete process.env.GMAIL_APP_PASSWORD

    const result = await sendPasswordResetEmail({
      to: 'cidadao@teste.com',
      name: 'Maria Cidadã',
      resetUrl: 'http://localhost:3000/recuperar-senha?token=abc12345&email=cidadao%40teste.com',
      expiresInMinutes: 20
    })

    expect(result.success).toBe(true)
    expect(result.previewUrl).toContain('token=abc12345')
    expect(nodemailer.createTransport).not.toHaveBeenCalled()
  })

  it('deve configurar nodemailer e disparar e-mail quando credenciais de Gmail SMTP forem informadas', async () => {
    process.env.SMTP_HOST = 'smtp.gmail.com'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_SECURE = 'true'
    process.env.SMTP_USER = 'prefeitura@gmail.com'
    process.env.SMTP_PASS = 'abcd efgh ijkl mnop'
    process.env.SMTP_FROM = 'Identificação Civil <prefeitura@gmail.com>'

    const mockSendMail = jest.fn().mockResolvedValue({
      messageId: '<test-message-id-12345@gmail.com>'
    })

    ;(nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail
    })

    const result = await sendPasswordResetEmail({
      to: 'usuario.atendente@poranga.ce.gov.br',
      name: 'Carlos Atendente',
      resetUrl: 'http://localhost:3000/recuperar-senha?token=secrettoken6789&email=usuario.atendente%40poranga.ce.gov.br',
      expiresInMinutes: 20
    })

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: 'prefeitura@gmail.com',
          pass: 'abcdefghijklmnop' // valida remoção de espaços da senha de app
        }
      })
    )

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'usuario.atendente@poranga.ce.gov.br',
        from: 'Identificação Civil <prefeitura@gmail.com>',
        subject: expect.stringContaining('Recuperação de Senha'),
        html: expect.stringContaining('Carlos Atendente'),
        text: expect.stringContaining('secrettoken6789')
      })
    )

    expect(result.success).toBe(true)
    expect(result.messageId).toBe('<test-message-id-12345@gmail.com>')
  })

  it('deve formatar adequadamente os templates HTML e Texto Puro com aviso de 20 minutos', async () => {
    process.env.SMTP_USER = 'test@gmail.com'
    process.env.SMTP_PASS = 'pass1234'

    let capturedPayload: any = null
    const mockSendMail = jest.fn().mockImplementation((payload) => {
      capturedPayload = payload
      return Promise.resolve({ messageId: 'msg-999' })
    })

    ;(nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail
    })

    await sendPasswordResetEmail({
      to: 'ana@poranga.ce.gov.br',
      name: 'Ana Ferreira',
      resetUrl: 'https://agendamento.poranga.ce.gov.br/recuperar-senha?token=xyz123',
      expiresInMinutes: 20
    })

    expect(capturedPayload).not.toBeNull()
    expect(capturedPayload.html).toContain('20 minutos')
    expect(capturedPayload.html).toContain('Ana Ferreira')
    expect(capturedPayload.html).toContain('https://agendamento.poranga.ce.gov.br/recuperar-senha?token=xyz123')
    expect(capturedPayload.text).toContain('expira em 20 minutos')
  })
})
