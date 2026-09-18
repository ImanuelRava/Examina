import { ExamTaker } from '@/components/exam/exam-taker'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TakeExamPage({ params }: PageProps) {
  const { id } = await params
  return <ExamTaker examId={id} />
}
