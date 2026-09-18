import { Suspense } from 'react'
import { ReportCard } from '@/components/exam/report-card'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AttemptPage({ params }: PageProps) {
  const { id } = await params
  // ReportCard uses useSearchParams - needs Suspense boundary in Next 15+.
  return (
    <Suspense fallback={null}>
      <ReportCard attemptId={id} />
    </Suspense>
  )
}
