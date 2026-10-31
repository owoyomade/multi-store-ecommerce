import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { STORE_ROLES } from "@/lib/validation/staff";
import { requireStoreContext } from "@/server/auth/session";
import { ROLE_LABELS, roleHasPermission } from "@/server/permissions/roles";
import { listStaff } from "@/server/services/staff";
import {
  changeRoleAction,
  inviteStaffAction,
  removeMemberAction,
  revokeInviteAction,
} from "./actions";
import { ConfirmButton, InviteForm, RoleForm } from "./staff-controls";

export const metadata: Metadata = { title: "Staff" };

const ROLE_SUMMARIES: Record<(typeof STORE_ROLES)[number], string> = {
  OWNER: "Everything, including settings and who has access.",
  MANAGER:
    "Runs the store day to day: products, stock, orders, refunds, discounts and reports.",
  INVENTORY_EDITOR: "Products and stock levels.",
  FULFILLMENT_AGENT:
    "Sees orders and marks them shipped and delivered. No refunds.",
};

const roleOptions = STORE_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

export default async function StaffPage({
  params,
}: PageProps<"/dashboard/[storeSlug]/staff">) {
  const { storeSlug } = await params;
  const context = await requireStoreContext(storeSlug);
  if (!roleHasPermission(context.role, "staff:manage")) {
    return (
      <NoAccess
        title="Staff"
        message="Only store owners can manage the team."
      />
    );
  }
  const { members, invites } = await listStaff(context);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p className="mt-1 text-sm text-stone-600">
          Invite people to help run this store and choose what each of them can
          do.
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">Invite someone</h2>
        <InviteForm
          action={inviteStaffAction.bind(null, storeSlug)}
          roles={roleOptions}
        />
        <dl className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          {STORE_ROLES.map((role) => (
            <div key={role} className="contents">
              <dt className="font-medium">{ROLE_LABELS[role]}</dt>
              <dd className="text-stone-600">{ROLE_SUMMARIES[role]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {invites.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Waiting to accept</h2>
          <ul className="divide-y divide-stone-100">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <span>
                  <span className="font-medium">{invite.email}</span> ·{" "}
                  {ROLE_LABELS[invite.role]}
                  <span className="block text-stone-500">
                    Expires {invite.expiresAt.toLocaleDateString("en-CA")}
                  </span>
                </span>
                <ConfirmButton
                  action={revokeInviteAction.bind(null, storeSlug, invite.id)}
                  label="Cancel invitation"
                  pendingLabel="Cancelling…"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Team</h2>
        <ul className="divide-y divide-stone-100">
          {members.map((member) => {
            const isYou = member.user.id === context.userId;
            return (
              <li
                key={member.id}
                className="flex flex-wrap items-end justify-between gap-4 py-4 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {member.user.name}
                    {isYou && " (you)"}
                  </span>
                  <span className="block text-stone-500">
                    {member.user.email}
                  </span>
                </span>
                <div className="flex flex-wrap items-end gap-3">
                  <RoleForm
                    action={changeRoleAction.bind(null, storeSlug, member.id)}
                    roles={roleOptions}
                    current={member.role}
                  />
                  <ConfirmButton
                    action={removeMemberAction.bind(null, storeSlug, member.id)}
                    label={isYou ? "Leave store" : "Remove"}
                    pendingLabel="Removing…"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
