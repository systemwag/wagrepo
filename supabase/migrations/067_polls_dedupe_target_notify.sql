-- ============================================================
-- Migration 067: убираем дубли уведомлений по опросам с audience='specific'
-- ============================================================
-- Проблема (диагноз 2026-05-25):
--   updatePoll переписывает poll_targets целиком (DELETE+INSERT). Триггер
--   notify_poll_target (миграция 051) висит на AFTER INSERT и каждый раз
--   создавал новое уведомление для тех же юзеров — менеджер редактирует
--   опрос N раз, юзер получает N дубликатов «Новый опрос» в notifications
--   и N push'ей на каждое устройство.
--
--   Подтверждено SQL-запросом: один опрос дал 7/5/3/2 одинаковых строк
--   в notifications для разных юзеров (счёт совпадает с числом раз, когда
--   юзер попал в очередной DELETE+INSERT poll_targets).
--
-- Фикс: триггер проверяет, нет ли уже уведомления по паре (user_id, poll_id).
-- Если есть — skip. Это идемпотентный INSERT на уровне БД — защищает от
-- любых источников вставок в poll_targets (server actions, ручной SQL).
--
-- Бонус-секция 2 — разовая чистка существующих дубликатов: оставляем
-- самое раннее уведомление на каждой паре (user_id, linked_id), последующие
-- удаляем. Безопасно: пользователи всё равно прочитали бы только одно.
-- ============================================================

-- ─── 1. Идемпотентный триггер ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_notify_poll_target()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question TEXT;
  v_creator  UUID;
BEGIN
  -- Уже уведомляли этого юзера по этому опросу — не плодим дубли при
  -- updatePoll (DELETE + INSERT poll_targets переоткрывает триггер заново).
  IF EXISTS (
    SELECT 1 FROM notifications
     WHERE user_id = NEW.user_id
       AND type = 'poll'
       AND linked_id = NEW.poll_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT question, created_by INTO v_question, v_creator
    FROM polls WHERE id = NEW.poll_id;

  -- Не уведомлять автора, если он зачем-то добавил сам себя.
  IF NEW.user_id IS DISTINCT FROM v_creator THEN
    INSERT INTO notifications (user_id, title, message, type, linked_id)
    VALUES (
      NEW.user_id,
      'Новый опрос',
      'Вам предложено ответить: «' || v_question || '»',
      'poll',
      NEW.poll_id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ─── 2. Разовая чистка существующих дубликатов ────────────────────────────
-- Оставляем самое раннее уведомление на пару (user_id, linked_id),
-- остальные удаляем. Применимо только для type='poll' с непустым linked_id —
-- другие типы (event, project и т.д.) не страдают от этой баги.
DELETE FROM notifications n
USING (
  SELECT id, row_number() OVER (
    PARTITION BY user_id, linked_id
    ORDER BY created_at, id
  ) AS rn
  FROM notifications
  WHERE type = 'poll' AND linked_id IS NOT NULL
) dup
WHERE n.id = dup.id AND dup.rn > 1;
