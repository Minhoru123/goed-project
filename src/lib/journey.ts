// The 19-step Utah entrepreneur journey from startup.utah.gov.
// Used as the spine of the Navigator: founders pick where they are; results
// are framed in terms of these steps.

export type JourneyPhase = 'Thinking' | 'Starting' | 'Growing' | 'Exit';

export interface JourneyStep {
  n: number;
  title: string;
  slug: string;
  phase: JourneyPhase;
}

export const JOURNEY_STEPS: JourneyStep[] = [
  { n: 1, title: 'Find Your Big Idea', slug: 'find-idea', phase: 'Thinking' },
  { n: 2, title: 'Important Business Skills', slug: 'business-skills', phase: 'Thinking' },
  { n: 3, title: 'Business Validation', slug: 'business-validation', phase: 'Starting' },
  { n: 4, title: 'Build Your Product or Service', slug: 'build-product', phase: 'Starting' },
  { n: 5, title: 'Develop Brand & Marketing', slug: 'develop-brand', phase: 'Starting' },
  { n: 6, title: 'Write Your Business Plan', slug: 'business-plan-step', phase: 'Starting' },
  { n: 7, title: 'Registration & Licensure', slug: 'registration', phase: 'Starting' },
  { n: 8, title: 'Establish Business Operations', slug: 'business-operations', phase: 'Starting' },
  { n: 9, title: 'Fund Your Small Business', slug: 'fund-small-business', phase: 'Starting' },
  { n: 10, title: 'Find Office Space', slug: 'find-space', phase: 'Starting' },
  { n: 11, title: 'Pay Your Taxes', slug: 'pay-taxes', phase: 'Starting' },
  { n: 12, title: 'Join a Community', slug: 'join-community', phase: 'Growing' },
  { n: 13, title: 'Growth Stage Funding', slug: 'growth-funding', phase: 'Growing' },
  { n: 14, title: 'Strategic Planning for Growth', slug: 'strategic-planning', phase: 'Growing' },
  { n: 15, title: 'Workforce & Talent Acquisition', slug: 'workforce', phase: 'Growing' },
  { n: 16, title: 'Obtain Government Contracts', slug: 'government-contracts-2', phase: 'Growing' },
  { n: 17, title: 'International Trade', slug: 'international-trade-2', phase: 'Growing' },
  { n: 18, title: 'Relocate Your Business to Utah', slug: 'relocate-business', phase: 'Growing' },
  { n: 19, title: 'Close Your Business', slug: 'close-business', phase: 'Exit' },
];

export const JOURNEY_BY_PHASE: Record<JourneyPhase, JourneyStep[]> = {
  Thinking: JOURNEY_STEPS.filter((s) => s.phase === 'Thinking'),
  Starting: JOURNEY_STEPS.filter((s) => s.phase === 'Starting'),
  Growing: JOURNEY_STEPS.filter((s) => s.phase === 'Growing'),
  Exit: JOURNEY_STEPS.filter((s) => s.phase === 'Exit'),
};

export function stepUrl(step: JourneyStep): string {
  return `https://startup.utah.gov/${step.slug}/`;
}

export function getStep(n: number): JourneyStep | undefined {
  return JOURNEY_STEPS.find((s) => s.n === n);
}

// Keyword rules for mapping a resource (description + topics) to journey steps.
// Used by ETL — keep deterministic, language-stable, and conservative
// (better to under-tag than to mislabel everything as Step 1).
export const STEP_KEYWORDS: Record<number, RegExp> = {
  1: /\b(idea(tion)?|brainstorm|find your big idea|just an idea|early concept)\b/i,
  2: /\b(business skills?|fundamentals?|entrepreneurship 101|founder education|literacy)\b/i,
  3: /\b(validation|customer discovery|market research|product[-\s]?market fit|test the market)\b/i,
  4: /\b(build (your )?product|prototype|mvp|engineering|develop the product|software development|hardware)\b/i,
  5: /\b(brand(ing)?|marketing|website|seo|social media|advertising|public relations)\b/i,
  6: /\b(business plan|pitch deck|financial projections|executive summary)\b/i,
  7: /\b(registration|licensure|incorporate|llc|business license|trademark|patent|regulatory)\b/i,
  8: /\b(operations|payroll|hiring (your first|first employee)|insurance|hr|legal counsel|bookkeeping|accountant)\b/i,
  9: /\b(seed funding|pre[-\s]?seed|angel|small business loan|microloan|sba loan|grant|startup capital|raising your first|crowdfund(ing)?|sbir|sttr|non[-\s]?dilutive)\b/i,
  10: /\b(office space|coworking|incubator space|lab space|workspace|real estate)\b/i,
  11: /\b(tax(es|ation)?|sales tax|tax credit|tax incentive|file(d|ing) taxes)\b/i,
  12: /\b(community|networking|meetup|1 ?million ?cups|founder group|peer group|chamber of commerce)\b/i,
  13: /\b(series [a-c]|growth (capital|funding)|venture (capital|funding)|institutional capital|late[-\s]?stage)\b/i,
  14: /\b(strategic planning|scale|growth strategy|expansion strategy|operational efficiency)\b/i,
  15: /\b(workforce|talent|recruit(ing|ment)|hire engineers|talent acquisition|workforce services|apprentice)\b/i,
  16: /\b(government contracts?|federal contract|gsa|procurement|set[-\s]?aside|hubzone)\b/i,
  17: /\b(international trade|export(ing|er|s)?|world trade|foreign market|tariff)\b/i,
  18: /\b(relocate|move (your|the) business|expansion to utah|incentive to move)\b/i,
  19: /\b(close (your|the) business|exit|wind down|dissolve|sell (your|the) (business|company)|m&a)\b/i,
};
