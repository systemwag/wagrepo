import PageListSkeleton from '@/components/ui/Skeleton'

export default function PollDetailLoading() {
  return <PageListSkeleton title="w-96" subtitle="w-64" rows={3} message="Загружаем опрос…" />
}
