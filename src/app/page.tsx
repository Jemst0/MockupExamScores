import Image from "next/image";
import ScoreCheckerClient from "@/components/ScoreCheckerClient";
import ThreeSkyCanvas from "@/components/ThreeSkyCanvas";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-400 via-sky-200 to-slate-50 relative overflow-x-hidden">
      {/* Interactive 3D WebGL Sky Background (Pencils, Books, Paper Planes, Scholar Stars) */}
      <ThreeSkyCanvas />

      {/* Decorative Atmosphere / Ambient Lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-gradient-to-b from-sky-500/50 via-sky-300/30 to-transparent no-print z-1"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[54rem] h-[28rem] bg-white/30 rounded-full blur-3xl no-print z-1"
      />

      {/* Hero Header */}
      <header className="relative z-10 px-4 pt-6 pb-2 no-print">
        <div className="mx-auto max-w-xl flex flex-col items-center gap-4 text-center">
          {/* Partner Organization Badges with 3D shadow */}
          <div className="inline-flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-md shadow-sky-900/10 border border-white/80 transition-transform duration-300 hover:scale-105">
            <Image
              src="/images/dost-logo.png"
              alt="DOST Batangas"
              width={28}
              height={28}
              className="h-7 w-auto object-contain"
              priority
            />
            <span className="h-4 w-px bg-slate-300" aria-hidden="true" />
            <Image
              src="/images/adss-seal.png"
              alt="ADSS BatStateU Alangilan"
              width={28}
              height={28}
              className="h-7 w-auto object-contain"
              priority
            />
            <span className="h-4 w-px bg-slate-300" aria-hidden="true" />
            <div className="bg-sky-950 px-2.5 py-1 rounded-md flex items-center shadow-xs">
              <Image
                src="/images/rotaract-logo.png"
                alt="Rotaract Batangas Mid-West"
                width={90}
                height={20}
                className="h-4 w-auto object-contain"
                priority
              />
            </div>
          </div>

          {/* ASKBOK Main Logo with Interactive 3D Float */}
          <div className="pt-2 group cursor-default">
            <h1 className="sr-only">ASKBOK: Ang Pagtatasa ng Tuktok</h1>
            <div className="transition-transform duration-500 ease-out group-hover:scale-105 group-hover:-translate-y-1">
              <Image
                src="/images/askbok-logo.png"
                alt="ASKBOK: Ang Pagtatasa ng Tuktok"
                width={340}
                height={128}
                className="h-24 sm:h-30 w-auto object-contain drop-shadow-[0_12px_18px_rgba(3,105,161,0.25)] mx-auto"
                priority
              />
            </div>
            <p className="mt-2 text-xs sm:text-sm font-extrabold text-[#062038] uppercase tracking-wider drop-shadow-xs">
              DOST Undergraduate Scholarship 2026 Review Program
            </p>
          </div>
        </div>
      </header>

      {/* Main Interactive Checker Container */}
      <main className="relative z-10 flex-1 px-4 py-6 sm:py-8">
        <div className="mx-auto w-full max-w-xl">
          <ScoreCheckerClient />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 px-4 text-center text-xs font-semibold text-slate-700 no-print border-t border-sky-200/80 bg-white/75 backdrop-blur-md">
        <div className="max-w-xl mx-auto space-y-1">
          <p className="font-extrabold text-slate-900">
            ASKBOK: Ang Pagtatasa ng Tuktok &bull; Mock Exam Portal
          </p>
          <p className="text-slate-700">
            Hosted by DOST Batangas &bull; ADSS Alangilan &bull; Rotaract Batangas Mid-West
          </p>
        </div>
      </footer>
    </div>
  );
}
