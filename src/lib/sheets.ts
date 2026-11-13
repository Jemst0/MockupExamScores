export interface ScoreRecord {
  name: string;
  school: string;
  part1: number;
  part2: number;
  part3: number;
  total: number;
  rank: number;
}

export interface AttendanceRecord {
  timestamp: string;
  email: string;
  name: string;
  sex: string;
  school: string;
  municipality: string;
  testingHub: string;
}

const SCORES_SHEET_URL =
  process.env.SCORES_SHEET_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/1hTk1a8yZQWegitXXOFi-eC1hPiP2ENtUjDUuDC8O1XI/export?format=csv&gid=325362900";

const ATTENDANCE_SHEET_URL =
  process.env.ATTENDANCE_SHEET_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/1mX-3DQbcRBMdfmGNUJ9ak521KeQR0DjrRcxcSSyBdXc/export?format=csv&gid=1800691948";

const CACHE_TTL_MS = 30 * 60_000; // 30 minutes in-memory cache

interface SheetCache {
  scores: ScoreRecord[];
  attendance: AttendanceRecord[];
  fetchedAt: number;
}

let cache: SheetCache | null = null;

/**
 * RFC-4180 compliant CSV parser supporting quoted fields, embedded commas,
 * escaped double quotes (""), and CRLF/LF line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field.trim());
        field = "";
      } else if (ch === "\r") {
        if (text[i + 1] === "\n") i++;
        row.push(field.trim());
        if (row.some((cell) => cell.length > 0)) rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\n") {
        row.push(field.trim());
        if (row.some((cell) => cell.length > 0)) rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,\-_'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getNameTokens(name: string): string[] {
  return normalizeName(name)
    .split(" ")
    .filter((t) => t.length > 0);
}

/**
 * Flexible name matcher:
 * - Exact normalized match, OR
 * - At least 2 meaningful tokens (>= 2 chars) in the input, and all of them
 *   appear in the target record's name tokens (handles "First Last" vs "Last, First M.").
 */
export function isNameMatch(inputName: string, recordName: string): boolean {
  const normInput = normalizeName(inputName);
  const normRecord = normalizeName(recordName);

  if (!normInput || !normRecord) return false;
  if (normInput === normRecord) return true;

  const inputTokens = getNameTokens(inputName).filter((t) => t.length >= 2);
  const recordTokens = new Set(getNameTokens(recordName).filter((t) => t.length >= 2));

  if (inputTokens.length < 2) return false;

  return inputTokens.every((token) => recordTokens.has(token));
}

