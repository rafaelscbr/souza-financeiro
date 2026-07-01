import { useAppData } from '@/context/AppDataContext'
import { GroupDashboard } from '@/features/dashboard/GroupDashboard'
import { CompanyDashboard } from '@/features/dashboard/CompanyDashboard'

export function DashboardPage() {
  const { activeCompany } = useAppData()
  return activeCompany ? <CompanyDashboard company={activeCompany} /> : <GroupDashboard />
}
