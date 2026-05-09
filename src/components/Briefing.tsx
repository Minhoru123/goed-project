import { useState } from 'react';

export interface BriefingPick {
  resource_id: string;
  name: string;
  url: string;
  email: string | null;
  why: string;
  next_step: string;
  deadline: string | null;
}

export interface BriefingData {
  founder_summary: string;
  top_picks: BriefingPick[];
  intro_email: string;
}

export function parseBriefing(text: string): BriefingData | null {
  const match = text.match(/```json\s*([\s\S]*?)```/i);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (
      typeof parsed?.founder_summary === 'string' &&
      Array.isArray(parsed?.top_picks) &&
      typeof parsed?.intro_email === 'string'
    ) {
      return parsed as BriefingData;
    }
    return null;
  } catch {
    return null;
  }
}

export function stripBriefingBlock(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```\s*$/i, '').trim();
}

export default function Briefing({ data }: { data: BriefingData }) {
  const [copied, setCopied] = useState(false);

  const fullText = formatBriefing(data);

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  }

  function copyEmail() {
    navigator.clipboard.writeText(data.intro_email).catch(() => {});
  }

  const [emailCopied, setEmailCopied] = useState(false);

  function copyEmailFlash() {
    copyEmail();
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 1800);
  }

  return (
    <div className="briefing mt-4 print:m-0 print:border-0 print:shadow-none">
      <div className="card border-utah-gold/40 bg-gradient-to-br from-utah-gold/10 to-transparent">
        <div className="flex items-start justify-between gap-3 print:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-utah-gold">
              Your personalized briefing
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold">Here's where to start</h2>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-sm" onClick={copy}>
              {copied ? 'Copied!' : 'Copy all'}
            </button>
            <button className="btn-primary text-sm" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </div>
        <p className="mt-3 text-base leading-relaxed text-utah-stone/85">{data.founder_summary}</p>
      </div>

      <div className="mt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-utah-stone/60">
          Top 3 next moves
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {data.top_picks.map((p, i) => (
            <div
              key={p.resource_id}
              className="card flex flex-col border-utah-stone/15 transition hover:border-utah-gold/50"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-utah-gold/15 font-display text-sm font-bold text-utah-gold">
                  {i + 1}
                </span>
                {p.deadline && (
                  <span className="rounded-full bg-utah-red/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-utah-red">
                    {p.deadline}
                  </span>
                )}
              </div>
              <h3 className="font-display text-base font-semibold leading-tight">{p.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-utah-stone/75">{p.why}</p>
              <div className="mt-3 rounded-md border border-utah-stone/10 bg-utah-slate/40 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-utah-stone/50">
                  Do this next
                </p>
                <p className="mt-1 text-sm text-utah-stone/90">{p.next_step}</p>
              </div>
              <div className="mt-auto flex gap-2 pt-3">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-md bg-utah-gold px-3 py-1.5 text-center text-xs font-semibold text-white"
                  style={{ color: '#ffffff' }}
                >
                  Open program
                </a>
                {p.email && (
                  <a
                    href={`mailto:${p.email}`}
                    className="rounded-md border border-utah-stone/25 px-3 py-1.5 text-center text-xs font-semibold text-utah-stone/90"
                  >
                    Email
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-utah-stone/60">
              Ready-to-send intro email
            </p>
            <p className="text-sm text-utah-stone/70">Copy this and email any of the programs above.</p>
          </div>
          <button className="btn-secondary text-xs print:hidden" onClick={copyEmailFlash}>
            {emailCopied ? 'Copied!' : 'Copy email'}
          </button>
        </div>
        <pre className="mt-2 whitespace-pre-wrap rounded-md border border-utah-stone/15 bg-utah-slate/40 p-4 font-sans text-sm text-utah-stone/90">
          {data.intro_email}
        </pre>
      </div>
    </div>
  );
}

function formatBriefing(d: BriefingData): string {
  const picks = d.top_picks
    .map(
      (p, i) =>
        `${i + 1}. ${p.name}\n   ${p.url}${p.email ? `\n   ✉ ${p.email}` : ''}${
          p.deadline ? `\n   Deadline: ${p.deadline}` : ''
        }\n   Why: ${p.why}\n   Next step: ${p.next_step}`
    )
    .join('\n\n');
  return `Founder Briefing
${d.founder_summary}

Top 3 programs
${picks}

Intro email
${d.intro_email}
`;
}
