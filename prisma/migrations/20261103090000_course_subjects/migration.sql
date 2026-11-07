-- The library filters by subject. Courses written before the field existed get
-- one here; a subject someone has already set is left alone.
UPDATE "courses" SET "category" = 'Data Structures & Algorithms'
  WHERE "slug" = 'dsa-foundations' AND "category" IS NULL;
UPDATE "courses" SET "category" = 'System Design'
  WHERE "slug" = 'system-design-foundations' AND "category" IS NULL;
UPDATE "courses" SET "category" = 'Software Design'
  WHERE "slug" = 'low-level-design' AND "category" IS NULL;
