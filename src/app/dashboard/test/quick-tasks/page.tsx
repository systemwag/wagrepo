import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import QuickTaskForm from '@/components/assign/QuickTaskForm'

export default async function QuickTasksTestPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  // Получаем список сотрудников
  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name, position')
    .in('role', ['employee', 'manager'])
    .order('full_name', { ascending: true })

  const safeEmployees = (employees ?? []) as { id: string; full_name: string; position: string | null }[]

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          Быстрые поручения <span className="text-green-500 text-lg align-top ml-2">[ТЕСТ]</span>
        </h1>
        <p className="mt-2 text-[color:var(--text-muted)] leading-relaxed">
          Упрощенная форма создания задачи. Смысл в том, чтобы руководитель мог буквально в два клика сбросить задачу нужному человеку, даже находясь на объекте со смартфона.
        </p>
      </div>
      
      {/* Форма быстрых поручений */}
      <QuickTaskForm employees={safeEmployees} />
      
      <div className="mt-12 p-6 rounded-2xl bg-[color:var(--surface-2)] border border-[color:var(--border)] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          {/* Декор */}
          <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 22h20L12 2zm0 3.8l7.2 14.4H4.8L12 5.8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[color:var(--text)] mb-2">Как это работает?</h3>
        <ul className="list-disc list-inside text-sm text-[color:var(--text-muted)] space-y-2">
          <li>Без ввода заголовков. Заголовок генерируется из первых слов текста.</li>
          <li>Никаких календарей. Только кнопки «Сегодня», «Завтра», «Пятница».</li>
          <li>Задача автоматически получает статус <strong>Критичный/Высокий</strong> и отправляется в Журнал, а у сотрудника загорается уведомление.</li>
        </ul>
      </div>
    </div>
  )
}
