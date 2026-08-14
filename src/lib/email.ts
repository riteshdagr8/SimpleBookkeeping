import { Resend } from "resend";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured; skipping password reset email.");
    return;
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL || "SimpleBookkeeping <noreply@yourdomain.com>";
  await resend.emails.send({
    from,
    to,
    subject: "Reset your password",
    html: `<p>We received a request to reset your SimpleBookkeeping password.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Reset your password</a></p>
      <p>Or copy and paste this link into your browser: <a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 30 minutes. If you did not request this, you can safely ignore this email.</p>`,
  });
}
