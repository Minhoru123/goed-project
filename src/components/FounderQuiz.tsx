import { useState } from 'react';

export type BusinessType =
  | 'tech'
  | 'food'
  | 'retail'
  | 'manufacturing'
  | 'agriculture'
  | 'services'
  | 'healthcare'
  | 'other';

export type Region =
  | 'wasatch-front'
  | 'utah-county'
  | 'southern'
  | 'northern'
  | 'rural'
  | 'relocating';

export type Stage = 'idea' | 'building' | 'customers' | 'scaling';

export type Need =
  | 'funding'
  | 'customers'
  | 'hiring'
  | 'legal'
  | 'space'
  | 'mentorship'
  | 'compliance'
  | 'contracts'
  | 'export';

export interface FounderProfile {
  businessType: BusinessType;
  region: Region;
  stage: Stage;
  needs: Need[];
  notes: string;
}

interface Props {
  onSubmit: (profile: FounderProfile, derivedJourneyStep: number) => void;
  disabled?: boolean;
}

const BUSINESS_TYPES: { id: BusinessType; label: string; subtitle: string }[] = [
  { id: 'tech', label: 'Tech / Software', subtitle: 'SaaS, AI, apps, hardware' },
  { id: 'food', label: 'Food & Hospitality', subtitle: 'Restaurants, catering, CPG' },
  { id: 'retail', label: 'Retail / E-commerce', subtitle: 'Storefronts, online brands' },
  { id: 'manufacturing', label: 'Manufacturing', subtitle: 'Goods, parts, fabrication' },
  { id: 'agriculture', label: 'Agriculture', subtitle: 'Farming, ranching, agtech' },
  { id: 'services', label: 'Home & Professional Services', subtitle: 'Trades, consulting, repairs' },
  { id: 'healthcare', label: 'Healthcare / Life Sciences', subtitle: 'Devices, biotech, clinics' },
  { id: 'other', label: 'Something else', subtitle: 'Tell us in the last step' },
];

const REGIONS: { id: Region; label: string; subtitle: string }[] = [
  { id: 'wasatch-front', label: 'Salt Lake area', subtitle: 'SLC, Sandy, West Valley' },
  { id: 'utah-county', label: 'Utah County', subtitle: 'Provo, Lehi, Orem' },
  { id: 'southern', label: 'Southern Utah', subtitle: 'St. George, Cedar City' },
  { id: 'northern', label: 'Northern Utah', subtitle: 'Ogden, Logan' },
  { id: 'rural', label: 'Rural Utah', subtitle: 'Anywhere else in-state' },
  { id: 'relocating', label: 'Outside Utah', subtitle: "I'm thinking about moving here" },
];

const STAGES: { id: Stage; label: string; subtitle: string; emoji: string }[] = [
  { id: 'idea', label: 'Just an idea', subtitle: 'Exploring whether to build it', emoji: '💡' },
  { id: 'building', label: 'Building it', subtitle: 'Working on product / setup', emoji: '🔨' },
  { id: 'customers', label: 'Have customers', subtitle: 'Revenue coming in', emoji: '🤝' },
  { id: 'scaling', label: 'Scaling', subtitle: 'Growing fast, hiring, raising', emoji: '📈' },
];

const NEEDS: { id: Need; label: string }[] = [
  { id: 'funding', label: 'Funding' },
  { id: 'customers', label: 'Customers' },
  { id: 'hiring', label: 'Hiring / talent' },
  { id: 'legal', label: 'Legal & licensing' },
  { id: 'space', label: 'Office / space' },
  { id: 'mentorship', label: 'Mentorship' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'contracts', label: 'Govt. contracts' },
  { id: 'export', label: 'Export / intl.' },
];

// Map quiz answers back to one of the 19 startup.utah.gov journey steps so the
// existing Claude prompt and resource matching keep working unchanged.
function deriveJourneyStep(stage: Stage, needs: Need[]): number {
  if (stage === 'idea') return 1; // Find Your Big Idea
  if (stage === 'building') {
    if (needs.includes('funding')) return 9; // Fund Your Small Business
    if (needs.includes('legal') || needs.includes('compliance')) return 7; // Registration & Licensure
    if (needs.includes('space')) return 10; // Find Office Space
    return 4; // Build Your Product or Service
  }
  if (stage === 'customers') {
    if (needs.includes('funding')) return 13; // Growth Stage Funding
    if (needs.includes('hiring')) return 15; // Workforce & Talent Acquisition
    if (needs.includes('contracts')) return 16; // Government Contracts
    return 14; // Strategic Planning for Growth
  }
  // scaling
  if (needs.includes('export')) return 17;
  if (needs.includes('contracts')) return 16;
  if (needs.includes('hiring')) return 15;
  return 13;
}

