import PageListSkeleton from '@/components/ui/Skeleton'

export default function AssignmentsLoading() {
  return <PageListSkeleton title="w-48" subtitle="w-56" rows={5} message="Загружаем ваши поручения…" />
}
