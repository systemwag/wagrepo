-- ============================================================
-- Migration 069: RPC admin_delete_polls — массовое удаление опросов
-- ============================================================
-- Зачем:
--   Кейс из админ-панели: admin нажимает «удалить» на опросе, PostgREST
--   .delete().in('id', ids) возвращает count=0. Причина — RLS polls_delete:
--   в исходной миграции 051 политика разрешала DELETE только автору,
--   а миграция 053 (расширение под director/admin) могла быть не применена
--   в Supabase Dashboard. Чтобы не зависеть от порядка применения и не
--   дублировать RLS, идём через SECURITY DEFINER RPC с явным role-check.
--
-- Что делает: за один вызов удаляет polls по списку id + связанные
-- notifications (linked_id не FK, иначе они становятся orphan-записями
-- с битой ссылкой). poll_targets и poll_responses снимаются автоматически
-- по ON DELETE CASCADE.
--
-- Возвращает фактическое число удалённых строк из polls.
-- ============================================================

DROP FUNCTION IF EXISTS admin_delete_polls(UUID[]);

CREATE OR REPLACE FUNCTION admin_delete_polls(p_ids UUID[])
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role  TEXT;
  v_count INT;
BEGIN
  SELECT p.role::TEXT INTO v_role FROM profiles p WHERE p.id = auth.uid();
  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Только admin может массово удалять опросы';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Снимаем связанные уведомления ДО удаления опросов: notifications.linked_id
  -- не FK, CASCADE их не возьмёт.
  DELETE FROM notifications
   WHERE type = 'poll' AND linked_id = ANY(p_ids);

  DELETE FROM polls WHERE id = ANY(p_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_polls(UUID[]) TO authenticated;