export default function FounderQuiz({ onSubmit, disabled }: Props) {
  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [notes, setNotes] = useState('');

  const totalSteps = 5;
  const progress = ((step + 1) / totalSteps) * 100;

  function toggleNeed(id: Need) {
    setNeeds((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));
  }

  function next() {
    if (step < totalSteps - 1) setStep(step + 1);
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  function submit() {
    if (!businessType || !region || !stage) return;
    const profile: FounderProfile = { businessType, region, stage, needs, notes: notes.trim() };
    onSubmit(profile, deriveJourneyStep(stage, needs));
  }

  const canAdvance =
    (step === 0 && businessType !== null) ||
    (step === 1 && region !== null) ||
    (step === 2 && stage !== null) ||
    step === 3 ||
    step === 4;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-utah-stone/80">
          Step {step + 1} of {totalSteps}
        </p>
        <p className="text-xs text-utah-stone/85">~30 seconds</p>
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-utah-stone/10">
        <div
          className="h-full bg-utah-gold transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {step === 0 && (
        <div>
          <h2 className="mb-1 font-display text-2xl font-semibold">What kind of business?</h2>
          <p className="mb-4 text-sm text-utah-stone/80">Pick the closest match. We'll personalize from here.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {BUSINESS_TYPES.map((b) => {
              const on = businessType === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { setBusinessType(b.id); setTimeout(next, 150); }}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    on
                      ? 'border-utah-gold bg-utah-gold/10'
                      : 'border-utah-stone/15 hover:border-utah-gold/50 hover:bg-utah-gold/5'
                  }`}
                >
                  <div className={`text-sm font-semibold ${on ? 'text-utah-gold' : 'text-utah-stone'}`}>
                    {b.label}
                  </div>
                  <div className="text-xs text-utah-stone/85">{b.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2 className="mb-1 font-display text-2xl font-semibold">Where in Utah?</h2>
          <p className="mb-4 text-sm text-utah-stone/80">Programs and incentives vary by region.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {REGIONS.map((r) => {
              const on = region === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setRegion(r.id); setTimeout(next, 150); }}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    on
                      ? 'border-utah-gold bg-utah-gold/10'
                      : 'border-utah-stone/15 hover:border-utah-gold/50 hover:bg-utah-gold/5'
                  }`}
                >
                  <div className={`text-sm font-semibold ${on ? 'text-utah-gold' : 'text-utah-stone'}`}>
                    {r.label}
                  </div>
                  <div className="text-xs text-utah-stone/85">{r.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="mb-1 font-display text-2xl font-semibold">How far along are you?</h2>
          <p className="mb-4 text-sm text-utah-stone/80">Be honest — we tune the matches to where you actually are.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {STAGES.map((s) => {
              const on = stage === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setStage(s.id); setTimeout(next, 150); }}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
                    on
                      ? 'border-utah-gold bg-utah-gold/10'
                      : 'border-utah-stone/15 hover:border-utah-gold/50 hover:bg-utah-gold/5'
                  }`}
                >
                  <span className="text-2xl leading-none">{s.emoji}</span>
                  <div>
                    <div className={`text-sm font-semibold ${on ? 'text-utah-gold' : 'text-utah-stone'}`}>
                      {s.label}
                    </div>
                    <div className="text-xs text-utah-stone/85">{s.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="mb-1 font-display text-2xl font-semibold">What do you need next?</h2>
          <p className="mb-4 text-sm text-utah-stone/80">Pick as many as apply.</p>
          <div className="flex flex-wrap gap-2">
            {NEEDS.map((n) => {
              const on = needs.includes(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => toggleNeed(n.id)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    on
                      ? 'border-utah-gold bg-utah-gold/15 text-utah-gold'
                      : 'border-utah-stone/20 text-utah-stone/80 hover:border-utah-gold/50'
                  }`}
                >
                  {n.label}
                </button>
              );
            })}
          </div>
          {needs.length > 0 && (
            <p className="mt-3 text-xs text-utah-stone/85">
              {needs.length} selected — tap a chip again to remove it.
            </p>
          )}
        </div>
      )}

      {step === 4 && (
        <div>
          <h2 className="mb-1 font-display text-2xl font-semibold">Anything else?</h2>
          <p className="mb-4 text-sm text-utah-stone/80">
            Optional. Specifics help — funding amount, timeline, who you serve, what you've tried.
          </p>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-utah-stone/20 bg-utah-slate px-4 py-3 text-sm outline-none focus:border-utah-gold"
            placeholder="e.g., I'm raising a $250k pre-seed to launch in Q3. Two co-founders, no funding yet."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          disabled={step === 0 || disabled}
          className="text-sm text-utah-stone/80 hover:text-utah-stone disabled:opacity-30"
        >
          ← Back
        </button>
        {step < totalSteps - 1 ? (
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance || disabled}
            className="btn-secondary text-sm"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!businessType || !region || !stage || disabled}
            className="btn-primary text-sm"
          >
            {disabled ? 'Matching…' : 'Get my matches →'}
          </button>
        )}
      </div>
    </div>
  );
}
