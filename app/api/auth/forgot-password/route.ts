import { NextRequest, NextResponse } from 'next/server'
import { requestPasswordReset } from '@/app/actions/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const formData = new FormData()
    
    if (body.email) {
      formData.set('email', String(body.email))
    }

    const result = await requestPasswordReset(undefined, formData)

    if (result?.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: result?.success || 'Se o e-mail estiver cadastrado, as instruções foram enviadas.' 
    }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno ao processar recuperação de senha.' 
    }, { status: 500 })
  }
}
