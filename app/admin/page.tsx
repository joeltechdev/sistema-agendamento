import { getDashboardMetrics } from '@/app/actions/admin'
import AdminDashboardClient from '@/components/admin/AdminDashboardClient'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const metrics = await getDashboardMetrics()

  return <AdminDashboardClient initialMetrics={metrics} />
}
