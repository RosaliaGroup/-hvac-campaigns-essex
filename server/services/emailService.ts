import { Resend } from "resend";

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send a transactional email via Resend.
 * Returns true on success, false if Resend is not configured or fails.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured — email not sent");
    return false;
  }

  const from = options.from ?? "Mechanical Enterprise <noreply@mechanicalenterprise.com>";

  try {
    const { error } = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Failed to send email:", err);
    return false;
  }
}

/**
 * Send a password reset email with a styled HTML template.
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Mechanical Enterprise</h1>
              <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">Team Dashboard Access</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="color:#1e3a5f;margin:0 0 16px;font-size:20px;">Reset Your Password</h2>
              <p style="color:#374151;margin:0 0 24px;font-size:15px;line-height:1.6;">
                Hi ${name},<br><br>
                We received a request to reset your password for the Mechanical Enterprise dashboard. 
                Click the button below to set a new password.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#ff6b35;border-radius:6px;padding:14px 32px;">
                    <a href="${resetUrl}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="color:#6b7280;margin:0 0 8px;font-size:13px;line-height:1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="color:#3b82f6;margin:0 0 24px;font-size:13px;word-break:break-all;">
                ${resetUrl}
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <p style="color:#9ca3af;margin:0;font-size:12px;line-height:1.6;">
                This link expires in <strong>1 hour</strong>. If you did not request a password reset, 
                you can safely ignore this email — your password will not change.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;margin:0;font-size:12px;">
                © 2025 Mechanical Enterprise · Essex County, NJ · (862) 419-1763
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject: "Reset Your Mechanical Enterprise Dashboard Password",
    html,
  });
}

/**
 * Send a team invite email with a styled HTML template.
 */
export async function sendTeamInviteEmail(
  to: string,
  name: string,
  inviteUrl: string,
  invitedBy: string
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Mechanical Enterprise</h1>
              <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">Team Dashboard Access</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="color:#1e3a5f;margin:0 0 16px;font-size:20px;">You've Been Invited!</h2>
              <p style="color:#374151;margin:0 0 24px;font-size:15px;line-height:1.6;">
                Hi ${name},<br><br>
                <strong>${invitedBy}</strong> has invited you to join the Mechanical Enterprise team dashboard. 
                Click the button below to set your password and get started.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#ff6b35;border-radius:6px;padding:14px 32px;">
                    <a href="${inviteUrl}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              <p style="color:#6b7280;margin:0 0 8px;font-size:13px;line-height:1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="color:#3b82f6;margin:0 0 24px;font-size:13px;word-break:break-all;">
                ${inviteUrl}
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <p style="color:#9ca3af;margin:0;font-size:12px;line-height:1.6;">
                This invite link expires in <strong>7 days</strong>. If you did not expect this invitation, 
                you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;margin:0;font-size:12px;">
                © 2025 Mechanical Enterprise · Essex County, NJ · (862) 419-1763
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject: `You're invited to join the Mechanical Enterprise dashboard`,
    html,
  });
}
