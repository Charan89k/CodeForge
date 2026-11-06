import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { prisma } from "@/lib/db";

import {
  acceptAnswer,
  createThread,
  getThread,
  listThreads,
  removeOwn,
  replyToThread,
  toggleVote,
  type CommunityActor,
} from "./community";
import {
  appealQueue,
  decideAppeal,
  hideContent,
  reportQueue,
  restrictPoster,
  setModerator,
  setThreadLocked,
  type Moderator,
} from "./community-moderation";
import { appealDecision, blockPerson, reportContent } from "./community-safety";

const tag = `cmy${Date.now()}${Math.floor(Math.random() * 1e6)}`;
type Person = Moderator;
const people: Record<string, Person> = {};

async function person(key: string, role: "USER" | "ADMIN" = "USER", username = true) {
  const user = await prisma.user.create({
    data: {
      email: `${tag}-${key}@techepitome.test`,
      role,
      profile: { create: username ? { username: `${tag}-${key}`.toLowerCase() } : {} },
    },
    select: { id: true, email: true, role: true },
  });
  people[key] = user;
  return user;
}

const thread = (
  actor: CommunityActor,
  title: string,
  // Each body differs: the same body twice in ten minutes is refused as a repeat.
  body = `Details for: ${title}`
) => createThread(actor, { category: "algorithms", kind: "QUESTION", title, body });
const notificationsOf = (key: string) =>
  prisma.notification.findMany({
    where: { userId: people[key]!.id, kind: "COMMUNITY" },
  });
const threadRow = (id: string) =>
  prisma.communityThread.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  await person("asker");
  await person("helper");
  await person("troll");
  await person("quiet", "USER", false);
  await person("admin", "ADMIN");
  await person("admin2", "ADMIN");
  await person("mod");
});

