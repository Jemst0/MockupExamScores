import { NextRequest, NextResponse } from "next/server";
import { verifyOtpChallenge } from "@/lib/otp";
import { findExamineeByEmailAndName } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      challengeToken?: string;
      code?: string;
    };

    const challengeToken = (body.challengeToken ?? "").trim();
    const code = (body.code ?? "").replace(/\s+/g, "");

    if (!challengeToken || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Please enter the 6-digit verification code sent to your email." },
        { status: 400 }
      );
    }

    const verification = verifyOtpChallenge(challengeToken, code);
    if (!verification.valid) {
      const errorMessages: Record<typeof verification.reason, string> = {
        invalid_token: "Your verification session is invalid. Please request a new code.",
        expired: "This verification code has expired. Please request a new code.",
        too_many_attempts:
          "Too many incorrect attempts. Please request a new verification code.",
        wrong_code: "The verification code you entered is incorrect. Please try again.",
      };
      return NextResponse.json(
        { error: errorMessages[verification.reason], reason: verification.reason },
        { status: 401 }
      );
    }

    const result = await findExamineeByEmailAndName(
      verification.email,
      verification.name
    );

    if (!result) {
      return NextResponse.json(
        { error: "Examinee record could not be retrieved. Please try again." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      examinee: {
        name: result.attendance.name,
        email: result.attendance.email,
        school: result.score?.school || result.attendance.school,
        municipality: result.attendance.municipality,
        testingHub: result.attendance.testingHub,
      },
      score: result.score
        ? {
            part1: result.score.part1,
            part2: result.score.part2,
            part3: result.score.part3,
            total: result.score.total,
            rank: result.score.rank,
          }
        : null,
      meta: {
        totalScoredExaminees: result.totalScoredExaminees,
        highestScore: result.highestScore,
      },
    });
  } catch (err) {
    console.error("[verify-otp] error:", err);
    return NextResponse.json(
      { error: "Unable to verify code right now. Please try again." },
      { status: 500 }
    );
  }
}
