'use client'

import { useRouter } from 'next/navigation'

export default function NewProjectButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push('/dashboard/projects/new')}
      className="btn-green flex items-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      Новый проект
    </button>
  )
}
