'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Неверный email или пароль')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-bg relative overflow-hidden">
      {/* ─── Фоновые эффекты ──────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Зелёное свечение сверху-центра */}
        <div
          className="absolute -top-48 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(ellipse, var(--color-green) 0%, transparent 70%)' }}
        />
        {/* Золотое свечение снизу-слева */}
        <div
          className="absolute -bottom-32 -left-32 w-[600px] h-[600px] rounded-full opacity-15 blur-3xl hidden lg:block"
          style={{ background: 'radial-gradient(circle, #d4a843 0%, transparent 70%)' }}
        />
      </div>

      {/* ─── Левая панель — бренд ─────────────────────────────────────── */}
      <aside className="relative hidden lg:flex flex-col items-start justify-center p-12 xl:p-16 border-r border-border overflow-hidden">
        {/* Инженерная сетка на фоне — мягкая, чтобы не пересекать текст */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(color-mix(in oklab, var(--color-green) 8%, transparent) 1px, transparent 1px),' +
              'linear-gradient(90deg, color-mix(in oklab, var(--color-green) 8%, transparent) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage:
              'radial-gradient(ellipse 70% 55% at 30% 50%, transparent 0%, black 90%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 70% 55% at 30% 50%, transparent 0%, black 90%)',
          }}
        />

        {/* Верх: Лого */}
        <div className="absolute top-12 xl:top-16 left-12 xl:left-16 z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gold.svg" alt="WAG" className="w-56 xl:w-72 h-auto" />
        </div>

        {/* Центр: слоган */}
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight text-text">
            Платформа управления{' '}
            <span style={{
              background: 'linear-gradient(120deg, #E8C567 0%, #FFE89C 50%, #B98A28 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              проектами
            </span>
            <br />West Arlan Group
          </h2>
          <p className="mt-4 text-text-muted text-base leading-relaxed">
            Проектирование зданий, ПСД, Госэкспертиза — единая среда для офиса
            и полевых команд. Прозрачная отчётность от поручения до сдачи.
          </p>

          {/* Метрики */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-sm">
            <Metric value="8" label="этапов цикла" />
            <Metric value="40+" label="сотрудников" />
            <Metric value="24/7" label="доступ" />
          </div>
        </div>

        {/* Низ: подпись */}
        <p className="absolute bottom-12 xl:bottom-16 left-12 xl:left-16 z-10 text-xs text-text-dim">
          West Arlan Group © {new Date().getFullYear()}
        </p>
      </aside>

      {/* ─── Правая панель — форма ────────────────────────────────────── */}
      <main className="relative flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm relative animate-fade-up">
          {/* Лого только на мобильном */}
          <div className="lg:hidden text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gold.svg" alt="WAG" className="w-44 h-auto mx-auto" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text">Вход в систему</h1>
            <p className="text-sm mt-1.5 text-text-muted">
              Введите учётные данные, чтобы продолжить
            </p>
          </div>

          {/* Форма в карточке */}
          <div
            className="rounded-2xl p-6 backdrop-blur"
            style={{
              background: 'color-mix(in oklab, var(--color-surface) 90%, transparent)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 24px 48px -16px rgba(0,0,0,0.5)',
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field
                label="Email"
                icon={<Mail size={16} />}
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@westarlan.kz"
              />

              <Field
                label="Пароль"
                icon={<Lock size={16} />}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />

              {error && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm animate-fade-in"
                  style={{
                    background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)',
                    color: 'var(--color-danger)',
                  }}
                >
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-green w-full mt-2 group flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Вход…' : 'Войти'}</span>
                {!loading && (
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs mt-6 text-text-dim lg:hidden">
            West Arlan Group © {new Date().getFullYear()}
          </p>
        </div>
      </main>
    </div>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold text-text num leading-none">{value}</p>
      <p className="text-xs text-text-dim mt-1">{label}</p>
    </div>
  )
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  icon: React.ReactNode
}

function Field({ label, icon, ...props }: FieldProps) {
  return (
    <div>
      <label className="block text-sm mb-1.5 text-text-muted">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none">
          {icon}
        </span>
        <input {...props} className="input pl-10" />
      </div>
    </div>
  )
}
