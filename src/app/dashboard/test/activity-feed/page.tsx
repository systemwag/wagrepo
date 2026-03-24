import { redirect } from 'next/navigation'

// Страница перемещена в /dashboard/activity
export default function ActivityFeedTestPage() {
  redirect('/dashboard/activity')
}
