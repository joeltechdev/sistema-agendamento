import { NextRequest, NextResponse } from 'next/server'
import { registerUser } from '@/app/actions/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const formData = new FormData()
    
    if (body.name || body.nome || body.full_name) {
      formData.set('name', String(body.name || body.nome || body.full_name))
    }
    if (body.email) {
      formData.set('email', String(body.email))
    }
    if (body.password || body.senha) {
      formData.set('password', String(body.password || body.senha))
    }
    if (body.confirmPassword || body.confirm_password) {
      formData.set('confirmPassword', String(body.confirmPassword || body.confirm_password))
    }

    const result = await registerUser(undefined, formData)

    if (result?.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Usuário cadastrado com sucesso. Sessão iniciada.' 
    }, { status: 201 })
  } catch (err: any) {
    if (err?.message === 'NEXT_REDIRECT') {
      return NextResponse.json({ 
        success: true, 
        message: 'Usuário cadastrado com sucesso.' 
      }, { status: 201 })
    }
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno ao processar cadastro.' 
    }, { status: 500 })
  }
}
