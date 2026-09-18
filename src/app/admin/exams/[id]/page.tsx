import { AdminGate } from '@/components/exam/admin-gate'
import { AdminExamBuilder } from '@/components/exam/admin-builder'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminExamBuilderPage({ params }: PageProps) {
  const { id } = await params
  return (
    <AdminGate>
      <AdminExamBuilder examId={id} />
    </AdminGate>
  )
}
