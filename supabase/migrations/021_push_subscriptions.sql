-- Migration 021: Push-подписки для PWA уведомлений
-- Хранит endpoint и ключи каждого устройства пользователя

CREATE TABLE push_subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    text        NOT NULL,
  p256dh      text        NOT NULL,
  auth        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- Только владелец видит свои подписки
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_owner" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Быстрый поиск подписок по user_id при отправке push
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

COMMENT ON TABLE push_subscriptions IS
  'Хранит Web Push подписки (endpoint + ключи) для каждого устройства пользователя.';
