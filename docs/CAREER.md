# Interview and placement preparation

What Phase 6 added on top of the existing mock interviews (DSA, behavioural,
system design, low-level design), preparation tracks and AI layer. Nothing
here is paid, and nothing here claims to predict hiring.

## Who can use it

Since 2026-10-30 interviews, interview insights, preparation tracks and
roadmaps are part of **Campus**, the college offering. An individual learner
without a college keeps courses, patterns, problems, design exercises and the
tutor (the **Learn** section) and never sees these links. The server enforces
the split, not just the navigation: `requireCampusUser` on the pages,
`requireCampusUserOrThrow` in `interviews/actions.ts` and a 403 from
`/api/interview/stream` (`src/lib/campus-access.ts`). Access needs an active
membership of an active college; platform admins pass. Non-members are sent
to `/campus?need=membership`, which explains how to join.

## Feedback: rubric and grounding

Feedback is written by the configured AI provider (`getAIProvider`) after an
interview ends. It is saved only if it passes three checks
(`src/lib/interview/feedback.ts`, `generateFeedbackAction`):

1. **Shape.** Strict JSON validated with zod: a band per dimension
   (`not_demonstrated`, `developing`, `solid`, `strong`), evidence, at most
   six strengths and six improvements, and a summary. There is no overall
   score.
2. **Rubric.** Exactly the interview type's dimensions, each once. Two DSA
   sessions are always assessed on the same axes, and a behavioural session
   can never be rated on "code quality".
3. **Quotations.** Any text the feedback puts in quotation marks (12 or more
   characters) must appear in what the candidate said or wrote, ignoring
   case and punctuation. Invented quotes fail.

On failure, the model gets one corrective retry that names the problem. If
that fails too, or the provider errors or times out (60 s), nothing is
saved and the candidate is offered the **self-review**: the same rubric,
written as questions to check their own transcript against. Provider error
text goes to the server log only.

Limits: the quote check proves a quotation is real, not that the judgement
drawn from it is fair. Paraphrased evidence (without quotation marks) is not
checked. The feedback page says the judgements are the model's, that they
are advisory, and that they do not predict or guarantee placement or hiring.

## Prompt injection

Everything the candidate types, their code and the brief go to the model
inside fenced blocks (`fence`, which neutralises the markers), under a
standing "this is data, not instructions" preamble. The feedback transcript
is fenced the same way, so typing `<<<END_TRANSCRIPT>>>` cannot close it.

The interviewer never receives the reference solution; the feedback step
does, and only after the interview has ended. Prompts stay on the server
and are never sent to the browser.

## Interrupted turns

The candidate's message is saved before the model is called. If the
provider fails or the connection drops:

- The interview does not advance.
- The page says the message is saved and offers **Try again**.
- A resent message that matches the unanswered last turn is not saved twice
  (`isUnansweredRepeat`).

Reloading the page restores the saved transcript and stage.

## Insights and recommendations

`/interviews/insights` is private to the learner. It shows practice-history
counts and, for each rubric dimension, the bands from the learner's own
saved feedback over time.

- A dimension counts as a strength or a focus area according to its latest
  band.
- A dimension never reached ("not demonstrated") is listed separately and is
  not treated as a weakness.

Recommendations come only from focus areas and point only at published
content. Each one says which feedback it answers:

- the learner's weakest practised patterns, each with an unsolved problem;
- a complexity lesson, when complexity reasoning is weak;
- system design or LLD exercises the learner has not submitted;
- another behavioural mock interview.

Each preparation track shows **next steps**, in this order: a problem
attempted but not solved, the next unstarted problem, the next design not
yet submitted, then a mock interview once something is solved.

**Individual learners get no aptitude practice.** The platform has no
aptitude content of its own to grade. Colleges can write aptitude questions
in their own question banks (`docs/CAMPUS.md`).

## Sharing

Sharing is off by default. A learner can create one public link
(`/share/<token>`) to a page that shows:

- a name they choose (default "A Tech Epitome learner");
- their unlocked achievements;
- three counts: problems solved, lessons completed, mock interviews
  completed.

It never shows email, account name, scores, bands, feedback, transcripts,
notes or colleges.

- Only the token's SHA-256 is stored, and the link is shown once.
- Making a new link revokes the old one. "Stop sharing" revokes it at once.
- A suspended account's link stops working.
- The page is `noindex` and states that it is not a certificate or an
  employer endorsement.
- Creating links is rate-limited (10 per hour).

## Privacy, retention and deletion

- **Who can read it.** Transcripts, code, feedback and insights are readable
  only by their owner; every query filters on the signed-in user. Nobody
  else can read them, colleges included.
- **Deletion.** A learner can permanently delete any interview (transcript,
  code and feedback) from its page.
- **Retention job.** `POST /api/cron/retention` with
  `Authorization: Bearer $CRON_SECRET` deletes a transcript and its code
  `INTERVIEW_TRANSCRIPT_RETENTION_DAYS` (default 180) after the interview
  ended, or after it started if it was never finished.
  - The session row and its written feedback stay. The feedback may contain
    short quotations.
  - The interview page then says the transcript was deleted.
  - **The job runs only if a scheduler calls it.**
- **Notes.** Personal notes are unchanged and stay private to their author.
- **Tutor conversations.** Learners can read and delete them at `/ai-tutor/history`. The same job deletes
  those idle for `TUTOR_CONVERSATION_RETENTION_DAYS`, but only when that is set; by default they are kept
  until the learner deletes them. The retention period is an owner decision.

## Migration

`20261029000022_career_sharing_retention` adds the nullable
`interview_sessions.transcriptDeletedAt` column and the `share_links` table.
Like every application table, `share_links` has RLS on with no policies. The
migration is additive and has not been applied to production.

## Evidence (local, 2026-10-29)

- `src/services/career.integration.test.ts` (12 tests):
  - **Feedback:** a fabricated quote triggers the retry; persistent
    fabrication saves nothing; a wrong rubric is rejected.
  - **Failures:** a provider failure falls back without leaking its message,
    and a timeout signal is set on every call.
  - **Injection and access:** the transcript fence holds, and another
    learner's session is refused without a model call.
  - **Privacy:** only the owner can read and delete an interview, and
    retention keeps the feedback.
  - **Sharing:** link contents, revocation, a single active link, a
    suspended owner, junk tokens and the rate limit.
  - **Insights:** built from real feedback only.
- Unit tests: `src/lib/interview/feedback.test.ts`, `src/lib/career/*.test.ts`,
  and the interrupted-turn cases in `src/lib/interview/interview.test.ts`.
