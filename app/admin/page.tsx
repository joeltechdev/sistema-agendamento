import { getDashboardMetrics } from '@/app/actions/admin'
import AdminDashboardClient from '@/components/admin/AdminDashboardClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  try {
    const metrics = await getDashboardMetrics()
    return <AdminDashboardClient initialMetrics={metrics} />
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err)
    redirect('/login')
  }
}