afterAll(async () => {
  const ids = Object.values(people).map((p) => p.id);
  await prisma.communityModerationAction.deleteMany({
    where: { moderatorId: { in: ids } },
  });
  await prisma.communityThread.deleteMany({ where: { authorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("posting", () => {
  it("needs a username, so nobody posts under their name or email", async () => {
    await expect(
      thread(people.quiet!, "Why does my loop never stop?")
    ).rejects.toMatchObject({
      code: "username",
    });
  });

  it("refuses the same thread twice and too many links", async () => {
    await thread(people.helper!, `Duplicate check ${tag}`);
    await expect(
      thread(people.helper!, `duplicate CHECK ${tag}`)
    ).rejects.toMatchObject({
      code: "duplicate",
    });
    const links = Array.from({ length: 6 }, (_, i) => `https://spam${i}.test`).join(
      " "
    );
    await expect(thread(people.helper!, `Links ${tag}`, links)).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("tells the asker about a reply and a mentioned person, but not if they blocked the writer", async () => {
    const id = await thread(people.asker!, `Binary search bounds ${tag}`);
    await blockPerson(people.helper!, people.troll!.id);

    await replyToThread(
      people.troll!,
      id,
      `Ping @${tag}-helper about this`.toLowerCase()
    );
    expect(await notificationsOf("asker")).toHaveLength(1);
    expect(await notificationsOf("helper")).toHaveLength(0);

    await replyToThread(people.admin!, id, `Ask @${tag}-helper`.toLowerCase());
    expect(await notificationsOf("helper")).toHaveLength(1);
    expect((await threadRow(id)).replyCount).toBe(2);
  });
});

describe("votes and answers", () => {
  it("counts one vote per person, even when they click twice at once", async () => {
    const id = await thread(people.asker!, `Voting ${tag}`);
    await expect(toggleVote(people.asker!, { threadId: id })).rejects.toMatchObject({
      code: "forbidden",
    });

    const both = await Promise.all([
      toggleVote(people.helper!, { threadId: id }),
      toggleVote(people.helper!, { threadId: id }),
    ]);
    const votes = await prisma.communityVote.count({ where: { threadId: id } });
    expect(votes).toBeLessThanOrEqual(1);
    expect((await threadRow(id)).voteCount).toBe(votes);
    expect(both).toContain(votes === 1);

    if (votes === 1) await toggleVote(people.helper!, { threadId: id });
    expect((await threadRow(id)).voteCount).toBe(0);
  });

  it("lets only the asker mark an answer", async () => {
    const id = await thread(people.asker!, `Accepting ${tag}`);
    const reply = await replyToThread(people.helper!, id, "Use a half-open range.");
    await expect(acceptAnswer(people.helper!, id, reply)).rejects.toMatchObject({
      code: "forbidden",
    });
    await acceptAnswer(people.asker!, id, reply);
    expect((await threadRow(id)).acceptedPostId).toBe(reply);

    await removeOwn(people.helper!, { postId: reply });
    expect(await threadRow(id)).toMatchObject({ acceptedPostId: null, replyCount: 0 });
  });
});

describe("moderation", () => {
  let id = "";
  let reply = "";

  it("takes reports once per person, never your own, and queues them", async () => {
    id = await thread(people.asker!, `Moderated thread ${tag}`);
    reply = await replyToThread(people.troll!, id, "Buy followers at a cheap rate");
    await expect(
      reportContent(people.troll!, { postId: reply }, { reason: "SPAM" })
    ).rejects.toMatchObject({ code: "forbidden" });

    await expect(
      reportContent(
        people.asker!,
        { postId: reply },
        { reason: "SPAM", note: "Advert" }
      )
    ).resolves.toBe("reported");
    await expect(
      reportContent(people.asker!, { postId: reply }, { reason: "SPAM" })
    ).resolves.toBe("already");
    await reportContent(people.helper!, { postId: reply }, { reason: "HARASSMENT" });

    await expect(reportQueue(people.helper!)).rejects.toMatchObject({
      code: "forbidden",
    });
    const queued = (await reportQueue(people.admin!)).find(
      (g) => "postId" in g.target && g.target.postId === reply
    );
    expect(queued).toMatchObject({ count: 2, reasons: { SPAM: 1, HARASSMENT: 1 } });
  });

  it("hides with a reason the author sees, and nobody else reads the post", async () => {
    await hideContent(people.admin!, { postId: reply }, "Advertising is not allowed.");

    const forReader = await getThread(id, people.helper!);
    const forAuthor = await getThread(id, people.troll!);
    expect(forReader!.posts.find((p) => p.id === reply)).toMatchObject({
      status: "HIDDEN",
      body: null,
      hiddenReason: null,
    });
    expect(forAuthor!.posts.find((p) => p.id === reply)).toMatchObject({
      body: "Buy followers at a cheap rate",
      hiddenReason: "Advertising is not allowed.",
    });
    expect((await threadRow(id)).replyCount).toBe(0);
    await expect(
      prisma.communityReport.count({ where: { postId: reply, status: "OPEN" } })
    ).resolves.toBe(0);
    expect((await notificationsOf("troll")).some((n) => n.title.includes("hid"))).toBe(
      true
    );
  });

  it("hears an appeal once, by a moderator other than the one who hid it", async () => {
    await expect(
      appealDecision(people.helper!, { postId: reply }, "This is not mine to appeal.")
    ).rejects.toMatchObject({ code: "not_found" });
    await appealDecision(
      people.troll!,
      { postId: reply },
      "It was a joke, not an advert."
    );
    await expect(
      appealDecision(people.troll!, { postId: reply }, "Please look again at this.")
    ).rejects.toMatchObject({ code: "duplicate" });

    const [appeal] = (await appealQueue(people.admin!)).filter(
      (a) => a.threadId === id
    );
    await expect(
      decideAppeal(people.admin!, appeal!.id, true, "Overturning my own call")
    ).rejects.toMatchObject({ code: "forbidden" });
    await decideAppeal(people.admin2!, appeal!.id, true, "Reads as a joke in context.");

    expect((await getThread(id, people.helper!))!.posts[0]).toMatchObject({
      status: "VISIBLE",
      body: "Buy followers at a cheap rate",
    });
    expect((await threadRow(id)).replyCount).toBe(1);
  });

  it("locks a thread against replies, and only moderators can", async () => {
    await expect(
      setThreadLocked(people.helper!, id, true, "Heated")
    ).rejects.toMatchObject({ code: "forbidden" });
    await setModerator(people.admin!, people.mod!.id, true);
    await setThreadLocked(people.mod!, id, true, "Going in circles.");
    await expect(
      replyToThread(people.helper!, id, "One more thing")
    ).rejects.toMatchObject({
      code: "locked",
    });
  });

  it("pauses one account's posting, but never an admin's", async () => {
    await restrictPoster(people.mod!, people.troll!.id, {
      days: 3,
      reason: "Repeated spam.",
    });
    await expect(
      thread(people.troll!, `After restriction ${tag}`)
    ).rejects.toMatchObject({
      code: "restricted",
    });
    await expect(
      restrictPoster(people.mod!, people.admin!.id, { days: 3, reason: "No." })
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      prisma.communityModerationAction.count({ where: { moderatorId: people.mod!.id } })
    ).resolves.toBe(2);
  });
});

describe("reading", () => {
  it("leaves out threads by people you blocked, and hidden threads for everyone else", async () => {
    const trollThread = await prisma.communityThread.create({
      data: {
        categoryId: "cat_dsa",
        authorId: people.troll!.id,
        title: `Troll thread ${tag}`,
        body: "Noise",
      },
    });
    const seen = async (viewer: CommunityActor | null) =>
      (await listThreads({ sort: "new", q: tag, page: 1 }, viewer)).threads.map(
        (t) => t.id
      );

    expect(await seen(people.asker!)).toContain(trollThread.id);
    expect(await seen(people.helper!)).not.toContain(trollThread.id);
    expect(await seen(null)).toContain(trollThread.id);

    await hideContent(people.mod!, { threadId: trollThread.id }, "Off topic.");
    expect(await seen(people.asker!)).not.toContain(trollThread.id);
    await expect(getThread(trollThread.id, people.asker!)).resolves.toBeNull();
    await expect(getThread(trollThread.id, people.troll!)).resolves.toMatchObject({
      hiddenReason: "Off topic.",
    });
  });
});
