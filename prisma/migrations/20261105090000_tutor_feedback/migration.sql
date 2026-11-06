-- Whether the learner found a tutor answer useful. Null means they did not say.
ALTER TABLE "ai_messages" ADD COLUMN "helpful" BOOLEAN;
