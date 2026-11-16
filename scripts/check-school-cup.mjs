// Loads School Cup headless and asks makeQuestion for every subject, year and level (see the School Cup notes).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const file = join(dirname(fileURLToPath(import.meta.url)), "../games/school-cup/game.html");
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("page error: " + e.message));
page.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) problems.push("network request: " + r.url()); });
await page.goto("file://" + file);
const res = await page.evaluate(() => {
  const out = [];
  let n = 0;
  for (const sb of Object.keys(SUBJECTS)) for (const y of [2, 3]) for (let l = 1; l <= 6; l++) {
    subject = sb; year = y;
    for (let k = 0; k < 40; k++) {
      n++;
      try {
        const q = makeQuestion(l);
        if (!q.text || q.answer === undefined || q.answer === null) out.push(`${sb} Y${y} L${l}: empty question`);
        else if (!q.type && !q.labels.includes(q.answerLabel)) out.push(`${sb} Y${y} L${l}: answer not among options: ${q.text}`);
        else if (!q.type && new Set(q.labels).size !== q.labels.length) out.push(`${sb} Y${y} L${l}: duplicate options: ${q.text}`);
      } catch (e) { out.push(`${sb} Y${y} L${l}: ${e.message}`); }
    }
  }
  return { subjects: Object.keys(SUBJECTS), out, n };
});
await browser.close();
problems.push(...res.out);
console.log(`subjects: ${res.subjects.join(", ")} · questions generated: ${res.n}`);
if (problems.length) { console.error([...new Set(problems)].slice(0, 30).join("\n")); process.exit(1); }
console.log("School Cup: every subject, year and level makes valid questions.");
