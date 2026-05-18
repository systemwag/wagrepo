export const POLLS_PAGE_SIZE = 20

export type PollStatusFilter = 'all' | 'active' | 'closed' | 'expired'

export const POLL_STATUS_TABS: { key: PollStatusFilter; label: string }[] = [
  { key: 'active',  label: 'Активные'   },
  { key: 'closed',  label: 'Закрытые'   },
  { key: 'expired', label: 'Просроченные' },
  { key: 'all',     label: 'Все'        },
]
