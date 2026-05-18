// Имена в БД хранятся в формате «Фамилия Имя Отчество» (русский официальный порядок).

export type ParsedName = {
  lastName: string
  firstName: string
  middleName?: string
}

export function parseFullName(fullName: string | null | undefined): ParsedName | null {
  if (!fullName) return null
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return { lastName: parts[0], firstName: '' }
  return {
    lastName:   parts[0],
    firstName:  parts[1],
    middleName: parts[2],
  }
}

/** «Аян А.» — имя + инициал фамилии. Если только одно слово — вернёт его как есть. */
export function formatNameShort(fullName: string | null | undefined): string {
  const parsed = parseFullName(fullName)
  if (!parsed) return '—'
  if (!parsed.firstName) return parsed.lastName
  return `${parsed.firstName} ${parsed.lastName[0]}.`
}

/** Просто имя — «Аян». Если нет имени, вернёт фамилию. Для приветствий и узких chip-кнопок. */
export function getFirstName(fullName: string | null | undefined): string {
  const parsed = parseFullName(fullName)
  if (!parsed) return '—'
  return parsed.firstName || parsed.lastName
}
