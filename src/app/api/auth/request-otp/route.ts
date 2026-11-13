import { NextRequest, NextResponse } from "next/server";
import { findExamineeByEmailAndName, getNameTokens } from "@/lib/sheets";
import { createOtpChallenge, maskEmail } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/mailer";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const globalForRate = globalThis as unknown as {
  __askbokOtpRate?: Map<string, { count: number; resetAt: number }>;
};

function checkRateLimit(key: string): boolean {
  if (!globalForRate.__askbokOtpRate) {
    globalForRate.__askbokOtpRate = new Map();
  }
  const now = Date.now();
  const entry = globalForRate.__askbokOtpRate.get(key);
  if (!entry || now > entry.resetAt) {
    globalForRate.__askbokOtpRate.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; name?: string };
    const email = (body.email ?? "").trim();
    const name = (body.name ?? "").trim();

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const tokens = getNameTokens(name).filter((t) => t.length >= 2);
    if (tokens.length < 2) {
      return NextResponse.json(
        {
          error:
            "Please enter your full name (at least first and last name, e.g., Juan Dela Cruz).",
        },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "local";
    if (!checkRateLimit(`${ip}:${email.toLowerCase()}`)) {
      return NextResponse.json(
        { error: "Too many verification requests. Please wait a minute before trying again." },
        { status: 429 }
      );
    }

    const match = await findExamineeByEmailAndName(email, name);
    if (!match) {
      return NextResponse.json(
        {
          error:
            "We couldn't find a matching registration for that email and full name. Please check the email and name you used in the ASKBOK attendance form.",
        },
        { status: 404 }
      );
    }

    const { code, challengeToken, expiresAt } = createOtpChallenge(
      match.attendance.email,
      match.attendance.name
    );

    const mailResult = await sendOtpEmail(
      match.attendance.email,
      match.attendance.name,
      code
    );

    return NextResponse.json({
      ok: true,
      challengeToken,
      maskedEmail: maskEmail(match.attendance.email),
      expiresAt,
      devMode: mailResult.devMode,
      ...(mailResult.devMode && mailResult.devCode ? { devCode: mailResult.devCode } : {}),
    });
  } catch (err) {
    console.error("[request-otp] error:", err);
    const message =
      err instanceof Error && err.message.includes("Email delivery is not configured")
        ? err.message
        : "Unable to process verification right now. Please try again in a moment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
