import nodemailer from "nodemailer";

const isDev = process.env.NODE_ENV !== "production";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export interface SendPasswordResetEmailOptions {
  to: string;
  resetLink: string;
}

export async function sendPasswordResetEmail({ to, resetLink }: SendPasswordResetEmailOptions): Promise<void> {
  const from = process.env.SMTP_FROM ?? "no-reply@vyva.ai";
  const subject = "Reset your Vyva password";
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>We received a request to reset the password for your Vyva account.</p>
      <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${resetLink}"
           style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
          Reset Password
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px;">
        If you didn't request this, you can safely ignore this email. Your password will not change.
      </p>
      <p style="color:#6b7280;font-size:14px;">
        Or copy this link into your browser:<br/>
        <a href="${resetLink}">${resetLink}</a>
      </p>
    </div>
  `;

  const transport = createTransport();

  if (!transport) {
    if (isDev) {
      console.log("[email:dev] Password reset email (SMTP not configured — logging instead)");
      console.log(`[email:dev] To: ${to}`);
      console.log(`[email:dev] Subject: ${subject}`);
      console.log(`[email:dev] Reset link: ${resetLink}`);
      return;
    }
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.");
  }

  await transport.sendMail({ from, to, subject, html });
}
