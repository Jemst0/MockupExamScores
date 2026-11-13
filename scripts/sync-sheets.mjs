import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseCsv(text) {
  const rows = [];
  let row = [];
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

const SCORES_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1hTk1a8yZQWegitXXOFi-eC1hPiP2ENtUjDUuDC8O1XI/export?format=csv&gid=325362900";
const ATTENDANCE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1mX-3DQbcRBMdfmGNUJ9ak521KeQR0DjrRcxcSSyBdXc/export?format=csv&gid=1800691948";

async function main() {
  console.log("Fetching live Google Sheets...");
  const [sRes, aRes] = await Promise.all([
    fetch(SCORES_SHEET_URL),
    fetch(ATTENDANCE_SHEET_URL),
  ]);

  if (!sRes.ok || !aRes.ok) {
    throw new Error(`Failed to fetch sheets: scores=${sRes.status}, attendance=${aRes.status}`);
  }

  const sText = await sRes.text();
  const aText = await aRes.text();

  const scoreRows = parseCsv(sText);
  const attendanceRows = parseCsv(aText);

  // Parse Scores: Name, School, I, II, III, TOTAL SCORE
  const parsedScoresRaw = [];
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

  const sortedTotals = [...parsedScoresRaw].map((s) => s.total).sort((a, b) => b - a);
  const scores = parsedScoresRaw.map((s) => ({
    ...s,
    rank: sortedTotals.indexOf(s.total) + 1,
  }));

  // Parse Attendance
  const attendance = [];
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

  const outDir = path.join(__dirname, "..", "src", "data");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outDir, "scores.json"), JSON.stringify(scores, null, 2), "utf8");
  fs.writeFileSync(path.join(outDir, "attendance.json"), JSON.stringify(attendance, null, 2), "utf8");

  console.log(`Success! Saved ${scores.length} scores and ${attendance.length} attendance records into src/data/`);
}

main().catch(console.error);
