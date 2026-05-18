import { redirect } from 'next/navigation'
import { User, Mail, Briefcase, Building2, Shield, Bell, KeyRound } from 'lucide-react'
import { createClient, getProfile, getUser } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import PushToggle from '@/components/PushToggle'
import ProfileForm from './ProfileForm'
import PasswordForm from './PasswordForm'

const ROLE_LABEL: Record<string, string> = {
  admin:    'Администратор',
  director: 'Директор',
  manager:  'Менеджер',
  employee: 'Сотрудник',
}

export default async function ProfilePage() {
  const [profile, user] = await Promise.all([getProfile(), getUser()])
  if (!profile || !user) redirect('/login')

  // Перечитаем профиль напрямую — getProfile кешируется на 60s, а тут хочется
  // свежий phone/birth_date сразу после сохранения.
  const supabase = await createClient()
  const { data: fresh } = await supabase
    .from('profiles')
    .select('id, full_name, role, position, department, phone, birth_date')
    .eq('id', profile.id)
    .single()

  const p = fresh ?? profile
  const initial = p.full_name.charAt(0).toUpperCase()

  return (
    <div>
      <PageHeader
        icon={<User size={18} />}
        iconTone="info"
        title="Мой профиль"
        subtitle="Контактные данные, пароль и уведомления"
      />

      {/* Заголовочная карточка с аватаром и ключевыми фактами */}
      <Card className="mb-4 md:mb-6">
        <div className="p-4 md:p-6 flex items-center gap-4 flex-wrap">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0"
            style={{
              background: 'color-mix(in oklab, var(--color-green) 15%, transparent)',
              color: 'var(--color-green)',
              border: '1px solid color-mix(in oklab, var(--color-green) 25%, transparent)',
            }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-text truncate">{p.full_name}</h2>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: 'color-mix(in oklab, var(--color-info) 12%, transparent)',
                  color:      'var(--color-info)',
                  border:     '1px solid color-mix(in oklab, var(--color-info) 25%, transparent)',
                }}
              >
                <Shield size={12} className="inline mr-1 -mt-0.5" />
                {ROLE_LABEL[p.role] ?? p.role}
              </span>
              {p.position && (
                <span className="text-xs text-text-muted inline-flex items-center gap-1">
                  <Briefcase size={12} /> {p.position}
                </span>
              )}
              {p.department && (
                <span className="text-xs text-text-muted inline-flex items-center gap-1">
                  <Building2 size={12} /> {p.department}
                </span>
              )}
              <span className="text-xs text-text-muted inline-flex items-center gap-1">
                <Mail size={12} /> {user.email}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        {/* Личная информация (редактируемая) */}
        <Card>
          <CardHeader icon={<User size={18} />} title="Личная информация" />
          <div className="p-4 md:p-6">
            <ProfileForm
              initial={{
                full_name:  p.full_name,
                position:   p.position ?? '',
                department: p.department ?? '',
                phone:      p.phone ?? '',
                birth_date: p.birth_date ?? '',
              }}
              email={user.email ?? ''}
            />
          </div>
        </Card>

        {/* Безопасность */}
        <Card>
          <CardHeader icon={<KeyRound size={18} />} iconColor="var(--color-warn)" title="Безопасность" />
          <div className="p-4 md:p-6">
            <PasswordForm />
          </div>
        </Card>

        {/* Уведомления */}
        <Card className="lg:col-span-2">
          <CardHeader icon={<Bell size={18} />} title="Уведомления" />
          <div className="p-4 md:p-6">
            <PushToggle />
            <p className="text-xs text-text-dim -mt-2">
              Push-уведомления приходят на это устройство. На каждом устройстве настраивается отдельно.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
