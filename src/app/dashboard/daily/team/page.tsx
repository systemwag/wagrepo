import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Users, History } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import TeamView, { type TeamReport, type TeamMember } from '@/components/daily/TeamView'
import JournalView, { type JournalReport, type JournalMember } from '@/components/daily/JournalView'
import DailyViewTabs from '@/components/daily/DailyViewTabs'
import DailyRefreshButton from '@/components/daily/DailyRefreshButton'
import { SkeletonStatusBar, SkeletonRows } from '@/components/ui/Skeleton'
import { todayStringOral, currentHourOral } from '@/lib/utils/date'
import { hasDirectorAccess, hasManagerAccess } from '@/lib/roles'

export const revalidate = 0

// На N дней раньше указанной строки YYYY-MM-DD (через UTC-Date, без TZ-сюрпризов).
function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().split('T')[0]
}

function clampInt(v: string | undefined, min: number, max: number, def: number): number {
  const n = parseInt(v ?? '', 10)
  if (Number.isNaN(n)) return def
  return Math.min(max, Math.max(min, n))
}

// YYYY-MM-DD; пустая/мусорная строка → null.
function parseDate(v: string | undefined): string | null {
  if (!v) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

type SP = {
  view?:    string
  until?:   string
  days?:    string
  dept?:    string
  user?:    string
  blocker?: string
  heavy?:   string
  problem?: string
}

export default async function DailyTeamPage({
  searchParams,
}: { searchParams: Promise<SP> }) {
  const sp = await searchParams

  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!hasDirectorAccess(profile.role)) redirect('/dashboard/daily')

  const view: 'today' | 'history' = sp.view === 'history' ? 'history' : 'today'
  const canReact = hasManagerAccess(profile.role)
  const today = todayStringOral()

  // Подзаголовок и иконка зависят только от view и параметров окна —
  // считаем здесь, чтобы PageHeader не уезжал в Suspense и не моргал при
  // переключении вкладки. Suspense покрывает только тело, не шапку и табы.
  const subtitle = view === 'history'
    ? historySubtitle(sp, today)
    : todaySubtitle(today)

  // key={view} обязателен — иначе React переиспользует Suspense boundary
  // при смене query, и fallback не покажется на втором переходе.
  return (
    <div>
      <PageHeader
        icon={view === 'history' ? <History size={18} /> : <Users size={18} />}
        iconTone="info"
        title="Отчёты команды"
        subtitle={subtitle}
        back={{ href: '/dashboard/daily', label: 'К моему отчёту' }}
        action={<DailyRefreshButton />}
      />
      <DailyViewTabs current={view} />
      <Suspense key={view} fallback={<BodyFallback />}>
        {view === 'history'
          ? <HistoryBody sp={sp} viewerId={profile.id} canReact={canReact} today={today} />
          : <TodayBody  viewerId={profile.id} canReact={canReact} today={today} />}
      </Suspense>
    </div>
  )
}

// Тело Suspense — общий скелетон из ui/Skeleton. PageHeader и DailyViewTabs
// статичны, поэтому здесь только статус-бар и строки.
function BodyFallback() {
  return (
    <>
      <SkeletonStatusBar message="Собираем отчёты команды…" />
      <SkeletonRows count={5} />
    </>
  )
}

// ── Подзаголовки ─────────────────────────────────────────────────────────────
function todaySubtitle(today: string) {
  const label = new Date(today + 'T00:00:00').toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Oral',
    weekday: 'long', day: 'numeric', month: 'long',
  })
  return <span className="first-letter:uppercase">{label}</span>
}

function historySubtitle(sp: SP, today: string) {
  const days  = clampInt(sp.days, 14, 60, 14)
  const until = parseDate(sp.until) ?? today
  const from  = shiftDate(until, -(days - 1))
  return <span>{formatRange(from, until)} · {days} {pluralDays(days)}</span>
}

// ── Вкладка «Сегодня» ────────────────────────────────────────────────────────
async function TodayBody({
  viewerId, canReact, today,
}: { viewerId: string; canReact: boolean; today: string }) {
  const supabase = await createClient()

  const [{ data: teamReports }, { data: teamMembers }] = await Promise.all([
    // RPC get_daily_team_window (миграция 063) — один SQL вместо PostgREST embed.
    // Внутри SECURITY DEFINER + явный access-check, RLS-оверхед на связях обойдён.
    supabase.rpc('get_daily_team_window', { p_from: today, p_to: today }),

    supabase
      .from('profiles')
      .select('id, full_name, position, role, department')
      .in('role', ['employee', 'manager'])
      .eq('is_active', true)
      .order('full_name'),
  ])

  return (
    <TeamView
      viewerId={viewerId}
      canReact={canReact}
      teamReports={(teamReports ?? []) as unknown as TeamReport[]}
      teamMembers={(teamMembers ?? []) as unknown as TeamMember[]}
    />
  )
}

// ── Вкладка «История» ────────────────────────────────────────────────────────
async function HistoryBody({
  sp, viewerId, canReact, today,
}: { sp: SP; viewerId: string; canReact: boolean; today: string }) {
  const supabase = await createClient()

  // Окно: до 60 дней. Дефолт — последние 14 дней.
  const days  = clampInt(sp.days, 14, 60, 14)
  const until = parseDate(sp.until) ?? today
  const from  = shiftDate(until, -(days - 1))

  const [{ data: reports }, { data: members }] = await Promise.all([
    // RPC get_daily_team_window (миграция 063) — один SQL JOIN + jsonb_agg,
    // вместо тяжёлого embed-плана с 3 связями и N×RLS-вычислений по строкам.
    supabase.rpc('get_daily_team_window', { p_from: from, p_to: until }),

    supabase
      .from('profiles')
      .select('id, full_name, position, role, department')
      .in('role', ['employee', 'manager'])
      .eq('is_active', true)
      .order('full_name'),
  ])

  // День ещё не закончился по Asia/Oral — даём это знать UI, чтобы не пугать
  // «не сдали» цифрой утром/днём, когда отчёты ещё в процессе сбора.
  const todayInProgress = currentHourOral() < 18

  return (
    <JournalView
      viewerId={viewerId}
      canReact={canReact}
      today={today}
      todayInProgress={todayInProgress}
      windowFrom={from}
      windowUntil={until}
      days={days}
      reports={(reports ?? []) as unknown as JournalReport[]}
      members={(members ?? []) as unknown as JournalMember[]}
      filters={{
        dept:    sp.dept    || null,
        user:    sp.user    || null,
        blocker: sp.blocker === '1',
        heavy:   sp.heavy   === '1',
        problem: sp.problem === '1',
      }}
    />
  )
}

function pluralDays(n: number): string {
  const last = n % 10
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 14) return 'дней'
  if (last === 1) return 'день'
  if (last >= 2 && last <= 4) return 'дня'
  return 'дней'
}

function formatRange(from: string, until: string): string {
  const f = new Date(from  + 'T00:00:00')
  const u = new Date(until + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' }
  return `${f.toLocaleDateString('ru-RU', opts)} — ${u.toLocaleDateString('ru-RU', opts)}`
}
