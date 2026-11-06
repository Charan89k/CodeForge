-- Who started a version stays fixed; who edited it is recorded separately, so
-- review separation covers everyone who wrote any of it.
ALTER TABLE "chapter_revisions" ADD COLUMN     "editorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lastEditedById" TEXT;

-- Existing versions: the only editor on record is the author.
UPDATE "chapter_revisions" SET "editorIds" = ARRAY["authorId"], "lastEditedById" = "authorId";

ALTER TABLE "chapter_revisions" ADD CONSTRAINT "chapter_revisions_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
