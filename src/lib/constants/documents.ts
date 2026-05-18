// Константы для загрузки документов. Вынесены в отдельный модуль, чтобы их
// можно было импортировать и в Server Action (stages.ts с 'use server'), и в
// клиентских компонентах. 'use server'-файл может экспортировать только
// async-функции — отсюда необходимость отдельного файла.

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024 // 10 МБ
export const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'] as const
