'use client'

import { TransitionLink } from '@/components/ui/TransitionLink'
import { ProjectStatusPill, type ProjectStatus } from '@/components/ui/StatusPill'
import { StagePipeline } from './StagePipeline'
import type { ProjectListItem } from '@/app/dashboard/projects/actions'

function deadlineCell(deadline: string | null, status: string) {
  if (!deadline) return <span className="text-text-dim">—</span>
  const d = new Date(deadline)
  const isOverdue = d < new Date() && status === 'active'
  return (
    <span className={`num ${isOverdue ? 'text-danger font-semibold' : 'text-text'}`}>
      {d.toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: '2-digit', month: '2-digit', year: 'numeric' })}
    </span>
  )
}

export function ProjectsTable({ items }: { items: ProjectListItem[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-dim">
            <Th>Название</Th>
            <Th>Статус</Th>
            <Th className="w-[280px]">Прогресс</Th>
            <Th>Дедлайн</Th>
            <Th>Менеджер</Th>
            <Th align="right">Бюджет</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr
              key={p.id}
              className="border-b border-border last:border-b-0 hover:bg-surface-2/40 transition-colors"
            >
              <Td>
                <TransitionLink
                  href={`/dashboard/projects/${p.id}`}
                  className="block"
                >
                  <p
                    className="font-medium text-text truncate max-w-[300px]"
                    style={{ viewTransitionName: `project-title-${p.id}` } as React.CSSProperties}
                  >
                    {p.name}
                  </p>
                  {p.client_name && (
                    <p className="text-xs text-text-dim truncate max-w-[300px]">
                      {p.client_name}
                      {p.contract_number && <span className="num"> · № {p.contract_number}</span>}
                    </p>
                  )}
                </TransitionLink>
              </Td>
              <Td><ProjectStatusPill status={p.status as ProjectStatus} /></Td>
              <Td>
                <StagePipeline stages={p.stages} showLabel={false} />
              </Td>
              <Td>{deadlineCell(p.deadline, p.status)}</Td>
              <Td>
                <span className="text-text-muted truncate inline-block max-w-[160px]">
                  {p.manager?.full_name ?? '—'}
                </span>
              </Td>
              <Td align="right">
                <span className="num text-text-muted">
                  {p.budget != null ? `${Number(p.budget).toLocaleString('ru-RU')} ₸` : '—'}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, align, className = '' }: { children: React.ReactNode; align?: 'right'; className?: string }) {
  return (
    <th className={`px-4 py-3 font-semibold ${align === 'right' ? 'text-right' : ''} ${className}`}>
      {children}
    </th>
  )
}

function Td({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <td className={`px-4 py-3 align-middle ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </td>
  )
}
