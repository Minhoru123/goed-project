export interface JudgeScenario {
  slug: string;
  name: string;
  summary: string;
  prompt: string;
  journeyStep?: number;
}

export const JUDGE_SCENARIOS: JudgeScenario[] = [
  {
    slug: 'jordan',
    name: 'Jordan, 20 — Salt Lake City',
    summary: 'Pre-seed founder with an idea but no business yet.',
    prompt: "I'm pre-seed in Salt Lake, just an idea, looking for first steps.",
    journeyStep: 1,
  },
  {
    slug: 'maria',
    name: 'Maria, 38 — Washington County',
    summary: 'Rural agricultural operator, woman-owned, looking to scale.',
    prompt: 'Small ag operation in Washington County, woman-owned, looking to scale.',
    journeyStep: 14,
  },
  {
    slug: 'marcus',
    name: 'Marcus, 34 — Ogden',
    summary: 'Veteran launching a fabrication and manufacturing business.',
    prompt: 'Veteran in Ogden building a custom fabrication startup.',
    journeyStep: 7,
  },
  {
    slug: 'priya',
    name: 'Priya, 31 — Salt Lake City',
    summary: 'B2B SaaS founder preparing for her first venture round.',
    prompt: 'B2B SaaS in SLC, 18 months in, paying customers, raising first round.',
    journeyStep: 13,
  },
  {
    slug: 'david',
    name: 'David, 45 — Provo',
    summary: 'Medical device company looking to expand internationally.',
    prompt: 'Medical device, 12 employees, FDA-cleared, focused on expansion.',
    journeyStep: 17,
  },
  {
    slug: 'amir',
    name: 'Dr. Amir, 29 — Salt Lake City',
    summary: 'University researcher commercializing novel technology.',
    prompt: 'PhD candidate in SLC with novel tech, never founded anything.',
    journeyStep: 3,
  },
];

export function findScenario(slug: string | null): JudgeScenario | null {
  if (!slug) return null;
  return JUDGE_SCENARIOS.find((scenario) => scenario.slug === slug) ?? null;
}
