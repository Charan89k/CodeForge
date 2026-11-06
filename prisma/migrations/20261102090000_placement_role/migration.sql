-- On its own: Postgres cannot use a new enum value in the transaction adding it.
ALTER TYPE "InstitutionRole" ADD VALUE IF NOT EXISTS 'PLACEMENT_OFFICER';
