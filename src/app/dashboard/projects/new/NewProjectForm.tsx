'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/actions/log'
import DatePicker from '@/components/ui/DatePicker'
import {
  FolderOpen,
  Building2,
  FileText,
  CalendarDays,
  CalendarCheck,
  UserCog,
  AlignLeft,
  Loader2,
  X,
  Plus,
  Compass,
  Hammer,
  Briefcase,
  Layers,
  Settings2,
  Check as CheckIcon,
} from 'lucide-react'
import ManagerPicker, { type Employee } from '@/components/projects/ManagerPicker'

export type TemplateOption = {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  is_default: boolean
  stages: { id: string; name: string; order_index: number }[]
}

// Карта имя→иконка из Lucide. Список ограничен — этого хватает для шаблонов.
// Если в БД встретится незнакомое имя — берём Compass как safe-default.
const TEMPLATE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  compass:    Compass,
  hammer:     Hammer,
  briefcase:  Briefcase,
  layers:     Layers,
  'folder-open': FolderOpen,
  settings:   Settings2,
}

function getTemplateIcon(name: string | null): React.ComponentType<{ size?: number; className?: string }> {
  if (!name) return Compass
  return TEMPLATE_ICONS[name] ?? Compass
}

export default function NewProjectForm({
  employees,
  currentUserId,
  templates,
}: {
  employees: Employee[]
  currentUserId: string
  templates: TemplateOption[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Стартовый шаблон — default или первый в списке
  const initialTemplateId = useMemo(() => {
    if (templates.length === 0) return ''
    return templates.find(t => t.is_default)?.id ?? templates[0].id
  }, [templates])

  const [form, setForm] = useState({
    name: '',
    client_name: '',
    contract_number: '',
    start_date: '',
    deadline: '',
    description: '',
    manager_id: '',
    template_id: initialTemplateId,
  })

  function setField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === form.template_id) ?? null,
    [templates, form.template_id],
  )

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (!form.template_id) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name:            form.name.trim(),
        client_name:     form.client_name || null,
        contract_number: form.contract_number || null,
        start_date:      form.start_date || null,
        deadline:        form.deadline || null,
        description:     form.description || null,
        created_by:      user!.id,
        manager_id:      form.manager_id || user!.id,
        template_id:     form.template_id,
        project_type:    'design',
      })
      .select('id')
      .single()

    if (!error && project) {
      await logActivity('project', project.id, 'project.created', { name: form.name.trim() })
      await supabase.rpc('create_project_from_template', {
        p_project_id:  project.id,
        p_template_id: form.template_id,
      })
      router.push(`/dashboard/projects/${project.id}`)
      router.refresh()
    }

    setLoading(false)
  }

  const stageColors = [
    '#22c55e', '#3b82f6', '#a855f7', '#f59e0b',
    '#06b6d4', '#f97316', '#ec4899', '#6366f1',
  ]

  const showTemplatePicker = templates.length > 1

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Основная информация ── */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--green-glow)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <FolderOpen className="w-5 h-5" style={{ color: 'var(--green)' }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Основная информация</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Название, заказчик, договор и сроки</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Название */}
          <Field label="Название проекта" required icon={<FileText className="w-3.5 h-3.5" />}>
            <input
              required
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Например: Административный корпус ТОО «...»"
              className="input text-base"
              style={{ fontWeight: 500 }}
            />
          </Field>

          {/* Заказчик + Договор */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Заказчик" icon={<Building2 className="w-3.5 h-3.5" />}>
              <input
                value={form.client_name}
                onChange={e => setField('client_name', e.target.value)}
                placeholder="Название организации"
                className="input"
              />
            </Field>
            <Field label="Номер договора" icon={<FileText className="w-3.5 h-3.5" />}>
              <input
                value={form.contract_number}
                onChange={e => setField('contract_number', e.target.value)}
                placeholder="ДГ-2025-001"
                className="input"
              />
            </Field>
          </div>

          {/* Даты */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Дата начала" icon={<CalendarDays className="w-3.5 h-3.5" />}>
              <DatePicker
                value={form.start_date}
                onChange={v => setField('start_date', v)}
                placeholder="дд.мм.гггг"
              />
            </Field>
            <Field label="Дедлайн" icon={<CalendarCheck className="w-3.5 h-3.5" />}>
              <DatePicker
                value={form.deadline}
                onChange={v => setField('deadline', v)}
                placeholder="дд.мм.гггг"
              />
            </Field>
          </div>

          {/* Менеджер */}
          <Field label="Менеджер проекта" icon={<UserCog className="w-3.5 h-3.5" />}>
            <ManagerPicker
              employees={employees}
              value={form.manager_id}
              onChange={id => setField('manager_id', id)}
              currentUserId={currentUserId}
            />
          </Field>

          {/* Описание */}
          <Field label="Описание проекта" icon={<AlignLeft className="w-3.5 h-3.5" />}>
            <textarea
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Краткое описание, цели и особенности проекта..."
              rows={3}
              className="input resize-none"
            />
          </Field>
        </div>
      </section>

      {/* ── Шаблон проекта ── */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <Layers className="w-5 h-5" style={{ color: '#818cf8' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Шаблон проекта</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Определяет какие этапы и чек-листы будут созданы автоматически
            </p>
          </div>
          <Link
            href="/dashboard/settings/templates"
            className="text-xs text-text-muted hover-text shrink-0"
            title="Управление шаблонами"
          >
            <Settings2 size={14} />
          </Link>
        </div>

        {/* Выбор шаблона — карточки. Скрыт если шаблон один. */}
        {showTemplatePicker && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {templates.map(t => {
              const Icon = getTemplateIcon(t.icon)
              const selected = form.template_id === t.id
              const color = t.color ?? '#22c55e'
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setField('template_id', t.id)}
                  className="flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                  style={{
                    background: selected ? `color-mix(in oklab, ${color} 10%, var(--color-surface-2))` : 'var(--color-surface-2)',
                    border: `1px solid ${selected ? color : 'var(--color-border)'}`,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `color-mix(in oklab, ${color} 18%, transparent)`,
                      color,
                      border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`,
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{t.name}</span>
                      {t.is_default && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{
                            background: 'color-mix(in oklab, var(--color-green) 15%, transparent)',
                            color: 'var(--color-green)',
                          }}
                        >
                          По умолчанию
                        </span>
                      )}
                      {selected && <CheckIcon size={14} className="ml-auto" style={{ color }} />}
                    </div>
                    {t.description && (
                      <p className="text-xs mt-1 leading-snug" style={{ color: 'var(--text-muted)' }}>
                        {t.description}
                      </p>
                    )}
                    <p className="text-xs mt-1 text-text-dim">
                      {t.stages.length} {pluralStages(t.stages.length)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Если шаблон один — компактная инфо-карточка */}
        {!showTemplatePicker && selectedTemplate && (
          <div
            className="flex items-center gap-3 p-3 mb-5 rounded-xl"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            {(() => {
              const Icon = getTemplateIcon(selectedTemplate.icon)
              const color = selectedTemplate.color ?? '#22c55e'
              return (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `color-mix(in oklab, ${color} 18%, transparent)`,
                    color,
                  }}
                >
                  <Icon size={16} />
                </div>
              )
            })()}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Шаблон: {selectedTemplate.name}
              </p>
              <p className="text-xs text-text-muted">
                {selectedTemplate.stages.length} {pluralStages(selectedTemplate.stages.length)}
              </p>
            </div>
          </div>
        )}

        {/* Превью этапов выбранного шаблона */}
        {selectedTemplate && selectedTemplate.stages.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
              Будут созданы этапы:
            </p>
            {selectedTemplate.stages.map((stage, i) => (
              <div
                key={stage.id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: `${stageColors[i % stageColors.length]}22`,
                    color: stageColors[i % stageColors.length],
                    border: `1px solid ${stageColors[i % stageColors.length]}44`,
                  }}
                >
                  {i + 1}
                </div>
                <span className="text-sm font-medium flex-1" style={{ color: 'var(--text)' }}>
                  {stage.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Шаблонов нет — error state */}
        {templates.length === 0 && (
          <div
            className="p-4 rounded-xl text-sm"
            style={{
              background: 'color-mix(in oklab, var(--color-warn) 8%, transparent)',
              border: '1px solid color-mix(in oklab, var(--color-warn) 30%, transparent)',
              color: 'var(--color-warn)',
            }}
          >
            Нет ни одного шаблона. Попросите администратора создать шаблон в{' '}
            <Link href="/dashboard/settings/templates" className="underline">
              настройках шаблонов
            </Link>
            .
          </div>
        )}
      </section>

      {/* ── Кнопки ── */}
      <div className="flex gap-3 pb-8">
        <Link
          href="/dashboard/projects"
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}
        >
          <X className="w-4 h-4" />
          Отмена
        </Link>
        <button
          type="submit"
          disabled={loading || !form.name.trim() || !form.template_id}
          className="flex-1 flex items-center justify-center gap-2 btn-green disabled:opacity-40 text-sm font-semibold py-3"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Создание...</>
          ) : (
            <><Plus className="w-4 h-4" />Создать проект</>
          )}
        </button>
      </div>
    </form>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pluralStages(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'этап'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'этапа'
  return 'этапов'
}

function Field({ label, required, icon, children }: {
  label: string
  required?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 mb-2">
        {icon && <span style={{ color: 'var(--text-dim)' }}>{icon}</span>}
        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {required && <span className="text-xs" style={{ color: 'var(--green)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}
