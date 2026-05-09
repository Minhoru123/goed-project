// Smoke-test the Navigator against the hackathon judge personas and persona modes.
// Run with: node scripts/test-personas.mjs (requires `npm run dev` in another terminal).

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2500;

const PERSONAS = [
  { id: '01', name: 'Jordan, 20 — SLC', persona: 'founder', step: 1,
    input: "Pre-seed founder with an idea but no business yet. Looking for resources to take my first steps. I'm in Salt Lake City." },
  { id: '02', name: 'Maria, 38 — Washington County', persona: 'founder', step: 14,
    input: "Running a small agricultural operation near St. George. Rural, woman-owned, looking to scale." },
  { id: '03', name: 'Marcus, 34 — Ogden', persona: 'founder', step: 9,
    input: "Just left the military and starting a custom fabrication and manufacturing business. Veteran, early-stage, in Weber County." },
  { id: '04', name: 'Priya, 31 — SLC', persona: 'founder', step: 13,
    input: "B2B SaaS founder, 18 months in, paying customers, ready to raise my first venture round. Looking for angel groups and VCs." },
  { id: '05', name: 'David, 45 — Provo', persona: 'founder', step: 17,
    input: "Medical device company, 12 employees, FDA cleared. Looking to expand to international markets. Growth stage." },
  { id: '06', name: 'Dr. Amir, 29 — SLC', persona: 'founder', step: 3,
    input: "PhD candidate at the University of Utah developing novel technology. Want to commercialize my research and found a company. Never started a business before." },
  { id: '07', name: 'Sasha — investor, SLC', persona: 'investor', step: null,
    input: "Seed-stage hardware investor based in Salt Lake. Want exposure to Utah university spinouts, demo days, and any defense/dual-use programs in the state." },
  { id: '08', name: 'Lin — provider, Lehi', persona: 'provider', step: null,
    input: "I run a boutique IP and corporate law firm in Lehi serving deep-tech and life-sciences founders. Want to plug into Utah accelerators, university tech transfer offices, and founder communities to reach early-stage clients." },
];

function pickHeadings(text) {
  return [...text.matchAll(/^### (.+)$/gm)].map((m) => m[1]).slice(0, 5);
}

function parseJson(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasValidShape(result) {
  return result.ok && result.matchCount >= 3 && result.briefingOk && !result.serviceError;
}

async function runPersonaOnce(p) {
  const start = Date.now();
  const res = await fetch(`${BASE}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userInput: p.input, journeyStep: p.step ?? undefined, persona: p.persona }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body: body.slice(0, 200) };
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    full += dec.decode(value, { stream: true });
  }

  const ms = Date.now() - start;
  const headings = pickHeadings(full);
  const briefing = parseJson(full);
  return {
    ok: true,
    ms,
    headings,
    matchCount: headings.length,
    briefingOk: !!briefing,
    serviceError: /\[The match service (hit an error|was interrupted)\. Please try again\.\]/i.test(full),
    snippet: full.replace(/\s+/g, ' ').trim().slice(0, 240),
    journeyStep: briefing?.journey_step ?? null,
    topPicks: briefing?.top_picks?.map((p) => ({ name: p.name, steps: p.journey_steps })) ?? [],
  };
}

async function runPersona(p) {
  let last;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    last = await runPersonaOnce(p);
    last.attempt = attempt;
    if (hasValidShape(last) || attempt === MAX_ATTEMPTS) return last;
    await sleep(RETRY_DELAY_MS * attempt);
  }
  return last;
}

(async () => {
  console.log(`Running ${PERSONAS.length} personas against ${BASE}/api/claude\n`);
  let failures = 0;
  for (const p of PERSONAS) {
    process.stdout.write(`${p.id} ${p.name.padEnd(40)} ${p.persona.padEnd(9)} step ${String(p.step ?? '-').padStart(2)} ... `);
    try {
      const r = await runPersona(p);
      if (!r.ok) {
        console.log(`FAIL ${r.status} ${r.body}`);
        failures += 1;
      } else {
        const attempts = r.attempt > 1 ? ` after ${r.attempt} attempts` : '';
        console.log(`${r.matchCount} matches in ${r.ms}ms${attempts} · briefing ${r.briefingOk ? 'OK' : 'MISSING'}`);
        for (const pick of r.topPicks) {
          console.log(`     - ${pick.name}  ${(pick.steps || []).map((s) => `[${s}]`).join('')}`);
        }
        if (!hasValidShape(r)) {
          console.log(`     FAIL response shape: ${r.snippet || '(empty response)'}`);
          failures += 1;
        }
      }
    } catch (e) {
      console.log(`ERROR ${e.message}`);
      failures += 1;
    }
    // Keep a little space between streamed model calls.
    await sleep(1500);
  }
  if (failures > 0) {
    console.error(`\n${failures} persona smoke test(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('\nAll persona smoke tests returned matches and briefing JSON.');
  }
})();
