-- On its own: Postgres cannot use a new enum value in the transaction adding it.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'COMMUNITY';
