import "server-only";
import nodemailer from "nodemailer";
import { env } from "../env";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  // Port 465 uses TLS from the start; other ports upgrade with STARTTLS if offered.
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER
    ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
    : undefined,
});

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendEmail(message: EmailMessage): Promise<void> {
  await transporter.sendMail({ from: env.EMAIL_FROM, ...message });
}
