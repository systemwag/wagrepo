import PageListSkeleton from '@/components/ui/Skeleton'

export default function NewPollLoading() {
  return <PageListSkeleton title="w-48" subtitle="w-80" rows={3} message="Готовим форму…" />
}
