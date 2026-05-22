# Дорожная карта визуальных улучшений и анимаций WAG System

Внутренняя система West Arlan Group (WAG System) построена на принципах строгого инженерного минимализма: тёмная палитра, тонкая фоновая сетка, отсутствие лишних элементов и эмодзи. Однако в некоторых сценариях интерфейс ощущается избыточно плоским и статичным.

Ниже представлена детально проработанная дорожная карта визуальной полировки и точечной микро-анимации (Версия 1). Каждое улучшение спроектировано без использования тяжёлых библиотек (Framer Motion, GSAP, Lottie отсутствуют) и опирается исключительно на современные нативные технологии: CSS-переменные, `@starting-style`, View Transitions API и Web Animations API.

---

## Предложение 1. Пульсация и деликатная вибрация колокольчика (NotificationBell)

### Пользовательский эффект
Появление уведомлений в системе происходит бесшумно — счётчик на кнопке колокольчика обновляется моментально, но без визуального акцента. Из-за этого сотрудники на объектах или руководители в суете пропускают назначение критических поручений или отзывы. При получении нового уведомления в реальном времени иконка колокольчика совершит деликатную пружинную вибрацию из стороны в сторону (shake/wiggle), а на зелёном индикаторе непрочитанных отобразится мягкий затухающий импульс свечения. Это привлечёт боковое зрение пользователя к важному событию, но не вызовет раздражения.

### Конкретные файлы и текущее состояние
* **src/app/globals.css** (500 строк) — содержит глобальные переменные и базовые стили анимаций.
* **src/components/NotificationBell.tsx** (186 строк) — клиентский компонент подписки на уведомления. Текущая кнопка колокольчика статично отображает число непрочитанных элементов.

### Что добавляем

В `src/app/globals.css` определяем ключевые кадры и утилитарные классы:

```css
@keyframes bell-shake {
  0%, 100% { transform: rotate(0deg) scale(1); }
  15% { transform: rotate(-10deg) scale(1.08); }
  30% { transform: rotate(8deg) scale(1.08); }
  45% { transform: rotate(-6deg) scale(1.05); }
  60% { transform: rotate(4deg) scale(1.03); }
  75% { transform: rotate(-2deg) scale(1.01); }
}

@keyframes green-glow-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--color-green) 50%, transparent); }
  100% { box-shadow: 0 0 0 8px color-mix(in oklab, var(--color-green) 0%, transparent); }
}

.animate-bell-shake {
  animation: bell-shake 0.65s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

.animate-green-pulse {
  animation: green-glow-pulse 1.2s cubic-bezier(0.24, 0, 0.38, 1) infinite;
}
```

В `src/components/NotificationBell.tsx` внедряем логику запуска вибрации при приходе уведомления из Supabase Realtime:

```typescript
// Внутри компонента NotificationBell
const [shouldShake, setShouldShake] = useState(false);

useEffect(() => {
  // ... логика подписки на supabase
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
    (payload) => {
      setNotifications(prev => [payload.new as NotificationRow, ...prev])
      // Запускаем анимацию вибрации
      setShouldShake(true)
    }
  )
  // ...
}, [userId])

// Сброс класса после завершения анимации
useEffect(() => {
  if (!shouldShake) return
  const t = setTimeout(() => setShouldShake(false), 650)
  return () => clearTimeout(t)
}, [shouldShake])

// Применение классов в JSX:
// Добавляем class `animate-bell-shake` на <button onClick={() => setOpen(!open)} className={`... ${shouldShake ? 'animate-bell-shake' : ''}`}>
// Добавляем class `animate-green-pulse` на индикатор непрочитанных <span>
```

---

## Предложение 2. Премиальное мерцание (Shimmer Effect) для Skeleton-загрузок

### Пользовательский эффект
В текущем состоянии системные скелетоны используют стандартный класс `animate-pulse`, который заставляет всю заглушку плавно затухать и загораться. На медленном мобильном интернете (3G на удалённых строительных объектах в Уральске) такое поведение выглядит монотонным и создаёт ощущение "зависшего" приложения. Замена пульсации на плавное благородное смещение световой волны слева направо (shimmer sweep) делает ожидание данных визуально непрерывным, создавая ощущение премиального, быстрого и отзывчивого софта (как в Slack или Vercel).

