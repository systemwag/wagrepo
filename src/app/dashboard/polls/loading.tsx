import PageListSkeleton from '@/components/ui/Skeleton'

export default function PollsLoading() {
  return <PageListSkeleton title="w-48" subtitle="w-80" rows={4} message="Загружаем опросы…" />
}
