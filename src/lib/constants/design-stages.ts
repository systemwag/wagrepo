export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'

export type ReviewStatus = 'pending_review' | 'approved' | 'revision_needed'

export type ChecklistItem = {
  id: string
  stage_id: string
  label: string
  is_required: boolean
  is_completed: boolean
  completed_by: string | null
  completed_at: string | null
  checker: { full_name: string } | null
  order_index: number
}

export type StageDocument = {
  id: string
  name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: string | null
  created_at: string
}

export type DesignStage = {
  id: string
  project_id: string
  name: string
  stage_key: string | null
  status: StageStatus
  order_index: number
  deadline: string | null
  assignee_id: string | null
  assignee: { id: string; full_name: string } | null
  notes: string | null
  completed_at: string | null
  review_status: ReviewStatus | null
  reviewed_by: string | null
  reviewed_at: string | null
  checklist_items: ChecklistItem[]
  stage_documents: StageDocument[]
}

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  pending:     'Ожидание',
  in_progress: 'В работе',
  completed:   'Завершён',
  blocked:     'Заблокирован',
}

export const STAGE_STATUS_NEXT: Record<StageStatus, StageStatus | null> = {
  pending:     'in_progress',
  in_progress: 'completed',
  completed:   null,
  blocked:     'in_progress',
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending_review:   'На проверке',
  approved:         'Одобрено',
  revision_needed:  'На доработку',
}
