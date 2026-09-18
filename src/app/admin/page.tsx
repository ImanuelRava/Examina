import { AdminGate } from '@/components/exam/admin-gate'
import { AdminExamList } from '@/components/exam/admin-list'

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminExamList />
    </AdminGate>
  )
}
