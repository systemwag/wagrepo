// Нормализация телефона в формат +7XXXXXXXXXX перед сохранением.
// БД хранит чистый формат; пользователь может вводить как угодно — со скобками,
// пробелами, дефисами, через 8 или +7. Принимающая zod-схема ждёт ровно +7 и 10 цифр.

export function normalizePhone(input: string | null | undefined): string {
  if (!input) return ''
  const digits = input.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1)
  if (digits.length === 11 && digits.startsWith('7')) return '+' + digits
  if (digits.length === 10) return '+7' + digits
  return input.trim()
}
