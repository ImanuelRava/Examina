import { AdminGate } from '@/components/exam/admin-gate'
import { AdminResults } from '@/components/exam/admin-results'

export default function AdminResultsPage() {
  return (
    <AdminGate>
      <AdminResults />
    </AdminGate>
  )
}
