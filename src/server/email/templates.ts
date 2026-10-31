import type { EmailMessage } from "./mailer";

// Plain, inline-styled HTML keeps emails readable in every mail client.
function actionEmail(options: {
  to: string;
  subject: string;
  intro: string;
  buttonLabel: string;
  url: string;
  footnote: string;
}): EmailMessage {
  const { to, subject, intro, buttonLabel, url, footnote } = options;
  return {
    to,
    subject,
    text: `${intro}\n\n${buttonLabel}: ${url}\n\n${footnote}`,
    html: `
      <p>${escapeHtml(intro)}</p>
      <p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(buttonLabel)}</a></p>
      <p style="color:#6b7280;font-size:13px">${escapeHtml(footnote)}</p>
    `,
  };
}

export function verifyEmailMessage(to: string, url: string): EmailMessage {
  return actionEmail({
    to,
    subject: "Verify your email address",
    intro: "Thanks for signing up. Please confirm this is your email address.",
    buttonLabel: "Verify email",
    url,
    footnote:
      "This link expires in 1 hour. If you didn't sign up, you can ignore this email.",
  });
}

export function resetPasswordMessage(to: string, url: string): EmailMessage {
  return actionEmail({
    to,
    subject: "Reset your password",
    intro: "Someone asked to reset the password for this account.",
    buttonLabel: "Choose a new password",
    url,
    footnote:
      "This link expires in 1 hour. If this wasn't you, ignore this email and your password stays the same.",
  });
}

// User-supplied values (names, URLs) must never be able to inject HTML into an email.
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type OrderEmailDetails = {
  to: string;
  storeName: string;
  orderNumber: number;
  lines: { title: string; quantity: number; lineTotal: string }[];
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
  orderUrl: string;
};

export function orderConfirmationMessage(
  order: OrderEmailDetails,
): EmailMessage {
  const subject = `${order.storeName}: order #${order.orderNumber} confirmed`;
  const textLines = order.lines.map(
    (line) => `${line.quantity} × ${line.title} — ${line.lineTotal}`,
  );
  const htmlRows = order.lines
    .map(
      (line) =>
        `<tr><td style="padding:4px 12px 4px 0">${line.quantity} × ${escapeHtml(line.title)}</td><td style="text-align:right">${escapeHtml(line.lineTotal)}</td></tr>`,
    )
    .join("");
  const totals = [
    ["Subtotal", order.subtotal],
    ["Shipping", order.shipping],
    ["Tax (demo rate)", order.tax],
    ["Total", order.total],
  ];

  return {
    to: order.to,
    subject,
    text: [
      `Thanks for your order from ${order.storeName}!`,
      "",
      ...textLines,
      "",
      ...totals.map(([label, value]) => `${label}: ${value}`),
      "",
      `View your order: ${order.orderUrl}`,
      "",
      "This is a demo store: no real payment was taken.",
    ].join("\n"),
    html: `
      <p>Thanks for your order from <strong>${escapeHtml(order.storeName)}</strong>!</p>
      <table style="border-collapse:collapse;font-size:14px">${htmlRows}
        ${totals
          .map(
            ([label, value]) =>
              `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${label}</td><td style="text-align:right">${escapeHtml(value ?? "")}</td></tr>`,
          )
          .join("")}
      </table>
      <p><a href="${escapeHtml(order.orderUrl)}">View your order</a></p>
      <p style="color:#6b7280;font-size:13px">This is a demo store: no real payment was taken.</p>
    `,
  };
}

export function orderShippedMessage(order: {
  to: string;
  storeName: string;
  orderNumber: number;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
}): EmailMessage {
  const tracking = `${order.carrier}, tracking number ${order.trackingNumber}`;
  return {
    to: order.to,
    subject: `${order.storeName}: order #${order.orderNumber} has shipped`,
    text: [
      `Good news: your order #${order.orderNumber} from ${order.storeName} is on its way.`,
      "",
      `Shipped with ${tracking}.`,
      ...(order.trackingUrl ? [`Track it here: ${order.trackingUrl}`] : []),
    ].join("\n"),
    html: `
      <p>Good news: your order #${order.orderNumber} from <strong>${escapeHtml(order.storeName)}</strong> is on its way.</p>
      <p>Shipped with ${escapeHtml(tracking)}.</p>
      ${order.trackingUrl ? `<p><a href="${escapeHtml(order.trackingUrl)}">Track your parcel</a></p>` : ""}
    `,
  };
}

export function staffInviteMessage(invite: {
  to: string;
  storeName: string;
  roleLabel: string;
  inviterName: string;
  url: string;
}): EmailMessage {
  return actionEmail({
    to: invite.to,
    subject: `You're invited to help run ${invite.storeName}`,
    intro: `${invite.inviterName} has invited you to join ${invite.storeName} as ${invite.roleLabel}.`,
    buttonLabel: "Accept invitation",
    url: invite.url,
    footnote:
      "Sign in or create an account with this email address to accept. The link works once and expires in 7 days. If you weren't expecting this, you can ignore it.",
  });
}
