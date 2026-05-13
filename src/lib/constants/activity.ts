// Глаголы для отображения активности — используются в дашборде и /activity.
// Когда добавляется новый action в writeLog/logActivity — добавлять сюда.

export const ACTION_VERBS: Record<string, string> = {
  'project.created':       'создал проект',
  'project.updated':       'обновил проект',
  'project.deleted':       'удалил проект',
  'task.created':          'создал задачу',
  'task.updated':          'обновил задачу',
  'task.deleted':          'удалил задачу',
  'task.status_changed':   'изменил статус задачи',
  'task.feedback':         'отчитался по задаче',
  'stage.created':         'создал этап',
  'stage.status_changed':  'изменил статус этапа',
  'stage.review_changed':  'проверил этап',
  'event.created':         'создал мероприятие',
  'event.updated':         'обновил мероприятие',
  'event.deleted':         'удалил мероприятие',
}

export function actionVerb(action: string): string {
  return ACTION_VERBS[action] ?? action
}
