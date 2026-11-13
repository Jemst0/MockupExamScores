"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Printer,
  RefreshCw,
  School,
  ShieldCheck,
  User,
  WifiOff,
} from "lucide-react";

type Step = "identify" | "verify" | "result";

interface ExamineeInfo {
  name: string;
  email: string;
  school: string;
  municipality: string;
  testingHub: string;
}

interface ScoreInfo {
  part1: number;
  part2: number;
  part3: number;
  total: number;
  rank: number;
}

interface ResultPayload {
  examinee: ExamineeInfo;
  score: ScoreInfo | null;
  meta: { totalScoredExaminees: number; highestScore: number };
}

export default function ScoreCheckerClient() {
  const [step, setStep] = useState<Step>("identify");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);

  const [challengeToken, setChallengeToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Sending Verification Code…");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; name?: string; otp?: string }>({});
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);

  // 3D Card Interactive Tilt States
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -4.5;
    const rotateY = ((x - centerX) / centerX) * 4.5;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`,
      transition: "transform 0.1s ease-out",
    });

    setGlareStyle({
      opacity: 0.12,
      background: `radial-gradient(circle at ${(x / rect.width) * 100}% ${(y / rect.height) * 100}%, rgba(255,255,255,0.9), transparent 65%)`,
    });
  };

  const handleCardMouseLeave = () => {
    setTiltStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg)",
      transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
    });
    setGlareStyle({ opacity: 0, transition: "opacity 0.6s ease-out" });
  };

  // Offline detection
  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // OTP expiry countdown
  useEffect(() => {
    if (step !== "verify" || !expiresAt) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [step, expiresAt]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (step === "verify") {
      otpRefs.current[0]?.focus();
    }
    if (step === "result") {
      const id = requestAnimationFrame(() => setAnimateBars(true));
      return () => cancelAnimationFrame(id);
    }
  }, [step]);

  function validateIdentifyForm(): boolean {
    const next: { email?: string; name?: string } = {};
    const cleanEmail = email.trim();
    const cleanName = name.trim();

    if (!cleanEmail) {
      next.email = "Please enter the email you used in the attendance form.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      next.email = "Please enter a valid email address (e.g. name@gmail.com).";
    }

    const tokens = cleanName
      .replace(/[.,\-_'"]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    if (!cleanName) {
      next.name = "Please enter your full name.";
    } else if (tokens.length < 2) {
      next.name = "Enter at least your first and last name (e.g. Juan Dela Cruz).";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function requestOtp(isResend = false) {
    if (isOffline) {
      setError("You appear to be offline. Please reconnect and try again.");
      return;
    }
    if (!isResend && !validateIdentifyForm()) return;

    setLoading(true);
    setLoadingMessage("Matching registration record…");
    setError(null);
    setDevCodeHint(null);

    const timer = setTimeout(() => {
      setLoadingMessage("Delivering code to your email inbox…");
    }, 1200);

    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Unable to send verification code. Please try again.");
        return;
      }

      setChallengeToken(data.challengeToken);
      setMaskedEmail(data.maskedEmail);
      setExpiresAt(data.expiresAt);
      setResendCooldown(30);
      setOtpDigits(["", "", "", "", "", ""]);
      setFieldErrors({});
      if (data.devMode && data.devCode) setDevCodeHint(data.devCode);
      setStep("verify");
    } catch {
      setError("Network error while connecting to the server. Please try again.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setLoadingMessage("Sending Verification Code…");
    }
  }

  async function submitOtpCode(code: string) {
    if (isOffline) {
      setError("You appear to be offline. Please reconnect to verify your code.");
      return;
    }
    if (code.length !== 6) {
      setFieldErrors({ otp: "Please enter the complete 6-digit code from your email." });
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed. Please check your code.");
        return;
      }

      setAnimateBars(false);
      setResult({ examinee: data.examinee, score: data.score, meta: data.meta });
      setStep("result");
    } catch {
      setError("Network error while verifying your code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    const next = [...otpDigits];

    if (!digits) {
      next[index] = "";
      setOtpDigits(next);
      return;
    }

    // Auto fill consecutive boxes
    for (let i = 0; i < digits.length && index + i < 6; i++) {
      next[index + i] = digits[i];
    }
    setOtpDigits(next);
    setFieldErrors({});
    const nextIndex = Math.min(5, index + digits.length);
    otpRefs.current[nextIndex]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleReset() {
    setStep("identify");
    setOtpDigits(["", "", "", "", "", ""]);
    setChallengeToken("");
    setMaskedEmail("");
    setExpiresAt(null);
    setError(null);
    setFieldErrors({});
    setDevCodeHint(null);
    setResult(null);
  }

  const mmss = `${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, "0")}`;

  return (
    <div className="w-full space-y-5">
      {/* Offline Alert */}
      {isOffline && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm no-print"
        >
          <WifiOff className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <span>You are currently offline. Please reconnect to request or verify your score.</span>
        </div>
      )}

      {/* Main Glass / White Card with Interactive 3D Perspective Tilt */}
      <div
        ref={cardRef}
        onMouseMove={handleCardMouseMove}
        onMouseLeave={handleCardMouseLeave}
        style={tiltStyle}
        className="relative rounded-3xl border border-white/80 bg-white/95 backdrop-blur-md p-6 sm:p-8 shadow-2xl shadow-sky-950/15 overflow-hidden transition-shadow duration-300 hover:shadow-sky-900/20"
      >
        {/* Dynamic Specular 3D Glare Sheen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30 transition-opacity"
          style={glareStyle}
        />

        {/* Top Header Row with Stepper and Sticky Tag */}
        <div className="flex items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-100 no-print">
          <nav aria-label="Progress" className="flex-1">
            <ol className="flex items-center gap-1.5 sm:gap-2">
              {[
                { num: 1, label: "Details" },
                { num: 2, label: "Email Code" },
                { num: 3, label: "Score" },
              ].map((item, idx) => {
                const currentStepIdx = step === "identify" ? 1 : step === "verify" ? 2 : 3;
                const isActive = currentStepIdx === item.num;
                const isDone = currentStepIdx > item.num;
                return (
                  <React.Fragment key={item.num}>
                    <li className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                          isActive
                            ? "bg-sky-600 text-white"
                            : isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          item.num
                        )}
                      </span>
                      <span
                        className={`text-xs font-bold hidden xs:inline sm:inline ${
                          isActive
                            ? "text-sky-950 font-extrabold"
                            : isDone
                            ? "text-emerald-800"
                            : "text-slate-600"
                        }`}
                      >
                        {item.label}
                      </span>
                    </li>
                    {idx < 2 && (
                      <li className="flex-1 h-0.5 min-w-2 bg-slate-200" aria-hidden="true" />
                    )}
                  </React.Fragment>
                );
              })}
            </ol>
          </nav>

          <span className="shrink-0 rotate-1 bg-yellow-200 border border-yellow-300 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold text-yellow-900 tracking-tight">
            #DOSTCutie &bull; #PapasaAko
          </span>
        </div>

        {/* STEP 1: IDENTIFY */}
        {step === "identify" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              requestOtp(false);
            }}
            noValidate
            className="space-y-5"
          >
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 text-sky-900 text-xs font-bold mb-2">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
                Verified Examination Portal
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Check Your Mock Exam Score
              </h2>
              <p className="mt-1.5 text-sm text-slate-700 leading-relaxed font-normal">
                Enter your registered email and full name. A 6-digit verification code will be sent
                so only you can access your examination results.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-bold">Lookup Unsuccessful</p>
                  <p className="mt-0.5 text-red-800">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Email Input */}
              <div>
                <label
                  htmlFor="examinee-email"
                  className="block text-sm font-bold text-slate-800 mb-1.5"
                >
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="examinee-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
                    }}
                    placeholder="e.g. juan.delacruz@gmail.com"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    className={`w-full rounded-xl border bg-slate-50/50 py-3 pl-11 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-100 outline-none transition shadow-xs disabled:opacity-60 ${
                      fieldErrors.email ? "border-red-500 bg-red-50/30" : "border-slate-300"
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p id="email-error" className="mt-1.5 text-xs font-semibold text-red-600">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Full Name Input */}
              <div>
                <label
                  htmlFor="examinee-name"
                  className="block text-sm font-bold text-slate-800 mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="examinee-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    disabled={loading}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }));
                    }}
                    placeholder="e.g. Dela Cruz, Juan A. or Juan Dela Cruz"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? "name-error" : "name-help"}
                    className={`w-full rounded-xl border bg-slate-50/50 py-3 pl-11 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-100 outline-none transition shadow-xs disabled:opacity-60 ${
                      fieldErrors.name ? "border-red-500 bg-red-50/30" : "border-slate-300"
                    }`}
                  />
                </div>
                {fieldErrors.name ? (
                  <p id="name-error" className="mt-1.5 text-xs font-bold text-red-600">
                    {fieldErrors.name}
                  </p>
                ) : (
                  <p id="name-help" className="mt-1.5 text-xs font-medium text-slate-600">
                    You may enter &ldquo;Juan Dela Cruz&rdquo; or &ldquo;Dela Cruz, Juan&rdquo;.
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || isOffline}
              className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-[0.99] text-white font-bold py-3.5 px-6 shadow-md shadow-sky-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  <span>{loadingMessage}</span>
                </>
              ) : (
                <>
                  <Mail className="h-5 w-5" aria-hidden="true" />
                  <span>Send Verification Code</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: VERIFY OTP */}
        {step === "verify" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitOtpCode(otpDigits.join(""));
            }}
            noValidate
            className="space-y-5"
          >
            <div>
              <button
                type="button"
                onClick={() => {
                  setStep("identify");
                  setError(null);
                  setFieldErrors({});
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800 transition mb-2 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Change email or name</span>
              </button>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Enter Verification Code
              </h2>
              <p className="mt-1 text-sm text-slate-700 leading-relaxed font-normal">
                We sent a 6-digit code to <strong className="text-slate-950 font-bold">{maskedEmail}</strong>.
                Enter the code below to view your results.
              </p>
            </div>

            {/* Dev Mode Banner */}
            {devCodeHint && (
              <div
                role="status"
                className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950"
              >
                <p className="font-bold">Local Development Mode (SMTP Not Configured)</p>
                <p className="mt-1">
                  Test OTP Code:{" "}
                  <strong className="font-mono text-base font-black tracking-widest text-amber-900">
                    {devCodeHint}
                  </strong>
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-bold">Verification Failed</p>
                  <p className="mt-0.5 text-red-800">{error}</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-sky-600" aria-hidden="true" />
                  <span>6-Digit Verification Code</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    secondsLeft <= 60 ? "text-red-600" : "text-slate-500"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {secondsLeft > 0 ? `Expires in ${mmss}` : "Expired"}
                </span>
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="grid grid-cols-6 gap-2 sm:gap-3">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={idx === 0 ? "one-time-code" : "off"}
                    aria-label={`Digit ${idx + 1}`}
                    maxLength={6}
                    disabled={loading}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className={`h-14 sm:h-16 w-full text-center font-mono text-2xl font-black rounded-2xl border bg-slate-50/50 text-slate-900 outline-none transition focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-100 ${
                      fieldErrors.otp
                        ? "border-red-500 bg-red-50/30"
                        : digit
                        ? "border-sky-600 bg-sky-50/30"
                        : "border-slate-300"
                    }`}
                  />
                ))}
              </div>
              {fieldErrors.otp && (
                <p className="mt-2 text-xs font-semibold text-red-600">{fieldErrors.otp}</p>
              )}
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || secondsLeft === 0 || isOffline}
                className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-[0.99] text-white font-bold py-3.5 px-6 shadow-md shadow-sky-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>Verifying Code…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    <span>Verify &amp; View Score</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  disabled={loading || resendCooldown > 0 || isOffline}
                  onClick={() => requestOtp(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800 transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {resendCooldown > 0
                      ? `Resend available in ${resendCooldown}s`
                      : "Didn't receive the email? Resend Code"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 3: RESULT */}
        {step === "result" && result && (
          <div className="space-y-6">
            {/* Header with verified badge */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Email Verified
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight break-words">
                  {result.examinee.name}
                </h2>
                <p className="text-xs text-slate-500 break-all">{result.examinee.email}</p>
              </div>

              <div className="bg-sky-50 border border-sky-200/80 rounded-2xl px-3.5 py-2 text-right self-start sm:self-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Program</p>
                <p className="text-xs font-extrabold text-sky-950">ASKBOK Review 2026</p>
              </div>
            </div>

            {/* School & Hub Info */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                <dt className="text-slate-500 font-bold uppercase tracking-wide flex items-center gap-1.5 mb-1">
                  <School className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                  <span>School / Institution</span>
                </dt>
                <dd className="font-semibold text-slate-800 text-sm break-words">
                  {result.examinee.school || "Not specified"}
                </dd>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                <dt className="text-slate-500 font-bold uppercase tracking-wide flex items-center gap-1.5 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                  <span>Testing Hub</span>
                </dt>
                <dd className="font-semibold text-slate-800 text-sm break-words">
                  {result.examinee.testingHub || result.examinee.municipality || "Not specified"}
                </dd>
              </div>
            </dl>

            {/* Score Showcase */}
            {result.score ? (
              <div className="space-y-4">
                {/* Total Score Gradient Card */}
                <div className="rounded-3xl bg-gradient-to-br from-sky-600 via-sky-700 to-blue-800 p-6 text-white shadow-lg shadow-sky-700/20">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-sky-200">
                        Total Mock Exam Score
                      </p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-5xl sm:text-6xl font-black tracking-tight">
                          {result.score.total}
                        </span>
                        <span className="text-sm font-semibold text-sky-200">pts</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 self-start sm:self-auto">
                      <Award className="h-7 w-7 text-yellow-300 shrink-0" aria-hidden="true" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-100">
                          Cohort Rank
                        </p>
                        <p className="text-lg font-black text-white">
                          #{result.score.rank}{" "}
                          <span className="text-xs font-normal text-sky-200">
                            of {result.meta.totalScoredExaminees}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown by Part */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-2.5">
                    <BookOpen className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                    <span>Part-by-Part Score Breakdown</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        part: "Part 1",
                        subject: "English and Creative Reasoning",
                        val: result.score.part1,
                        color: "bg-sky-500",
                      },
                      {
                        part: "Part 2",
                        subject: "Science",
                        val: result.score.part2,
                        color: "bg-blue-600",
                      },
                      {
                        part: "Part 3",
                        subject: "Mathematics",
                        val: result.score.part3,
                        color: "bg-indigo-600",
                      },
                    ].map((item) => {
                      const pct = Math.min(
                        100,
                        Math.round((item.val / Math.max(result.score!.total, 1)) * 100)
                      );
                      return (
                        <div
                          key={item.part}
                          className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between space-y-3 shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center justify-between text-xs font-bold mb-1">
                              <span className="text-sky-700 uppercase tracking-wider text-[11px] font-black">
                                {item.part}
                              </span>
                              <span className="text-slate-500 font-semibold">{pct}%</span>
                            </div>
                            <h4 className="text-xs font-extrabold text-slate-800 leading-snug">
                              {item.subject}
                            </h4>
                          </div>

                          <div>
                            <p className="text-3xl font-black text-slate-900 tracking-tight">
                              {item.val}
                            </p>
                            <div className="mt-1.5 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ease-out ${item.color}`}
                                style={{ width: animateBars ? `${pct}%` : "0%" }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Pending Score View */
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center space-y-2">
                <Clock className="h-8 w-8 text-amber-600 mx-auto" aria-hidden="true" />
                <h3 className="text-lg font-bold text-amber-950">
                  Attendance Confirmed &bull; Score Pending
                </h3>
                <p className="text-xs text-amber-900 max-w-sm mx-auto leading-relaxed">
                  Your mock examination attendance is verified, but your score has not yet been
                  posted. Please check back later or consult the organizers.
                </p>
              </div>
            )}

            {/* Print & Return Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white font-bold py-3 px-4 shadow-sm transition flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>Print / Save Score</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-xl border border-slate-300 hover:bg-slate-50 active:scale-[0.99] text-slate-700 font-bold py-3 px-4 transition flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Check Another Examinee</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
