import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Resource } from '../types';
import { loadResources } from '../lib/loadData';
import { streamMatch, type Persona } from '../lib/claude';
import Briefing, { parseBriefing, stripBriefingBlock } from '../components/Briefing';
import JourneyPicker from '../components/JourneyPicker';
import FounderQuiz, { type FounderProfile } from '../components/FounderQuiz';
import { JUDGE_SCENARIOS } from '../lib/judgeScenarios';

function profileToPrompt(p: FounderProfile): string {
  const businessLabel: Record<FounderProfile['businessType'], string> = {
    tech: 'tech / software',
    food: 'food & hospitality',
    retail: 'retail / e-commerce',
    manufacturing: 'manufacturing',
    agriculture: 'agriculture',
    services: 'home or professional services',
    healthcare: 'healthcare / life sciences',
    other: 'other',
  };
  const regionLabel: Record<FounderProfile['region'], string> = {
    'wasatch-front': 'the Salt Lake area (Wasatch Front)',
    'utah-county': 'Utah County (Provo/Lehi/Orem)',
    southern: 'Southern Utah (St. George area)',
    northern: 'Northern Utah (Ogden/Logan)',
    rural: 'rural Utah',
    relocating: 'considering relocating to Utah',
  };
  const stageLabel: Record<FounderProfile['stage'], string> = {
    idea: 'just an idea, exploring whether to build it',
    building: 'currently building the product / setting up',
    customers: 'has paying customers',
    scaling: 'scaling, growing fast',
  };
  const needsLabel: Record<FounderProfile['needs'][number], string> = {
    funding: 'funding',
    customers: 'customers',
    hiring: 'hiring / talent',
    legal: 'legal & licensing',
    space: 'office or physical space',
    mentorship: 'mentorship',
    compliance: 'compliance / regulation',
    contracts: 'government contracts',
    export: 'export / international trade',
  };
  const needs = p.needs.length ? p.needs.map((n) => needsLabel[n]).join(', ') : 'open to any relevant help';
  const extra = p.notes ? `\n\nMore context from the founder: ${p.notes}` : '';
  return `I'm running a ${businessLabel[p.businessType]} business based in ${regionLabel[p.region]}. ${stageLabel[p.stage]}. The most pressing needs right now are: ${needs}.${extra}`;
}

const STARTERS = [
  "I'm pre-seed in Salt Lake, just an idea, looking for first steps.",
  "Small ag operation in Washington County, woman-owned, looking to scale.",
  "Veteran in Ogden building a custom fabrication startup.",
  "B2B SaaS in SLC, 18 months in, paying customers, raising first round.",
  "Medical device, 12 employees, FDA-cleared, focused on expansion.",
  "PhD candidate in SLC with novel tech, never founded anything.",
];

