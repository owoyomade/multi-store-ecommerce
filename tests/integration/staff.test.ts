import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import {
  FieldConflictError,
  NotFoundError,
  RuleViolationError,
} from "@/server/errors";
import {
  acceptInvite,
  changeMemberRole,
  findInvite,
  inviteStaff,
  removeMember,
  revokeInvite,
} from "@/server/services/staff";
import { createStore } from "@/server/services/stores";
import { ForbiddenError } from "@/server/tenancy/store-context";
import {
  addMember,
  contextFor,
  createUser,
  resetDatabase,
  storeInput,
} from "../support/factories";

// Capture outgoing email so the tests can read the invite link, as the
// invitee would from their inbox.
const { sentEmails } = vi.hoisted(() => ({
  sentEmails: [] as { to: string; text: string }[],
}));
vi.mock("@/server/email/mailer", () => ({
  sendEmail: async (message: { to: string; text: string }) => {
    sentEmails.push(message);
  },
}));

beforeEach(async () => {
  sentEmails.length = 0;
  await resetDatabase();
});

function tokenFromLastEmail(): string {
  const match = sentEmails.at(-1)?.text.match(/\/invite\/([\w-]+)/);
  if (!match) throw new Error("no invite link was emailed");
  return match[1];
}

async function storeWithOwner() {
  const owner = await createUser("Owner");
  const store = await createStore(owner.id, storeInput({ slug: "shop" }));
  return { owner, store, context: await contextFor(owner.id, "shop") };
}

describe("invitations", () => {
  it("emails a link that lets the invited person join with the chosen role", async () => {
    const { context, store } = await storeWithOwner();
    const invitee = await createUser("Pat");

    await inviteStaff(context, {
      email: "PAT@example.test",
      role: "FULFILLMENT_AGENT",
    });
    expect(sentEmails[0].to).toBe("pat@example.test");
    const token = tokenFromLastEmail();

    expect(await findInvite(token)).toMatchObject({
      status: "valid",
      role: "FULFILLMENT_AGENT",
    });
    await acceptInvite(token, invitee.id);

    const membership = await db.storeMembership.findUniqueOrThrow({
      where: { storeId_userId: { storeId: store.id, userId: invitee.id } },
    });
    expect(membership.role).toBe("FULFILLMENT_AGENT");
    // Only a hash is stored, never the token from the link.
    const invite = await db.storeInvite.findFirstOrThrow();
    expect(invite.tokenHash).not.toBe(token);
  });

  it("works only once", async () => {
    const { context } = await storeWithOwner();
    const invitee = await createUser("Pat");
    await inviteStaff(context, { email: "pat@example.test", role: "MANAGER" });
    const token = tokenFromLastEmail();

    await acceptInvite(token, invitee.id);
    expect(await findInvite(token)).toEqual({ status: "invalid" });
    await expect(acceptInvite(token, invitee.id)).rejects.toThrow(
      RuleViolationError,
    );
  });

  it("refuses someone signed in with a different email address", async () => {
    const { context } = await storeWithOwner();
    const stranger = await createUser("Stranger");
    await inviteStaff(context, { email: "pat@example.test", role: "MANAGER" });

    await expect(
      acceptInvite(tokenFromLastEmail(), stranger.id),
    ).rejects.toThrow(/sent to pat@example.test/);
    expect(await db.storeMembership.count()).toBe(1);
  });

  it("refuses an unverified email address", async () => {
    const { context } = await storeWithOwner();
    const invitee = await createUser("Pat");
    await db.user.update({
      where: { id: invitee.id },
      data: { emailVerified: false },
    });
    await inviteStaff(context, { email: "pat@example.test", role: "MANAGER" });

    await expect(
      acceptInvite(tokenFromLastEmail(), invitee.id),
    ).rejects.toThrow(/Verify your email/);
  });

  it("refuses an expired link", async () => {
    const { context } = await storeWithOwner();
    const invitee = await createUser("Pat");
    await inviteStaff(context, { email: "pat@example.test", role: "MANAGER" });
    await db.storeInvite.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const token = tokenFromLastEmail();
    expect(await findInvite(token)).toEqual({ status: "invalid" });
    await expect(acceptInvite(token, invitee.id)).rejects.toThrow(
      RuleViolationError,
    );
  });

  it("replaces an earlier invite to the same address, and can be cancelled", async () => {
    const { context } = await storeWithOwner();
    await inviteStaff(context, { email: "pat@example.test", role: "MANAGER" });
    const firstToken = tokenFromLastEmail();
    const second = await inviteStaff(context, {
      email: "pat@example.test",
      role: "INVENTORY_EDITOR",
    });

    expect(await findInvite(firstToken)).toEqual({ status: "invalid" });
    await revokeInvite(context, second.id);
    expect(await db.storeInvite.count()).toBe(0);
  });

  it("won't invite someone who is already on the team", async () => {
    const { context } = await storeWithOwner();
    await expect(
      inviteStaff(context, { email: "owner@example.test", role: "MANAGER" }),
    ).rejects.toThrow(FieldConflictError);
  });

  it("only lets owners manage staff", async () => {
    const { store } = await storeWithOwner();
    const manager = await createUser("Manager");
    await addMember(store.id, manager.id, "MANAGER");
    const managerContext = await contextFor(manager.id, "shop");

    await expect(
      inviteStaff(managerContext, { email: "x@example.test", role: "OWNER" }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("roles and removal", () => {
  it("never leaves a store without an owner", async () => {
    const { context } = await storeWithOwner();
    const ownMembership = await db.storeMembership.findFirstOrThrow();

    await expect(
      changeMemberRole(context, ownMembership.id, { role: "MANAGER" }),
    ).rejects.toThrow(/at least one owner/);
    await expect(removeMember(context, ownMembership.id)).rejects.toThrow(
      /at least one owner/,
    );
  });

  it("lets an owner step down once there is another owner", async () => {
    const { context, store } = await storeWithOwner();
    const partner = await createUser("Partner");
    await addMember(store.id, partner.id, "OWNER");
    const ownMembership = await db.storeMembership.findFirstOrThrow({
      where: { userId: context.userId },
    });

    await changeMemberRole(context, ownMembership.id, { role: "MANAGER" });
    expect(
      (
        await db.storeMembership.findUniqueOrThrow({
          where: { id: ownMembership.id },
        })
      ).role,
    ).toBe("MANAGER");
    expect(
      await db.auditLog.count({ where: { action: "staff.role_changed" } }),
    ).toBe(1);
  });

  it("removes a team member", async () => {
    const { context, store } = await storeWithOwner();
    const agent = await createUser("Agent");
    const membership = await addMember(store.id, agent.id, "FULFILLMENT_AGENT");

    await removeMember(context, membership.id);
    expect(
      await db.storeMembership.findUnique({ where: { id: membership.id } }),
    ).toBeNull();
  });

  it("can't touch another store's team", async () => {
    const { context } = await storeWithOwner();
    const otherOwner = await createUser("Other");
    const otherStore = await createStore(
      otherOwner.id,
      storeInput({ slug: "other" }),
    );
    const otherMembership = await db.storeMembership.findFirstOrThrow({
      where: { storeId: otherStore.id },
    });

    await expect(
      changeMemberRole(context, otherMembership.id, { role: "MANAGER" }),
    ).rejects.toThrow(NotFoundError);
    await expect(removeMember(context, otherMembership.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});
