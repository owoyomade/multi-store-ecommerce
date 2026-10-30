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
