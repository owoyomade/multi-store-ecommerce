import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma, StoreRole } from "@/generated/prisma/client";
import {
  roleChangeSchema,
  staffInviteSchema,
  type StaffInviteInput,
} from "@/lib/validation/staff";
import { db } from "../db";
import { sendEmail } from "../email/mailer";
import { staffInviteMessage } from "../email/templates";
import { env } from "../env";
import {
  FieldConflictError,
  NotFoundError,
  RuleViolationError,
} from "../errors";
import { ROLE_LABELS } from "../permissions/roles";
import { requirePermission, type StoreContext } from "../tenancy/store-context";
import { recordAudit } from "./audit";

const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

// Only a hash of the invite token is stored, like a password. Someone who can
// read the database still can't build a working invite link from it.
function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Display names for user IDs, e.g. to show who changed an order. */
export async function userNames(
  userIds: (string | null)[],
): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => id !== null))];
  if (ids.length === 0) return {};
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return Object.fromEntries(users.map((user) => [user.id, user.name]));
}

export async function listStaff(context: StoreContext) {
  requirePermission(context, "staff:manage");
  const [members, invites] = await Promise.all([
    db.storeMembership.findMany({
      where: { storeId: context.storeId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.storeInvite.findMany({
      where: {
        storeId: context.storeId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
  ]);
  return { members, invites };
}

/**
 * Emails a single-use invite link. Inviting the same address again replaces
 * the earlier invite, so only the newest link works.
 */
export async function inviteStaff(
  context: StoreContext,
  input: StaffInviteInput,
) {
  requirePermission(context, "staff:manage");
  const { email, role } = staffInviteSchema.parse(input);

  const alreadyMember = await db.storeMembership.findFirst({
    where: { storeId: context.storeId, user: { email } },
    select: { id: true },
  });
  if (alreadyMember)
    throw new FieldConflictError(
      "email",
      "This person is already on your team",
    );

  const token = randomBytes(32).toString("base64url");
  const [store, inviter] = await Promise.all([
    db.store.findUniqueOrThrow({
      where: { id: context.storeId },
      select: { name: true },
    }),
    db.user.findUniqueOrThrow({
      where: { id: context.userId },
      select: { name: true },
    }),
  ]);

  const invite = await db.$transaction(async (tx) => {
    await tx.storeInvite.deleteMany({
      where: { storeId: context.storeId, email, acceptedAt: null },
    });
    const created = await tx.storeInvite.create({
      data: {
        storeId: context.storeId,
        email,
        role,
        tokenHash: hashInviteToken(token),
        expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS),
        invitedById: context.userId,
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      storeId: context.storeId,
      actorUserId: context.userId,
      action: "staff.invited",
      entityType: "invite",
      entityId: created.id,
      metadata: { role },
    });
    return created;
  });

  await sendEmail(
    staffInviteMessage({
      to: email,
      storeName: store.name,
      roleLabel: ROLE_LABELS[role],
      inviterName: inviter.name,
      url: `${env.APP_URL}/invite/${token}`,
    }),
  );
  return invite;
}

export async function revokeInvite(context: StoreContext, inviteId: string) {
  requirePermission(context, "staff:manage");
  await db.$transaction(async (tx) => {
    const { count } = await tx.storeInvite.deleteMany({
      where: { id: inviteId, storeId: context.storeId, acceptedAt: null },
    });
    if (count === 0) throw new NotFoundError("Invite");
    await recordAudit(tx, {
      storeId: context.storeId,
      actorUserId: context.userId,
      action: "staff.invite_revoked",
      entityType: "invite",
      entityId: inviteId,
    });
  });
}

/**
 * Locks the store's owner memberships and refuses a change that would leave
 * the store with no owner. The lock stops two owners demoting each other at
 * the same moment and both succeeding.
 */
async function assertOwnerRemains(
  tx: Prisma.TransactionClient,
  storeId: string,
  membershipId: string,
) {
  const owners = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "store_memberships"
    WHERE "storeId" = ${storeId} AND "role" = 'OWNER'
    FOR UPDATE`;
  if (owners.every((owner) => owner.id === membershipId)) {
    throw new RuleViolationError(
      "A store needs at least one owner. Make someone else an owner first.",
    );
  }
}

async function findMembership(
  tx: Prisma.TransactionClient,
  storeId: string,
  membershipId: string,
) {
  const membership = await tx.storeMembership.findFirst({
    where: { id: membershipId, storeId },
    select: { id: true, role: true, userId: true },
  });
  if (!membership) throw new NotFoundError("Team member");
  return membership;
}

export async function changeMemberRole(
  context: StoreContext,
  membershipId: string,
  input: { role: string },
) {
  requirePermission(context, "staff:manage");
  const { role } = roleChangeSchema.parse(input);
  await db.$transaction(async (tx) => {
    const membership = await findMembership(tx, context.storeId, membershipId);
    if (membership.role === role) return;
    if (membership.role === "OWNER")
      await assertOwnerRemains(tx, context.storeId, membershipId);
    await tx.storeMembership.update({
      where: { id: membershipId },
      data: { role },
    });
    await recordAudit(tx, {
      storeId: context.storeId,
      actorUserId: context.userId,
      action: "staff.role_changed",
      entityType: "membership",
      entityId: membershipId,
      metadata: { from: membership.role, to: role },
    });
  });
}

export async function removeMember(
  context: StoreContext,
  membershipId: string,
) {
  requirePermission(context, "staff:manage");
  await db.$transaction(async (tx) => {
    const membership = await findMembership(tx, context.storeId, membershipId);
    if (membership.role === "OWNER")
      await assertOwnerRemains(tx, context.storeId, membershipId);
    await tx.storeMembership.delete({ where: { id: membershipId } });
    await recordAudit(tx, {
      storeId: context.storeId,
      actorUserId: context.userId,
      action: "staff.removed",
      entityType: "membership",
      entityId: membershipId,
      metadata: { role: membership.role },
    });
  });
}

// Accepting an invite. There's no StoreContext yet: the person isn't a member
// until this succeeds, so the token itself is what grants access.

export type InviteLookup =
  | {
      status: "valid";
      storeName: string;
      storeSlug: string;
      email: string;
      role: StoreRole;
    }
  | { status: "invalid" };

/** Used and expired links look the same as unknown ones, so a link reveals nothing once it's dead. */
export async function findInvite(token: string): Promise<InviteLookup> {
  const invite = await db.storeInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      email: true,
      role: true,
      acceptedAt: true,
      expiresAt: true,
      store: { select: { name: true, slug: true, deletedAt: true } },
    },
  });
  if (
    !invite ||
    invite.acceptedAt ||
    invite.expiresAt <= new Date() ||
    invite.store.deletedAt
  ) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    storeName: invite.store.name,
    storeSlug: invite.store.slug,
    email: invite.email,
    role: invite.role,
  };
}

/**
 * Joins the signed-in user to the store. Only works for the address the
 * invite was sent to, and only once that address is verified, so a forwarded
 * link can't be used by someone else.
 */
export async function acceptInvite(
  token: string,
  userId: string,
): Promise<{ storeSlug: string }> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  return db.$transaction(async (tx) => {
    const invite = await tx.storeInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      select: {
        id: true,
        storeId: true,
        email: true,
        role: true,
        store: { select: { slug: true } },
      },
    });
    if (!invite)
      throw new RuleViolationError(
        "This invitation link isn't valid any more.",
      );
    if (invite.email !== user.email.toLowerCase()) {
      throw new RuleViolationError(
        `This invitation was sent to ${invite.email}. Sign in with that address to accept it.`,
      );
    }
    if (!user.emailVerified)
      throw new RuleViolationError(
        "Verify your email address first, then open the link again.",
      );

    // Claim the invite with a conditional update, so two tabs accepting at
    // once can't both use it.
    const { count } = await tx.storeInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    if (count === 0)
      throw new RuleViolationError(
        "This invitation link isn't valid any more.",
      );

    const existing = await tx.storeMembership.findUnique({
      where: { storeId_userId: { storeId: invite.storeId, userId } },
      select: { id: true },
    });
    if (!existing) {
      const membership = await tx.storeMembership.create({
        data: { storeId: invite.storeId, userId, role: invite.role },
        select: { id: true },
      });
      await recordAudit(tx, {
        storeId: invite.storeId,
        actorUserId: userId,
        action: "staff.joined",
        entityType: "membership",
        entityId: membership.id,
        metadata: { role: invite.role },
      });
    }
    return { storeSlug: invite.store.slug };
  });
}