### Конкретные файлы и текущее состояние
* **src/app/globals.css** (500 строк) — содержит стили фонов и анимаций.
* **src/components/ui/Skeleton.tsx** (77 строк) — содержит хелперы отрисовки скелетонов. Сейчас цвет блоков задаётся статично через переменную `BAR` (`background: 'var(--border-2)'`), а в обёртках используется стандартный `animate-pulse`.

### Что добавляем

В `src/app/globals.css` определяем стили мерцания:

```css
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.shimmer-element {
  background: linear-gradient(
    90deg,
    var(--color-surface-2) 25%,
    color-mix(in oklab, var(--color-border-2) 65%, var(--color-surface-2)) 37%,
    var(--color-surface-2) 63%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s infinite linear;
}
```

В `src/components/ui/Skeleton.tsx` заменяем статический стиль `BAR` на использование класса:

```typescript
// Вносим правки в хелперы, убирая инлайновые стили BAR и вешая класс shimmer-element
export function SkeletonBar({ w = 'w-32', h = 'h-4', className = '' }: { w?: string; h?: string; className?: string }) {
  return <div className={`${h} ${w} rounded shimmer-element ${className}`} />
}

export function SkeletonHeader({ title = 'w-48', subtitle = 'w-32' }: { title?: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <div className="h-8 rounded-xl mb-2 shimmer-element w-full" />
      <div className={`h-4 ${subtitle} rounded mt-2 shimmer-element`} />
    </div>
  )
}

// Аналогично правим SkeletonRows и общий PageListSkeleton, убирая избыточный глобальный animate-pulse
```

---

## Предложение 3. Мягкий 3D-подъём и неоновое свечение карточек проектов при наведении на десктопе

### Пользовательский эффект
На десктопе при наведении курсора на ключевые карточки проектов (`ProjectCard`) элемент просто лениво меняет цвет фона на чуть более светлый. Это выглядит функционально, но плоско. Интеграция легкого пружинного приподнимания карточки на десктопе (`translateY(-2px) scale(1.005)`) вместе с плавным проявлением изумрудного неонового свечения (border-color и box-shadow на основе `color-mix` с `--color-green`) даёт пользователю глубокое физическое ощущение интерактивности и качества сборки интерфейса.

### Конкретные файлы и текущее состояние
* **src/app/globals.css** (500 строк).
* **src/components/projects/ProjectCard.tsx** (166 строк) — отвечает за отображение карточек проектов в общем списке. Сейчас использует стандартный класс `group transition-colors hover:bg-surface-2/40 hover-border`.

### Что добавляем

В `src/app/globals.css` добавляем премиальный класс подъёма:

```css
.hover-card-premium {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
              background-color 0.2s ease,
              border-color 0.2s ease,
              box-shadow 0.2s ease;
}

@media (hover: hover) {
  .hover-card-premium:hover {
    transform: translateY(-2px) scale(1.005);
    background-color: color-mix(in oklab, var(--color-surface-2) 60%, transparent);
    border-color: color-mix(in oklab, var(--color-green) 25%, transparent) !important;
    box-shadow: 
      0 12px 24px -10px color-mix(in oklab, var(--color-green) 10%, transparent),
      0 0 1px 1px color-mix(in oklab, var(--color-green) 12%, transparent);
  }
}
```

В `src/components/projects/ProjectCard.tsx` обновляем классы корневого `TransitionLink`:

