---
name: git-push
description: Проверить билд, создать коммит и запушить все изменения в main ветку. Использовать когда нужно сохранить версию проекта в git.
allowed-tools: Bash(npm run build), Bash(npx tsc --noEmit), Bash(git status), Bash(git log), Bash(git add), Bash(git commit), Bash(git push)
---

# Git Push — WAG System

Выполни следующие шаги по порядку:

## 1. Проверь TypeScript
```bash
npx tsc --noEmit
```
Если есть ошибки — останови выполнение и сообщи пользователю.

## 2. Проверь production билд
```bash
npm run build
```
Если билд упал — останови выполнение и сообщи пользователю.

## 3. Посмотри что изменилось
```bash
git status
git log --oneline -3
```

## 4. Добавь файлы в коммит
Добавляй все изменённые и новые файлы из `src/`, `public/`, `supabase/`, `CLAUDE.md`.
Не добавляй: `.env*`, `node_modules/`, `.next/`, `*.log`.

```bash
git add src/ public/ supabase/ CLAUDE.md
```

Если есть файлы вне этих директорий — добавляй точечно по имени.

## 5. Создай коммит

Сообщение коммита берётся из `$ARGUMENTS`. Если аргумент не передан — придумай осмысленное сообщение на русском языке на основе изменений из `git status`.

```bash
git commit -m "$(cat <<'EOF'
<сообщение из $ARGUMENTS или сгенерированное>

Authored-By: AKDAULET ALMAS
)"
```

## 6. Запуши в main
Проект использует локальную ветку `master`, но remote ветку `main`:
```bash
git push origin master:main
```

## 7. Сообщи результат
Выведи: хэш коммита, количество изменённых файлов, ссылку на ветку.

---

Аргументы: `$ARGUMENTS` — сообщение для коммита (необязательно).