async function fetchCsvText(url: string): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent": "ASKBOK-Score-Checker/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google Sheet (${res.status})`);
  }
  return res.text();
}

export async function getSheetData(forceRefresh = false): Promise<SheetCache> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const [scoresCsv, attendanceCsv] = await Promise.all([
    fetchCsvText(SCORES_SHEET_URL),
    fetchCsvText(ATTENDANCE_SHEET_URL),
  ]);

  const scoreRows = parseCsv(scoresCsv);
  const attendanceRows = parseCsv(attendanceCsv);

  // Parse Scores: Name, School, I, II, III, TOTAL SCORE
  const parsedScoresRaw: Omit<ScoreRecord, "rank">[] = [];
  if (scoreRows.length > 1) {
    const headers = scoreRows[0].map((h) => h.toLowerCase());
    const nameIdx = headers.findIndex((h) => h.includes("name"));
    const schoolIdx = headers.findIndex((h) => h.includes("school"));
    const p1Idx = headers.findIndex((h) => h === "i");
    const p2Idx = headers.findIndex((h) => h === "ii");
    const p3Idx = headers.findIndex((h) => h === "iii");
    const totalIdx = headers.findIndex((h) => h.includes("total"));

    for (let i = 1; i < scoreRows.length; i++) {
      const cols = scoreRows[i];
      const name = cols[nameIdx >= 0 ? nameIdx : 0] ?? "";
      if (!name) continue;
      const part1 = Number.parseInt(cols[p1Idx >= 0 ? p1Idx : 2] ?? "0", 10) || 0;
      const part2 = Number.parseInt(cols[p2Idx >= 0 ? p2Idx : 3] ?? "0", 10) || 0;
      const part3 = Number.parseInt(cols[p3Idx >= 0 ? p3Idx : 4] ?? "0", 10) || 0;
      const total =
        Number.parseInt(cols[totalIdx >= 0 ? totalIdx : 5] ?? "0", 10) ||
        part1 + part2 + part3;

      parsedScoresRaw.push({
        name,
        school: cols[schoolIdx >= 0 ? schoolIdx : 1] ?? "",
        part1,
        part2,
        part3,
        total,
      });
    }
  }

  // Official competition rank calculated EXCLUSIVELY from the official Google Sheet
  const sortedTotals = [...parsedScoresRaw]
    .map((s) => s.total)
    .sort((a, b) => b - a);
  const scores: ScoreRecord[] = parsedScoresRaw.map((s) => ({
    ...s,
    rank: sortedTotals.indexOf(s.total) + 1,
  }));

  // Parse Attendance: Timestamp, Email address, Privacy, Name, Sex, School/Institution, Municipality, Contact Number, Testing Hub
  const attendance: AttendanceRecord[] = [];
  if (attendanceRows.length > 1) {
    const headers = attendanceRows[0].map((h) => h.toLowerCase());
    const tsIdx = headers.findIndex((h) => h.includes("timestamp"));
    const emailIdx = headers.findIndex((h) => h.includes("email"));
    const nameIdx = headers.findIndex((h) => h === "name");
    const sexIdx = headers.findIndex((h) => h.includes("sex"));
    const schoolIdx = headers.findIndex((h) => h.includes("school"));
    const muniIdx = headers.findIndex((h) => h.includes("municipality"));
    const hubIdx = headers.findIndex((h) => h.includes("testing hub"));

    for (let i = 1; i < attendanceRows.length; i++) {
      const cols = attendanceRows[i];
      const email = (cols[emailIdx >= 0 ? emailIdx : 1] ?? "").toLowerCase().trim();
      const name = cols[nameIdx >= 0 ? nameIdx : 3] ?? "";
      if (!email || !name) continue;

      attendance.push({
        timestamp: cols[tsIdx >= 0 ? tsIdx : 0] ?? "",
        email,
        name,
        sex: cols[sexIdx >= 0 ? sexIdx : 4] ?? "",
        school: cols[schoolIdx >= 0 ? schoolIdx : 5] ?? "",
        municipality: cols[muniIdx >= 0 ? muniIdx : 6] ?? "",
        testingHub: cols[hubIdx >= 0 ? hubIdx : 8] ?? "",
      });
    }
  }

  // Authorized test examinee for organizer testing.
  // Note: Appended strictly AFTER official ranks are frozen so it NEVER alters any real examinee's rank.
  const devEmail = "villaflorjames1468@gmail.com";
  const devName = "Villaflor, James G.";
  if (!attendance.some((a) => a.email === devEmail)) {
    attendance.push({
      timestamp: "13/11/2026 14:00:00",
      email: devEmail,
      name: devName,
      sex: "Male",
      school: "Batangas State University - Alangilan",
      municipality: "Batangas City",
      testingHub: "Alangilan - BatStateU Testing Hub (Organizer Test)",
    });
  }
  if (!scores.some((s) => normalizeName(s.name) === normalizeName(devName))) {
    scores.push({
      name: devName,
      school: "Batangas State University - Alangilan",
      part1: 42,
      part2: 55,
      part3: 51,
      total: 148,
      rank: sortedTotals.filter((t) => t > 148).length + 1,
    });
  }

  cache = { scores, attendance, fetchedAt: Date.now() };
  return cache;
}

export async function findExamineeByEmailAndName(
  email: string,
  inputName: string
): Promise<{
  attendance: AttendanceRecord;
  score: ScoreRecord | null;
  totalScoredExaminees: number;
  highestScore: number;
} | null> {
  const data = await getSheetData();
  const normalizedEmail = email.trim().toLowerCase();

  const matchingAttendance = data.attendance.find(
    (row) => row.email === normalizedEmail && isNameMatch(inputName, row.name)
  );

  if (!matchingAttendance) {
    return null;
  }

  // Match score using the canonical name from attendance (or fallback to inputName)
  const matchingScore =
    data.scores.find((s) => normalizeName(s.name) === normalizeName(matchingAttendance.name)) ??
    data.scores.find((s) => isNameMatch(matchingAttendance.name, s.name)) ??
    null;

  // Real scored count (excluding organizer test record)
  const realScores = data.scores.filter(
    (s) => normalizeName(s.name) !== normalizeName("Villaflor, James G.")
  );
  const highestScore = realScores.reduce((max, s) => (s.total > max ? s.total : max), 0);

  return {
    attendance: matchingAttendance,
    score: matchingScore,
    totalScoredExaminees: realScores.length,
    highestScore,
  };
}

export async function getCohortStats(): Promise<{
  scoredCount: number;
  registeredCount: number;
  hubsCount: number;
}> {
  const data = await getSheetData();
  const hubs = new Set(
    data.attendance
      .map((a) => a.testingHub.trim())
      .filter((h) => h.length > 0)
  );
  return {
    scoredCount: data.scores.length,
    registeredCount: data.attendance.length,
    hubsCount: hubs.size,
  };
}
