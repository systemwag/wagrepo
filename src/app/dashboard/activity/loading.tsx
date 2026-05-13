import PageListSkeleton from '@/components/ui/Skeleton'

export default function ActivityLoading() {
  return <PageListSkeleton title="w-56" subtitle="w-80" rows={6} message="Загружаем хронику действий…" />
}
