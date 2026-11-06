import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

import {
  accountDeletionBlockers,
  DELETE_PHRASE,
  deleteAccount,
  EXPORT_HANDLED_SEPARATELY,
  EXPORTED_MODELS,
  exportAccountData,
} from "./account";

const tag = `acct-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PASSWORD = "correct horse battery";
const created: string[] = [];
const institutions: string[] = [];
let n = 0;

async function newUser(data: { passwordless?: boolean; role?: "USER" | "ADMIN" } = {}) {
  n += 1;
  const user = await prisma.user.create({
    data: {
      email: `${tag}-${n}@techepitome.test`,
      name: `Person ${n}`,
      role: data.role ?? "USER",
      passwordHash: data.passwordless ? null : await hashPassword(PASSWORD),
    },
    select: { id: true, email: true },
  });
  created.push(user.id);
  return user;
}

afterAll(async () => {
  await prisma.institutionMembership.deleteMany({ where: { userId: { in: created } } });
  await prisma.institution.deleteMany({ where: { id: { in: institutions } } });
  await prisma.user.deleteMany({ where: { id: { in: created } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: created } } });
});

describe("the export", () => {
  it("accounts for every table with a userId", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
      .filter(([, , body]) => /^\s+userId\s+String/m.test(body!))
      .map(([, name]) => name!);
    const handled = [...EXPORTED_MODELS, ...Object.keys(EXPORT_HANDLED_SEPARATELY)];
    expect(models.filter((model) => !handled.includes(model))).toEqual([]);
  });

  it("holds the owner's data and no secrets or other people", async () => {
    const owner = await newUser();
    const other = await newUser();
    await prisma.account.create({
      data: {
        userId: owner.id,
        type: "oauth",
        provider: "google",
        providerAccountId: tag,
        access_token: "SECRET-ACCESS-TOKEN",
        refresh_token: "SECRET-REFRESH-TOKEN",
      },
    });
    await prisma.shareLink.create({
      data: { userId: owner.id, tokenHash: `SECRET-HASH-${tag}`, displayName: "Me" },
    });
    const chapter = await prisma.chapter.findFirstOrThrow({
      where: { status: "PUBLISHED" },
      select: { id: true },
    });
    for (const [userId, body] of [
      [owner.id, "owner's private note"],
      [other.id, "someone else's note"],
    ] as const) {
      await prisma.note.create({
        data: { userId, entityType: "CHAPTER", entityId: chapter.id, body },
      });
    }

    const text = JSON.stringify(await exportAccountData(owner.id));
    expect(text).toContain(owner.email!);
    expect(text).toContain("owner's private note");
    expect(text).toContain('"provider":"google"');
    expect(text).not.toContain("someone else's note");
    expect(text).not.toContain(other.email!);
    expect(text).not.toContain("SECRET-");
    expect(text).not.toMatch(/passwordHash|access_token|refresh_token|tokenHash/);
  });

  it("leaves out exam scores, which may be unreleased", async () => {
    const owner = await newUser();
    const text = JSON.stringify(await exportAccountData(owner.id));
    expect(text).toContain('"examAttempts"');
    expect(text).not.toMatch(/autoPoints|"score"/);
  });
});

describe("deleting an account", () => {
  let user: { id: string; email: string | null };

  beforeEach(async () => {
    user = await newUser();
  });

  it("needs the exact phrase and the right password", async () => {
    expect(
      await deleteAccount(user.id, { phrase: "yes please", password: PASSWORD })
    ).toEqual({ ok: false, reason: "phrase" });
    expect(
      await deleteAccount(user.id, { phrase: DELETE_PHRASE, password: "wrong" })
    ).toEqual({ ok: false, reason: "credentials" });
    expect(await deleteAccount(user.id, { phrase: DELETE_PHRASE })).toEqual({
      ok: false,
      reason: "credentials",
    });
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
  });

  it("removes the account and its data, and records only that it happened", async () => {
    const chapter = await prisma.chapter.findFirstOrThrow({
      where: { status: "PUBLISHED" },
      select: { id: true },
    });
    await prisma.note.create({
      data: { userId: user.id, entityType: "CHAPTER", entityId: chapter.id, body: "x" },
    });
    expect(
      await deleteAccount(user.id, { phrase: DELETE_PHRASE, password: PASSWORD })
    ).toEqual({ ok: true });
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
    expect(await prisma.note.count({ where: { userId: user.id } })).toBe(0);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "account.deleted", entityId: user.id },
    });
    expect(audit.actorEmail).toBe("deleted-account");
    expect(JSON.stringify(audit)).not.toContain(tag);
  });

  it("confirms a passwordless account by its email", async () => {
    const provider = await newUser({ passwordless: true });
    expect(
      await deleteAccount(provider.id, {
        phrase: DELETE_PHRASE,
        email: "not@mine.test",
      })
    ).toEqual({ ok: false, reason: "credentials" });
    expect(
      await deleteAccount(provider.id, {
        phrase: DELETE_PHRASE,
        email: provider.email!.toUpperCase(),
      })
    ).toEqual({ ok: true });
  });

  it("refuses a platform admin", async () => {
    const admin = await newUser({ role: "ADMIN" });
    expect(await accountDeletionBlockers(admin.id)).toContain("platform-admin");
    expect(
      await deleteAccount(admin.id, { phrase: DELETE_PHRASE, password: PASSWORD })
    ).toEqual({ ok: false, reason: "blocked" });
    expect(await prisma.user.count({ where: { id: admin.id } })).toBe(1);
  });

  it("refuses anyone with college records, so they cannot erase them", async () => {
    const institution = await prisma.institution.create({
      data: { slug: `${tag}-college`, name: "Test College" },
      select: { id: true },
    });
    institutions.push(institution.id);
    await prisma.institutionMembership.create({
      data: {
        institutionId: institution.id,
        userId: user.id,
        role: "STUDENT",
        source: "INVITATION",
      },
    });
    expect(await accountDeletionBlockers(user.id)).toEqual(["college-records"]);
    expect(
      await deleteAccount(user.id, { phrase: DELETE_PHRASE, password: PASSWORD })
    ).toEqual({ ok: false, reason: "blocked" });
    expect(
      await prisma.institutionMembership.count({ where: { userId: user.id } })
    ).toBe(1);
  });
});
