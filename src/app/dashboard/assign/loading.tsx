import PageListSkeleton from '@/components/ui/Skeleton'

export default function AssignLoading() {
  return <PageListSkeleton title="w-64" subtitle="w-96" rows={5} message="Загружаем журнал поручений…" />
}
