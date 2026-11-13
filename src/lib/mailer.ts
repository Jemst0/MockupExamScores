import nodemailer from "nodemailer";

export interface SendOtpResult {
  sent: boolean;
  devMode: boolean;
  devCode?: string;
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendOtpEmail(
  toEmail: string,
  examineeName: string,
  code: string
): Promise<SendOtpResult> {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Email delivery is not configured on the server. Please set SMTP_USER and SMTP_PASS."
      );
    }

    console.info(
      `\n[ASKBOK DEV MODE] Verification code for ${examineeName} (${toEmail}): ${code}\n`
    );

    return {
      sent: false,
      devMode: true,
      devCode: code,
    };
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const fromAddress =
    process.env.SMTP_FROM || `"ASKBOK Score Checker" <${process.env.SMTP_USER}>`;

  await transporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject: `${code} is your ASKBOK Score Verification Code`,
    text: [
      `Hello ${examineeName},`,
      "",
      "You requested to view your ASKBOK Mock Examination score.",
      `Your 6-digit verification code is: ${code}`,
      "",
      "This code expires in 10 minutes. If you did not request this, you can safely ignore this email.",
      "",
      "ASKBOK: Ang Pagtatasa ng Tuktok",
      "DOST Undergraduate Scholarship Examination 2026 Review Program",
    ].join("\n"),
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f0f9ff; padding: 24px; border-radius: 16px;">
        <div style="background: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #bae6fd;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: #0284c7; text-transform: uppercase;">
            ASKBOK: Ang Pagtatasa ng Tuktok
          </p>
          <h1 style="margin: 0 0 16px; font-size: 20px; color: #0f172a;">
            Your Score Verification Code
          </h1>
          <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.5; color: #334155;">
            Hello <strong>${escapeHtml(examineeName)}</strong>, enter the 6-digit code below to verify your identity and view your DOST Mock Examination score:
          </p>
          <div style="background: #eff6ff; border: 2px dashed #38bdf8; border-radius: 10px; padding: 18px; text-align: center; margin-bottom: 18px;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #0369a1; font-family: monospace;">
              ${code}
            </span>
          </div>
          <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
            This code expires in <strong>10 minutes</strong>. Do not share it with anyone. If you did not request your score, you may ignore this email.
          </p>
        </div>
        <p style="margin: 14px 0 0; text-align: center; font-size: 12px; color: #64748b;">
          DOST Undergraduate Scholarship Examination 2026 Review Program
        </p>
      </div>
    `,
  });

  return {
    sent: true,
    devMode: false,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
