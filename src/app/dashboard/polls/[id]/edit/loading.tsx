import PageListSkeleton from '@/components/ui/Skeleton'

export default function EditPollLoading() {
  return <PageListSkeleton title="w-64" subtitle="w-80" rows={3} message="Готовим форму…" />
}
