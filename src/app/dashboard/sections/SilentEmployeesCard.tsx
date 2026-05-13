import { FileText } from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader, CardEmpty } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { getSilentEmployees } from '../queries'

export default async function SilentEmployeesCard() {
  const silent = await getSilentEmployees()
  const visible = silent.slice(0, 6)

  return (
    <Card>
      <CardHeader
        icon={<FileText size={18} />}
        // V8: нейтральная иконка вместо MicOff (не оценочно)
        title="Без отчёта сегодня"
        count={silent.length}
        // V14: нейтральный счётчик вместо warn — это не «проблема», это статус
        countTone={silent.length === 0 ? 'green' : 'neutral'}
        action={
          <Link href="/dashboard/daily/team" className="text-xs text-text-dim hover-green">
            Все →
          </Link>
        }
      />
      {silent.length === 0 ? (
        <CardEmpty compact icon={<FileText size={20} />} text="Все сегодня отчитались 👌" />
      ) : (
        <div>
          {visible.map((p, i) => (
            <Link
              key={p.id}
              href="/dashboard/daily/team"
              className="flex items-center gap-3 px-4 py-3 @md:px-6 row-hover"
              style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--color-border)' : undefined }}
            >
              <Avatar id={p.id} name={p.full_name} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-text">{p.full_name}</p>
                <p className="text-xs truncate text-text-dim">
                  {p.position ?? (p.role === 'manager' ? 'Менеджер' : 'Сотрудник')}
                </p>
              </div>
            </Link>
          ))}
          {silent.length > 6 && (
            <Link
              href="/dashboard/daily/team"
              className="block px-4 py-3 @md:px-6 text-xs text-center text-text-dim hover-green border-t border-border"
            >
              + ещё {silent.length - 6} — открыть полный список
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}