export default function Navigator() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [input, setInput] = useState('');
  const [journeyStep, setJourneyStep] = useState<number | null>(null);
  const [output, setOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'quiz' | 'freeform'>('quiz');
  const [persona, setPersona] = useState<Persona>('founder');
  const abortRef = useRef<AbortController | null>(null);

  function submitProfile(profile: FounderProfile, derivedStep: number) {
    const text = profileToPrompt(profile);
    setInput(text);
    setJourneyStep(derivedStep);
    submit(text, derivedStep);
  }

  useEffect(() => {
    loadResources()
      .then(setResources)
      .catch((e: Error) => setError(`Couldn't load resources.json — run \`npm run data\` first. (${e.message})`));
  }, []);

  // Apply ?scenario=<slug> from the home page Judge Mode cards (pre-fills input + step).
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const slug = searchParams.get('scenario');
    if (!slug) return;
    const scenario = JUDGE_SCENARIOS.find((s) => s.slug === slug);
    if (!scenario) return;
    setInput(scenario.prompt);
    if (scenario.journeyStep) setJourneyStep(scenario.journeyStep);
  }, [searchParams]);

  async function submit(text?: string, stepOverride?: number) {
    const value = (text ?? input).trim();
    if (!value || streaming) return;
    if (resources.length === 0) {
      setError('Resources not loaded yet — try again in a moment.');
      return;
    }
    setError(null);
    setOutput('');
    setStreaming(true);
    if (text) setInput(text);

    abortRef.current = new AbortController();
    const stepToUse = stepOverride ?? journeyStep ?? undefined;
    await streamMatch(
      value,
      {
        onText: (chunk) => setOutput((prev) => prev + chunk),
        onDone: () => setStreaming(false),
        onError: (e) => {
          setError(e.message);
          setStreaming(false);
        },
      },
      { journeyStep: stepToUse, persona, signal: abortRef.current.signal }
    );
  }

  function reset() {
    abortRef.current?.abort();
    setInput('');
    setOutput('');
    setError(null);
    setStreaming(false);
    setJourneyStep(null);
    setMode('quiz');
  }

  const hasResult = output.length > 0 || streaming;
  const briefing = useMemo(() => (streaming ? null : parseBriefing(output)), [output, streaming]);
  const visibleMarkdown = stripBriefingBlock(output);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Founder's Navigator</h1>
        <p className="mt-1 text-utah-stone/85">
          Tell us about your startup in your own words. We'll match you to the right Utah programs in seconds.
        </p>
      </div>

      {!hasResult && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-utah-stone/80">I'm a…</p>
          <div className="flex flex-wrap gap-2">
            {([
              { id: 'founder', label: 'Founder' },
              { id: 'investor', label: 'Investor' },
              { id: 'provider', label: 'Service provider' },
            ] as { id: Persona; label: string }[]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPersona(opt.id)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  persona === opt.id
                    ? 'border-utah-gold bg-utah-gold/15 text-utah-gold'
                    : 'border-utah-stone/20 bg-utah-slate text-utah-stone hover:border-utah-gold/60 hover:bg-utah-gold/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasResult && mode === 'quiz' && persona === 'founder' && (
        <div className="card">
          <FounderQuiz onSubmit={submitProfile} disabled={streaming} />
          <div className="mt-6 border-t border-utah-stone/10 pt-4 text-center">
            <button
              type="button"
              className="text-xs text-utah-stone/80 hover:text-utah-gold"
              onClick={() => setMode('freeform')}
            >
              I'd rather just type freely →
            </button>
          </div>
        </div>
      )}

      {!hasResult && (mode === 'freeform' || persona !== 'founder') && (
        <div className="card">
          {persona === 'founder' && (
            <div className="mb-4">
              <button
                type="button"
                className="text-xs text-utah-stone/80 hover:text-utah-gold"
                onClick={() => setMode('quiz')}
              >
                ← Back to the guided quiz
              </button>
            </div>
          )}

          {persona === 'founder' && <JourneyPicker value={journeyStep} onChange={setJourneyStep} />}

          <label htmlFor="founder-input" className="mb-2 mt-4 block text-sm font-semibold">
            {persona === 'founder'
              ? 'What are you building, and what do you need?'
              : persona === 'investor'
                ? 'What do you invest in, and what kind of Utah deal flow or partnerships are you looking for?'
                : 'What services do you offer, and which Utah founders do you want to reach?'}
          </label>
          <textarea
            id="founder-input"
            className="min-h-[120px] w-full rounded-md border border-utah-stone/20 px-4 py-3 outline-none focus:border-utah-sky"
            placeholder={
              persona === 'founder'
                ? "e.g., I'm a veteran in St. George starting a landscaping business and need help with my first $50k of funding."
                : persona === 'investor'
                  ? "e.g., Seed-stage hardware investor based in SLC, want exposure to Utah university spinouts and demo days."
                  : "e.g., Boutique IP firm in Lehi serving deep-tech founders, want to plug into accelerators and university programs."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
            disabled={streaming}
          />

          <div className={`mt-3 ${persona !== 'founder' ? 'hidden' : ''}`}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-utah-stone/80">
              Or try a sample founder
            </p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-full border border-utah-stone/20 bg-utah-slate px-3 py-1.5 text-xs text-utah-stone hover:border-utah-gold/60 hover:bg-utah-gold/10"
                  disabled={streaming || resources.length === 0}
                >
                  {s.length > 60 ? s.slice(0, 60) + '…' : s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-utah-stone/85">
              {resources.length > 0 ? `${resources.length} resources loaded` : 'Loading resources…'}
            </span>
            <button className="btn-primary text-sm" onClick={() => submit()} disabled={streaming || !input.trim()}>
              {streaming ? 'Matching…' : 'Get matched'}
            </button>
          </div>
        </div>
      )}

      {hasResult && (
        <div className="card flex items-center justify-between">
          <span className="text-xs text-utah-stone/85">
            {streaming ? 'Matching…' : 'Matches ready'}
          </span>
          <button className="btn-secondary text-sm" onClick={reset} disabled={streaming}>
            Start over
          </button>
        </div>
      )}

      {error && (
        <div className="card mt-4 border-utah-red/40 bg-utah-red/5 text-sm text-utah-red">
          {error}
        </div>
      )}

      {streaming && (
        <div className="card mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Personalizing your matches…</h2>
            <span className="flex items-center gap-2 text-xs text-utah-stone/80">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-utah-gold" />
              Live
            </span>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-2/3 rounded-full bg-utah-stone/10" />
            <div className="h-4 w-full rounded-full bg-utah-stone/10" />
            <div className="h-4 w-5/6 rounded-full bg-utah-stone/10" />
            <div className="h-4 w-3/4 rounded-full bg-utah-stone/10" />
            <p className="pt-2 text-sm text-utah-stone/80">
              We&apos;re turning your input into ranked Utah matches and a clean founder briefing.
            </p>
          </div>
        </div>
      )}

      {!streaming && hasResult && !briefing && (
        <div className="card mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Your matches</h2>
          </div>
          <div className="markdown-body text-utah-stone/90">
            {visibleMarkdown ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: (props) => <h2 className="mt-6 mb-3 font-display text-xl font-semibold" {...props} />,
                  h3: (props) => <h3 className="mt-5 mb-2 font-display text-lg font-semibold" {...props} />,
                  ul: (props) => <ul className="mb-3 list-disc pl-6 space-y-1" {...props} />,
                  ol: (props) => <ol className="mb-3 list-decimal pl-6 space-y-1" {...props} />,
                  p: (props) => <p className="mb-3 leading-relaxed" {...props} />,
                  strong: (props) => <strong className="font-semibold text-utah-stone" {...props} />,
                  a: (props) => (
                    <a className="text-utah-sky underline hover:no-underline" target="_blank" rel="noreferrer" {...props} />
                  ),
                }}
              >
                {visibleMarkdown}
              </ReactMarkdown>
            ) : (
              <span className="text-sm text-utah-stone/80">No formatted result available.</span>
            )}
          </div>
        </div>
      )}

      {briefing && <Briefing data={briefing} />}
    </div>
  );
}
