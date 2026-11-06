-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Track" ADD VALUE 'GENERAL';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "attribution" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" "CourseLevel" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "license" TEXT,
ADD COLUMN     "outcomes" TEXT[],
ADD COLUMN     "prerequisites" TEXT[];

-- CreateTable
CREATE TABLE "chapter_revisions" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "markdown" TEXT,
    "content" JSONB NOT NULL,
    "objectives" TEXT[],
    "keyTakeaways" TEXT[],
    "readingMinutes" INTEGER NOT NULL DEFAULT 5,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
    "status" "RevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapter_revisions_status_idx" ON "chapter_revisions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_revisions_chapterId_number_key" ON "chapter_revisions"("chapterId", "number");

-- AddForeignKey
ALTER TABLE "chapter_revisions" ADD CONSTRAINT "chapter_revisions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_revisions" ADD CONSTRAINT "chapter_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_revisions" ADD CONSTRAINT "chapter_revisions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chapter_revisions" ENABLE ROW LEVEL SECURITY;
