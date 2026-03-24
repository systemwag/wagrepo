'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, ArrowRightLeft, UserCircle2, Clock, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface HandoverTask {
  id: string
  title: string
  fromUser: string
  toUser: string
  stage: string
  dateSent: string
  status: 'pending_my_acceptance' | 'pending_their_acceptance'
}

interface Props {
  incomingTasks: HandoverTask[]
  outgoingTasks: HandoverTask[]
}

export default function HandoverBoard({ incomingTasks, outgoingTasks }: Props) {
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Функция форматирования времени
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  // Обработчик принятия задачи
  const handleAccept = async (taskId: string) => {
    setProcessingId(taskId)
    const supabase = createClient()
    
    // Меняем статус задачи на 'in_progress', что для нас означает "Принята в работу"
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', taskId)

    if (error) {
      console.error(error)
      alert("Ошибка при принятии задачи")
      setProcessingId(null)
    } else {
      // Искусственно задерживаем для визуального эффекта
      setTimeout(() => {
        window.location.reload()
      }, 500)
    }
  }

  // Обработчик отклонения (в демо просто возвращает статус обратно, или ставит "cancelled" / "review")
  // Для простоты, демо-версия просто скрывает ее или пишет alert. 
  // В реальной системе тут было бы изменение статуса на 'rejected' или возврат assignee_id
  const handleReject = (taskId: string) => {
    alert("В боевой версии эта задача вернулась бы обратно передающему с красным флагом 'ОТКЛОНЕНО'.")
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      
      {/* Левая колонка: ВХОДЯЩИЕ (Ждут принятия) */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[color:var(--text)]">Ожидают вашего принятия</h2>
            <p className="text-xs text-[color:var(--text-muted)]">Вы не начнете работу, пока не нажмете «Принять»</p>
          </div>
          <span className="ml-auto bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            {incomingTasks.length}
          </span>
        </div>

        {incomingTasks.length === 0 ? (
          <div className="p-8 border border-dashed rounded-2xl text-center text-[color:var(--text-muted)]">
            Нет входящих передач
          </div>
        ) : (
          incomingTasks.map(task => (
            <div key={task.id} className="p-5 rounded-2xl border bg-[color:var(--surface)] hover:border-amber-500/50 transition-colors shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
              
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-[color:var(--text)] pr-4">{task.title}</h3>
                <span className="shrink-0 text-[10px] font-bold tracking-wider uppercase text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md">
                  Входящий
                </span>
              </div>
              
              <div className="flex flex-col gap-2 mb-5">
                <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
                  <UserCircle2 size={16} /> <span>От кого: <strong>{task.fromUser}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
                  <ArrowRightLeft size={16} /> <span>Этап/Проект: <strong>{task.stage}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
                  <Clock size={16} /> <span>Передано: {formatTime(task.dateSent)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => handleAccept(task.id)}
                  disabled={processingId !== null}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {processingId === task.id ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />} 
                  {processingId === task.id ? 'Принятие...' : 'Принять в работу'}
                </button>
                <button 
                  onClick={() => handleReject(task.id)}
                  disabled={processingId !== null}
                  className="flex-1 bg-[color:var(--surface-2)] hover:bg-red-500/10 border border-[color:var(--border)] hover:border-red-500/30 hover:text-red-500 text-[color:var(--text)] rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <XCircle size={18} /> Отклонить (Нет ТЗ)
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Правая колонка: ИСХОДЯЩИЕ (Вы передали) */}
      <div className="flex flex-col gap-4 opacity-80">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Clock size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[color:var(--text)]">Переданные вами</h2>
            <p className="text-xs text-[color:var(--text-muted)]">Ответственность всё еще на вас</p>
          </div>
          <span className="ml-auto bg-[color:var(--surface-2)] text-[color:var(--text-muted)] border text-xs font-bold px-3 py-1 rounded-full">
            {outgoingTasks.length}
          </span>
        </div>

        {outgoingTasks.length === 0 ? (
          <div className="p-8 border border-dashed rounded-2xl text-center text-[color:var(--text-muted)]">
            Вы ничего не передавали
          </div>
        ) : (
          outgoingTasks.map(task => (
            <div key={task.id} className="p-5 rounded-2xl border bg-[color:var(--surface-2)] shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-[color:var(--text)] line-through opacity-70 pr-4">{task.title}</h3>
                <span className="shrink-0 text-[10px] font-bold tracking-wider uppercase text-blue-500 bg-blue-500/10 px-2 py-1 rounded-md">
                  Ожидание принятия
                </span>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
                  <UserCircle2 size={16} /> <span>Кому передано: <strong>{task.toUser}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[color:var(--text)]">
                  <span className="animate-pulse w-2 h-2 rounded-full bg-blue-500 inline-block mr-1"></span>
                  Коллега пока не принял задачу. Сроки горят на <strong>вас</strong>.
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}
