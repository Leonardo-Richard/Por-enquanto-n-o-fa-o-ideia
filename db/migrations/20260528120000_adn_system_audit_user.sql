-- Utilizador técnico para auditoria de jobs ADN sem requested_by_user_id (cron/mensal).
INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "isSuperadmin")
VALUES (
  'system:adn-scheduler',
  'ADN Scheduler (sistema)',
  'system-adn-scheduler@internal.local',
  true,
  NOW(),
  NOW(),
  false
)
ON CONFLICT (id) DO NOTHING;
