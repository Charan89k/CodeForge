import type { NextRequest } from "next/server";

import { jobResponse, refuseCron } from "@/lib/cron-auth";
import { runJob } from "@/services/jobs";
import { getEnv } from "@/lib/env";
import { purgeExpiredTranscripts } from "@/services/interview";
import { purgeExpiredTutorConversations } from "@/services/tutor-history";

/**
 * The transcript retention job. Deletes interview transcripts and code
 * INTERVIEW_TRANSCRIPT_RETENTION_DAYS after the interview ended; the
 * written feedback stays. Same contract as /api/cron/notifications: POST
 * with `Authorization: Bearer $CRON_SECRET`, called by the deployment's
 * scheduler. **If nothing calls it, nothing is deleted**, which is stated
 * in docs/CAREER.md and on the interviews page.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const refused = refuseCron(request);
  if (refused) return refused;

  const env = getEnv();
  const days = env.INTERVIEW_TRANSCRIPT_RETENTION_DAYS;
  const tutorDays = env.TUTOR_CONVERSATION_RETENTION_DAYS;
  return jobResponse(
    await runJob("transcript-retention", async () => ({
      retentionDays: days,
      transcriptsDeleted: await purgeExpiredTranscripts(days),
      tutorConversationsDeleted: tutorDays
        ? await purgeExpiredTutorConversations(tutorDays)
        : 0,
    }))
  );
}
