import nodemailer from "nodemailer";

type EmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  strict?: boolean;
};

function resolveFromAddress() {
  const explicitFrom = process.env.SMTP_FROM?.trim();
  if (explicitFrom) {
    return explicitFrom;
  }

  const companyDomain = process.env.COMPANY_EMAIL_DOMAIN?.trim();
  if (companyDomain) {
    return `OFWA Ops <noreply@${companyDomain}>`;
  }

  return undefined;
}

function buildTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

export async function sendEmail({ to, subject, text, strict = false }: EmailInput) {
  const transport = buildTransport();
  if (!transport) {
    if (strict) {
      throw new Error("SMTP transport is not configured.");
    }

    console.info("Email transport not configured", { to, subject, text });
    return;
  }

  try {
    const from = resolveFromAddress();
    if (!from) {
      throw new Error("SMTP_FROM is not configured.");
    }

    await transport.sendMail({
      from,
      to,
      subject,
      text
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";

    if (message.includes("domain is not verified")) {
      throw new Error("Email sender domain is not verified in Resend. Verify the domain or use a verified sender in SMTP_FROM.");
    }

    throw error;
  }
}
