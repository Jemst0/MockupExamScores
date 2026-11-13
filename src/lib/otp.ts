import crypto from "crypto";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS_PER_CHALLENGE = 5;

const globalForOtp = globalThis as unknown as {
  __askbokOtpSecret?: string;
  __askbokOtpAttempts?: Map<string, number>;
};

function getSecret(): string {
  if (process.env.OTP_SECRET && process.env.OTP_SECRET.length >= 16) {
    return process.env.OTP_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "OTP_SECRET environment variable must be set (at least 16 characters) in production."
    );
  }
  if (!globalForOtp.__askbokOtpSecret) {
    globalForOtp.__askbokOtpSecret = crypto.randomBytes(32).toString("hex");
  }
  return globalForOtp.__askbokOtpSecret;
}

function getAttemptsMap(): Map<string, number> {
  if (!globalForOtp.__askbokOtpAttempts) {
    globalForOtp.__askbokOtpAttempts = new Map();
  }
  return globalForOtp.__askbokOtpAttempts;
}

interface ChallengePayload {
  email: string;
  name: string;
  expiresAt: number;
  salt: string;
  codeHash: string;
}

function hashCode(email: string, code: string, expiresAt: number, salt: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${email.toLowerCase()}:${code}:${expiresAt}:${salt}`)
    .digest("hex");
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(encodedPayload)
    .digest("hex");
}

export function createOtpChallenge(email: string, canonicalName: string): {
  code: string;
  challengeToken: string;
  expiresAt: number;
} {
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + OTP_TTL_MS;
  const salt = crypto.randomBytes(16).toString("hex");
  const normalizedEmail = email.trim().toLowerCase();

  const payload: ChallengePayload = {
    email: normalizedEmail,
    name: canonicalName,
    expiresAt,
    salt,
    codeHash: hashCode(normalizedEmail, code, expiresAt, salt),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload);

  return {
    code,
    challengeToken: `${encodedPayload}.${signature}`,
    expiresAt,
  };
}

export function verifyOtpChallenge(
  challengeToken: string,
  submittedCode: string
):
  | { valid: true; email: string; name: string }
  | { valid: false; reason: "invalid_token" | "expired" | "too_many_attempts" | "wrong_code" } {
  const parts = challengeToken.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "invalid_token" };
  }

  const [encodedPayload, signature] = parts;
  const expectedSig = signPayload(encodedPayload);

  const sigBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, reason: "invalid_token" };
  }

  let payload: ChallengePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "invalid_token" };
  }

  if (Date.now() > payload.expiresAt) {
    return { valid: false, reason: "expired" };
  }

  const attemptsMap = getAttemptsMap();
  const attemptKey = payload.salt;
  const attempts = attemptsMap.get(attemptKey) ?? 0;

  if (attempts >= MAX_ATTEMPTS_PER_CHALLENGE) {
    return { valid: false, reason: "too_many_attempts" };
  }

  const cleanCode = submittedCode.replace(/\s+/g, "");
  const submittedHash = hashCode(payload.email, cleanCode, payload.expiresAt, payload.salt);

  const hashBuf = Buffer.from(submittedHash, "utf8");
  const targetBuf = Buffer.from(payload.codeHash, "utf8");

  if (hashBuf.length !== targetBuf.length || !crypto.timingSafeEqual(hashBuf, targetBuf)) {
    attemptsMap.set(attemptKey, attempts + 1);
    return { valid: false, reason: "wrong_code" };
  }

  // Mark challenge as consumed so it cannot be replayed
  attemptsMap.set(attemptKey, MAX_ATTEMPTS_PER_CHALLENGE);

  return {
    valid: true,
    email: payload.email,
    name: payload.name,
  };
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(local.length - 2, 6))}@${domain}`;
}
