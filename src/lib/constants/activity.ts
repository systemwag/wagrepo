// Глаголы для отображения активности — используются в дашборде и /activity.
// Когда добавляется новый action в writeLog/logActivity — добавлять сюда.

export const ACTION_VERBS: Record<string, string> = {
  'project.created':              'создал(а) проект',
  'project.updated':              'обновил(а) проект',
  'project.deleted':              'удалил(а) проект',
  'project.stage_moved':          'переместил(а) этап',
  // Прямые поручения
  'direct_task.created':          'выдал(а) поручение',
  'direct_task.updated':          'обновил(а) поручение',
  'direct_task.deleted':          'удалил(а) поручение',
  'direct_task.status_changed':   'изменил(а) статус поручения',
  'direct_task.feedback':         'отчитался(ась) по поручению',
  'direct_task.accepted':         'принял(а) поручение в работу',
  'direct_task.rejected':         'отклонил(а) поручение',
  // Проектные задачи
  'project_task.created':         'создал(а) задачу',
  'project_task.updated':         'обновил(а) задачу',
  'project_task.deleted':         'удалил(а) задачу',
  'project_task.status_changed':  'изменил(а) статус задачи',
  'project_task.feedback':        'отчитался(ась) по задаче',
  'project_task.moved':           'переместил(а) задачу',
  'project_task.accepted':        'принял(а) задачу в работу',
  'project_task.rejected':        'отклонил(а) задачу',
  // Этапы
  'stage.created':                     'создал(а) этап',
  'stage.deleted':                     'удалил(а) этап',
  'stage.status_changed':              'изменил(а) статус этапа',
  'stage.review_changed':              'проверил(а) этап',
  'stage.deadline_changed':            'изменил(а) дедлайн этапа',
  'stage.assignee_changed':            'назначил(а) ответственного на этап',
  'stage.notes_updated':               'обновил(а) заметки этапа',
  'stage.checklist_item_added':        'добавил(а) пункт в чек-лист',
  'stage.checklist_item_removed':      'удалил(а) пункт чек-листа',
  'stage.checklist_item_completed':    'отметил(а) пункт чек-листа',
  'stage.checklist_item_uncompleted':  'снял(а) отметку с пункта чек-листа',
  'stage.document_attached':           'прикрепил(а) документ к этапу',
  'stage.document_removed':            'удалил(а) документ этапа',
  // Мероприятия
  'event.created':                'создал(а) мероприятие',
  'event.updated':                'обновил(а) мероприятие',
  'event.deleted':                'удалил(а) мероприятие',
  // Опросы
  'poll.created':                 'создал(а) опрос',
  'poll.updated':                 'обновил(а) опрос',
  'poll.responded':               'ответил(а) на опрос',
  'poll.closed':                  'закрыл(а) опрос',
  'poll.deleted':                 'удалил(а) опрос',
  'poll.reminded':                'напомнил(а) об опросе',
  'poll.extended':                'продлил(а) дедлайн опроса',
}

export function actionVerb(action: string): string {
  return ACTION_VERBS[action] ?? action
}