```diff
-      className={`card relative group block overflow-hidden transition-colors hover:bg-surface-2/40 hover-border
+      className={`card relative group block overflow-hidden hover-card-premium
```

---

## Предложение 4. Бесшовный морфинг вопросов в модуле опросов через View Transitions API

### Пользовательский эффект
При клике на опрос в списке страница резко гаснет, и после загрузки открывается страница деталей. Переход карточки списка к детальной странице через View Transitions с shared-element связыванием плавно переносит текст вопроса из списка в заголовок страницы. Пользователь видит красивое нативное перетекание и растягивание текста без эффекта раздражающей перезагрузки страницы.

### Конкретные файлы и текущее состояние
* **src/app/dashboard/polls/MyPollsList.tsx** (188 строк) — список опросов. Сейчас использует обычный `Link` из `next/link`.
* **src/app/dashboard/polls/[id]/page.tsx** (450 строк) — детальная страница опроса.

### Что добавляем

В `src/app/dashboard/polls/MyPollsList.tsx` заменяем импорт `Link` на наш `TransitionLink` и вешаем `viewTransitionName`:

```typescript
import { TransitionLink } from '@/components/ui/TransitionLink'

// Внутри Row:
return (
  <TransitionLink
    href={`/dashboard/polls/${poll.id}`}
    className="flex items-start gap-3 px-4 py-3 @md:px-6 transition-colors hover:bg-surface-2/40"
    style={{ borderBottom: !isLast ? '1px solid var(--color-border)' : undefined }}
  >
    <div className="flex-1 min-w-0">
      <p 
        className="text-sm font-medium text-text leading-snug"
        style={{ viewTransitionName: `poll-question-${poll.id}` } as React.CSSProperties}
      >
        {poll.question}
      </p>
      {/* ... остальная мета ... */}
    </div>
    <ArrowRight size={16} className="text-text-dim shrink-0 mt-1" />
  </TransitionLink>
)
```

В `src/app/dashboard/polls/[id]/page.tsx` привязываем парное имя к заголовку:

```typescript
// Внутри PollDetailPage JSX в PageHeader:
<PageHeader
  icon={<MessageCircleQuestion size={18} />}
  iconTone="info"
  title={
    <span style={{ viewTransitionName: `poll-question-${id}` } as React.CSSProperties}>
      {poll.question}
    </span>
  }
  // ...
/>
```

---

## Предложение 5. Пружинный физический отклик кнопок при отправке форм

### Пользовательский эффект
При нажатии на кнопку «Отправить ответ» или «Сохранить» кнопка мгновенно блокируется, превращаясь в плоский лоадер. Это ощущается сухо. Добавление деликатного пружинного сжатия кнопки (`scale(0.96)`) при непосредственном клике (активное состояние) с последующей мягкой прорисовкой иконки успеха (`Check`) через быстрый CSS-переход дарит пользователю приятное физическое удовлетворение от отправки формы и подтверждает завершённость действия на тактильном уровне.

### Конкретные файлы и текущее состояние
* **src/app/globals.css** (500 строк) — содержит стили интерактивных кнопок.
* **src/app/dashboard/polls/[id]/RespondForm.tsx** (160 строк) — форма отправки ответа на опрос. Использует стандартную кнопку с инлайновыми стилями.

### Что добавляем

В `src/app/globals.css` регистрируем пружинный класс активного состояния:

```css
.btn-spring-active {
  transition: transform 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              background-color 0.2s ease,
              box-shadow 0.2s ease;
}

.btn-spring-active:active:not(:disabled) {
  transform: scale(0.96);
}

@keyframes check-pop {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.animate-check-pop {
  animation: check-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
```

В `src/app/dashboard/polls/[id]/RespondForm.tsx` добавляем класс и анимируем галочку при завершении:

```typescript
// Внутри RespondForm JSX кнопки submit:
<button
  type="submit"
  disabled={pending}
  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 btn-spring-active"
  style={{ background: 'var(--color-green)', color: '#000' }}
>
  {pending ? (
    <Loader2 size={15} className="animate-spin" />
  ) : (
    <Check size={15} className="animate-check-pop" />
  )}
  Отправить ответ
</button>
```

---

## Открытые вопросы для обсуждения

> [!NOTE]
> 1. Стоит ли применить Shimmer-эффект не ко всем скелетонам, а только к основным спискам (`SkeletonRows`), оставив шапки статичными, чтобы не перегружать интерфейс мерцанием при первом рендере?
> 2. Хотите ли вы, чтобы пружинный эффект кнопки `.btn-spring-active` был автоматически применён ко всем кнопкам в проекте (классы `.btn-green` и `.btn-green:active` в `globals.css`), или мы оставим его локальным для форм отправки (`RespondForm`, `DailyReportForm` и т.д.)?

---

## План верификации

### Ручное тестирование в браузере
1. **Эмуляция уведомлений:** В Supabase SQL Editor запускаем тестовый запрос `INSERT INTO notifications ...` и визуально оцениваем деликатность анимации и отсутствие зацикливания вибрации на колокольчике.
2. **Мерцание скелетонов:** В инструментах разработчика переходим на вкладку "Network", включаем ограничение "Slow 3G", перезагружаем страницу проектов `/dashboard/projects` и проверяем плавность прохода световой волны shimmer.
3. **View Transitions:** Нажимаем на карточку опроса в `/dashboard/polls` и обратно, следя за тем, чтобы текст плавно масштабировался и перетекал, не разрывая визуальный контекст.
4. **Физический клик:** Заполняем форму опроса, зажимаем кнопку мыши на «Отправить ответ» для проверки масштабирования, затем отпускаем и контролируем появление плавной анимации галочки.
