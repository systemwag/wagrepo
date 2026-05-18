# План интеграции дедлайнов и поручений в календарь

Цель: Превратить `EventsCalendar.tsx` из обычного календаря мероприятий во всеобъемлющий дэшборд, который отображает:
1. События (текущий функционал)
2. Поручения руководства (прямые задачи, `tasks`)
3. Дедлайны по проектам (`projects`)
4. Дедлайны по этапам проектов (`project_stages`)

## 1. Изменение типов данных в `EventsCalendar.tsx`

Текущий тип `EventRow` заточен только под мероприятия. Необходимо создать универсальный интерфейс `CalendarItem`, который унифицирует все сущности:

```typescript
type CalendarItemType = 'event' | 'task' | 'project' | 'stage';

type CalendarItem = {
  id: string; // ID сущности
  item_type: CalendarItemType;
  title: string;
  description: string | null;
  date: string; // Для мероприятий date, для задач/дедлайнов - deadline приведенный к YYYY-MM-DD
  start_time?: string | null; // Только для events
  end_time?: string | null;   // Только для events
  importance: EventImportance; // Приоритет карточки для цветового оформления
  location?: string | null;
  
  // Дополнительные мета-данные в зависимости от типа
  meta?: {
    participants?: number; // для events
    assignee_name?: string; // для задач и этапов
    project_id?: string;    // для projects и stages
    status?: string;        // для отслеживания (выполнено или нет)
  };
}
```

## 2. Обновление логики загрузки данных (`fetchEvents`)

Функцию `fetchEvents` необходимо переименовать в `fetchCalendarData` и научить делать несколько параллельных запросов к Supabase. 

```typescript
const fetchCalendarData = useCallback(async () => {
  setLoading(true);
  const supabase = createClient();
  const from = `${year}-${pad(month)}-01`;
  const to = `${year}-${pad(month)}-${pad(lastDay)}`;

  // 1. Мероприятия (events)
  const eventsPromise = supabase
    .from('events')
    .select('*, event_participants(user_id, profiles(id, full_name))')
    .gte('date', from)
    .lte('date', to);

  // 2. Поручения руководства (tasks - дедлайны)
  const tasksPromise = supabase
    .from('tasks')
    .select('id, title, description, priority, deadline, status, assignee_id, profiles!assignee_id(full_name)')
    .gte('deadline', from)
    .lte('deadline', to);

  // 3. Проекты (projects - дедлайны)
  const projectsPromise = supabase
    .from('projects')
    .select('id, name, deadline, manager_id, profiles!manager_id(full_name)')
    .gte('deadline', from)
    .lte('deadline', to);

  // 4. Этапы проектов (project_stages - дедлайны)
  const stagesPromise = supabase
    .from('project_stages')
    .select('id, name, deadline, project_id, status, assignee_id, profiles!assignee_id(full_name)')
    .gte('deadline', from)
    .lte('deadline', to);

  const [resEvents, resTasks, resProjects, resStages] = await Promise.all([
    eventsPromise, tasksPromise, projectsPromise, stagesPromise
  ]);

  // Далее: Маппинг всех ответов в единый массив типа CalendarItem[] 
  // ...
  // Сортировка по времени (start_time) или по типу/приоритету
}, [year, month]);
```

### Правила приведения типов (Mapping):
* **Поручения (Tasks)**: 
  * `date` = `deadline` (обрезанный до 'YYYY-MM-DD')
  * `importance` = маппинг `priority` (low, medium, high, critical)
* **Проекты (Projects)**:
  * `date` = `deadline`
  * `importance` = `critical` (дедлайны проектов всегда важны)
* **Этапы проектов (Stages)**:
  * `date` = `deadline`
  * `importance` = `high`

## 3. Обновление UI (Отображение карточек)

Внутри компонента отрисовки карточек для каждого `CalendarItem` нужно добавить визуальные отличия:

* Использовать новые иконки (lucide-react):
  * `Calendar` / `Users` — для мероприятий.
  * `ClipboardList` / `CheckSquare` — для поручений.
  * `Building2` / `Flag` — для дедлайнов проектов.
* В карточке поручения: выводить имя ответственного (`meta.assignee_name`).
* Цветовое кодирование: для проектов и этапов, если дедлайн просрочен (сегодня > deadline), карточка может мигать или иметь особую красную рамку.

## 4. Навигация при клике (Interactivity)

Сейчас `onClick={e => openView(ev, e)}` открывает модалку мероприятия. Нужно добавить ветвление:

```typescript
function handleItemClick(item: CalendarItem, e: React.MouseEvent) {
  e.stopPropagation();
  
  if (item.item_type === 'event') {
    // Открываем модальное окно просмотра/редактирования события
    setModal({ mode: 'view', event: originalEventData });
  } else if (item.item_type === 'task') {
    // Направляем на страницу задач (или открываем модалку задачи)
    router.push(`/dashboard/tasks`);
  } else if (item.item_type === 'project' || item.item_type === 'stage') {
    // Направляем внутрь проекта
    router.push(`/dashboard/projects/${item.meta?.project_id || item.id}`);
  }
}
```

## 5. Обновление Quick Create (создание из календаря)

Модальное окно быстрого создания (Quick Create Popover) в календаре (сейчас содержит `QUICK_TYPES`) можно расширить:
1. Добавить таб или тип "Быстрое поручение".
2. Если выбран тип "Поручение" — форма просит выбрать исполнителя, а действие вызывает `createDirectTask(...)` из `lib/actions/tasks.ts`.

---

**Общие рекомендации по рефакторингу `EventsCalendar.tsx`:**
Так как файл уже занимает около 1400 строк, перед масштабным добавлением новых фич рекомендуется вынести компоненты модальных окон (ModalView, QuickCreate) и логику работы с API (хуки `useCalendarData`) в отдельные файлы для поддержания чистоты кода.
