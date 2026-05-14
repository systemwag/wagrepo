'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, ArrowRightLeft, UserCircle2, Clock, Loader2, X } from 'lucide-react'
import { acceptHandover, rejectHandover, type HandoverKind } from '@/lib/actions/handover'
import type { HandoverEntry } from '@/app/dashboard/handover/queries'

type Props = {
  incoming: HandoverEntry[]
  outgoing: HandoverEntry[]
}

export default function HandoverBoard({ incoming, outgoing }: Props) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorBy, setErrorBy] = useState<Record<string, string>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Локально убираем принятые/отклонённые — UX без задержек
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  function formatTime(iso: string) {
    return new Date(iso).toLocaleDateString('ru-RU', {
      timeZone: 'Asia/Oral', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  async function handleAccept(kind: HandoverKind, taskId: string) {
    setPendingId(taskId)
    setErrorBy(prev => { const n = { ...prev }; delete n[taskId]; return n })
    setHiddenIds(prev => new Set(prev).add(taskId))
    const res = await acceptHandover(kind, taskId)
    setPendingId(null)
    if (res.error) {
      setHiddenIds(prev => { const n = new Set(prev); n.delete(taskId); return n })
      setErrorBy(prev => ({ ...prev, [taskId]: res.error! }))
    } else {
      router.refresh()
    }
  }

  function startReject(taskId: string) {
    setRejectingId(taskId)
    setRejectReason('')
  }

  function cancelReject() {
    setRejectingId(null)
    setRejectReason('')
  }

  async function confirmReject(kind: HandoverKind, taskId: string) {
    if (!rejectReason.trim()) {
      setErrorBy(prev => ({ ...prev, [taskId]: 'Опишите причину отклонения' }))
      return
    }
    setPendingId(taskId)
    setErrorBy(prev => { const n = { ...prev }; delete n[taskId]; return n })
    setHiddenIds(prev => new Set(prev).add(taskId))
    const res = await rejectHandover(kind, taskId, rejectReason)
    setPendingId(null)
    setRejectingId(null)
    setRejectReason('')
    if (res.error) {
      setHiddenIds(prev => { const n = new Set(prev); n.delete(taskId); return n })
      setErrorBy(prev => ({ ...prev, [taskId]: res.error! }))
    } else {
      router.refresh()
    }
  }

  const visibleIncoming = incoming.filter(t => !hiddenIds.has(t.id))
  const visibleOutgoing = outgoing.filter(t => !hiddenIds.has(t.id))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* ── Входящие ───────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'color-mix(in oklab, var(--color-warn) 12%, transparent)', color: 'var(--color-warn)' }}>
            <ArrowRightLeft size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-text">Ждут вашего принятия</h2>
            <p className="text-xs text-text-muted">Работа не начнётся, пока не примете</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'var(--color-warn)', color: '#000' }}>
            {visibleIncoming.length}
          </span>
        </div>

        {visibleIncoming.length === 0 ? (
          <EmptyHint text="Нет входящих" />
        ) : (
          visibleIncoming.map(task => (
            <div key={task.id}
              className="rounded-2xl p-4 relative overflow-hidden"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="absolute left-0 top-0 w-1 h-full" style={{ background: 'var(--color-warn)' }} />
              <div className="flex justify-between items-start mb-3 gap-3">
                <h3 className="font-semibold text-text leading-snug pr-2">{task.title}</h3>
                <KindBadge kind={task.kind} />
              </div>
              <div className="flex flex-col gap-1.5 mb-4 text-sm">
                <Row icon={<UserCircle2 size={14} />} label="От" value={task.fromUser} />
                <Row icon={<ArrowRightLeft size={14} />} label="Контекст" value={task.context} />
                <Row icon={<Clock size={14} />} label="Передано" value={formatTime(task.dateSent)} muted />
              </div>

              {errorBy[task.id] && (
                <div className="mb-3 text-xs px-3 py-2 rounded-lg"
                  style={{ color: 'var(--color-danger)', background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)', border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)' }}>
                  {errorBy[task.id]}
                </div>
              )}

              {rejectingId === task.id ? (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Причина отклонения…"
                    rows={2}
                    className="input text-sm resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmReject(task.kind, task.id)}
                      disabled={pendingId === task.id || !rejectReason.trim()}
                      className="flex-1 text-sm font-semibold py-2 rounded-xl disabled:opacity-40 flex items-center justify-center gap-1.5"
                      style={{ background: 'color-mix(in oklab, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in oklab, var(--color-danger) 30%, transparent)' }}
                    >
                      {pendingId === task.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                      Отклонить
                    </button>
                    <button
                      onClick={cancelReject}
                      className="px-3 py-2 rounded-xl text-sm"
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(task.kind, task.id)}
                    disabled={pendingId !== null}
                    className="flex-1 btn-green text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {pendingId === task.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Принять
                  </button>
                  <button
                    onClick={() => startReject(task.id)}
                    disabled={pendingId !== null}
                    className="text-sm font-medium py-2 px-3 rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                  >
                    <XCircle size={14} />
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {/* ── Исходящие ──────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
            <Clock size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-text">Переданные вами</h2>
            <p className="text-xs text-text-muted">Ответственность всё ещё на вас, пока коллега не принял</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
            {visibleOutgoing.length}
          </span>
        </div>

        {visibleOutgoing.length === 0 ? (
          <EmptyHint text="Нет переданных" />
        ) : (
          visibleOutgoing.map(task => (
            <div key={task.id}
              className="rounded-2xl p-4"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <div className="flex justify-between items-start mb-3 gap-3">
                <h3 className="font-semibold text-text leading-snug line-through opacity-70 pr-2">{task.title}</h3>
                <KindBadge kind={task.kind} muted />
              </div>
              <div className="flex flex-col gap-1.5 text-sm">
                <Row icon={<UserCircle2 size={14} />} label="Кому" value={task.toUser} />
                <Row icon={<ArrowRightLeft size={14} />} label="Контекст" value={task.context} />
                <div className="flex items-center gap-2 text-xs mt-1" style={{ color: '#60a5fa' }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#60a5fa' }} />
                  Ждёт принятия
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

function Row({ icon, label, value, muted }: { icon: React.ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2" style={{ color: muted ? 'var(--color-text-dim)' : 'var(--color-text-muted)' }}>
      {icon}
      <span className="text-xs">{label}:</span>
      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{value}</span>
    </div>
  )
}

function KindBadge({ kind, muted }: { kind: 'direct' | 'project'; muted?: boolean }) {
  const label = kind === 'direct' ? 'Поручение' : 'Задача'
  const color = kind === 'direct' ? 'var(--color-warn)' : '#60a5fa'
  return (
    <span
      className="shrink-0 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md"
      style={{
        color,
        background: `color-mix(in oklab, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in oklab, ${color} 25%, transparent)`,
        opacity: muted ? 0.7 : 1,
      }}
    >
      {label}
    </span>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      className="p-6 rounded-2xl text-center text-sm"
      style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)', color: 'var(--color-text-dim)' }}
    >
      {text}
    </div>
  )
}
