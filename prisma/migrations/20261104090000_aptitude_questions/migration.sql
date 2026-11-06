-- Aptitude questions move from a source file to the database, so they can be
-- authored and reviewed. The existing questions arrive through the seed.
CREATE TABLE "aptitude_questions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "answer" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'Original',
    "authorId" TEXT,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aptitude_questions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "aptitude_questions_answer_in_options"
      CHECK ("answer" >= 0 AND "answer" < cardinality("options"))
);

CREATE UNIQUE INDEX "aptitude_questions_slug_key" ON "aptitude_questions"("slug");
CREATE INDEX "aptitude_questions_topic_status_idx" ON "aptitude_questions"("topic", "status");

ALTER TABLE "aptitude_questions" ADD CONSTRAINT "aptitude_questions_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "aptitude_questions" ADD CONSTRAINT "aptitude_questions_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The application connects as the owner, so it is unaffected. With no policy,
-- any other role, such as a data API, sees nothing in this table.
ALTER TABLE "aptitude_questions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "aptitude_attempts" ADD COLUMN "timed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "aptitude_attempts" ADD COLUMN "seconds" INTEGER;
