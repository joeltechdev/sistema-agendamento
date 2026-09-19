import { NextRequest, NextResponse } from 'next/server'
import { executePasswordReset } from '@/app/actions/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const formData = new FormData()
    
    if (body.token) {
      formData.set('token', String(body.token))
    }
    if (body.email) {
      formData.set('email', String(body.email))
    }
    if (body.password || body.newPassword || body.novaSenha || body.senha) {
      formData.set('password', String(body.password || body.newPassword || body.novaSenha || body.senha))
    }
    if (body.confirmPassword || body.confirm_password) {
      formData.set('confirmPassword', String(body.confirmPassword || body.confirm_password))
    }

    const result = await executePasswordReset(undefined, formData)

    if (result?.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: result?.success || 'Senha redefinida com sucesso.' 
    }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno ao processar redefinição de senha.' 
    }, { status: 500 })
  }
}
