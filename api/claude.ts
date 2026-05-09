import Anthropic from '@anthropic-ai/sdk';
import { loadResourceCatalog, type ResourceCatalogItem } from './_lib/catalog';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_INPUT_CHARS = 1200;
const MAX_BODY_BYTES = 8_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_CLAUDE_ATTEMPTS = 2;
const CLAUDE_RETRY_DELAY_MS = 800;

const rateWindowByIp = new Map<string, number[]>();

type Persona = 'founder' | 'investor' | 'provider';

interface Body {
  userInput: string;
  journeyStep?: number;
  persona?: Persona;
}

const PERSONA_CONFIG: Record<Persona, { role: string; audience: string; voice: string; intent: string; partTitle: string; planTitle: string; jsonHint: string }> = {
  founder: {
    role: "a Utah-savvy advisor for the Governor's Office of Economic Development helping a founder",
    audience: 'founder',
    voice:
      "Adapt your tone to the founder's situation. Plain, friendly English for trades / food / services / agriculture / retail / healthcare owners; direct startup-speak (TAM, GTM, runway, dilution) only when the founder is clearly a tech / SaaS / life-sciences operator. Never use jargon a non-technical owner wouldn't recognize. Avoid the word \"ecosystem\" with non-tech founders.",
    intent: 'Match them to the 3-5 best Utah resources from the catalog that fit their stage and the most pressing need.',
    partTitle: '## Top matches',
    planTitle: '## What to do this week',
    jsonHint:
      '"founder_summary" describes the founder and their journey step in one sentence. "intro_email" is a 4-6 sentence note the founder can copy-paste to a program asking how to engage.',
  },
  investor: {
    role: 'a Utah-savvy advisor helping an investor (angel, VC, or family office) plug into the Utah startup landscape',
    audience: 'investor',
    voice:
      'Direct investor-speak. Assume familiarity with stages, terms, and the venture stack. Be concise and signal-dense.',
    intent:
      'They want Utah programs and orgs to plug into for deal flow, co-investment, sector access, demo days, or LP relationships. Match them to the 3-5 best fits from the catalog (accelerators, university tech transfer, regional dev orgs, sector trade groups, demo events). Never recommend a program that has no investor angle.',
    partTitle: '## Top picks for deal flow',
    planTitle: '## How to engage this week',
    jsonHint:
      '"founder_summary" is repurposed: one sentence describing the investor and the segment they want exposure to. "intro_email" is a 4-6 sentence note the investor can send a program asking for warm intros, demo day access, or sponsorship/partnership conversation.',
  },
  provider: {
    role: 'a Utah-savvy advisor helping a service provider (lawyer, accountant, fractional exec, consultant, or agency) find Utah founders to serve',
    audience: 'service provider',
    voice: 'Plain, professional English. Skip VC jargon.',
    intent:
      'They want Utah programs and orgs where founders gather and where partnering, sponsoring, mentoring, or showing up adds value. Match them to the 3-5 best fits from the catalog. Never recommend a program where a service provider has no natural way in.',
    partTitle: '## Top picks to engage',
    planTitle: '## How to engage this week',
    jsonHint:
      '"founder_summary" is repurposed: one sentence describing the provider and which founders they serve best. "intro_email" is a 4-6 sentence note the provider can send a program offering to mentor / sponsor / present / partner.',
  },
};

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('client-ip') || 'unknown';
}

function isRateLimited(ip: string, now: number): boolean {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (rateWindowByIp.get(ip) || []).filter((timestamp) => timestamp > windowStart);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    rateWindowByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateWindowByIp.set(ip, recent);
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableClaudeError(error: unknown): boolean {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  if (status === 429 || (status != null && status >= 500 && status < 600)) return true;

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('overload') ||
    message.includes('rate limit') ||
    message.includes('timeout') ||
    message.includes('network')
  );
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

const JOURNEY_STEP_TITLES: Record<number, string> = {
  1: 'Find Your Big Idea',
  2: 'Important Business Skills',
  3: 'Business Validation',
  4: 'Build Your Product or Service',
  5: 'Develop Brand & Marketing',
  6: 'Write Your Business Plan',
  7: 'Registration & Licensure',
  8: 'Establish Business Operations',
  9: 'Fund Your Small Business',
  10: 'Find Office Space',
  11: 'Pay Your Taxes',
  12: 'Join a Community',
  13: 'Growth Stage Funding',
  14: 'Strategic Planning for Growth',
  15: 'Workforce & Talent Acquisition',
  16: 'Obtain Government Contracts',
  17: 'International Trade',
  18: 'Relocate Your Business to Utah',
  19: 'Close Your Business',
};

function buildPrompt(userInput: string, resources: ResourceCatalogItem[], journeyStep: number | undefined, persona: Persona): string {
  const cfg = PERSONA_CONFIG[persona];
  const catalog = resources
    .map(
      (resource) => `- [${resource.id}] ${resource.name}
    URL: ${resource.url}
    Email: ${resource.email ?? 'n/a'}
    Journey Steps: ${resource.journeySteps.length ? resource.journeySteps.join(', ') : 'any'}
    Communities: ${resource.communities.join(', ') || 'any'}
    Industries: ${resource.industries.join(', ') || 'any'}
    Locations: ${resource.locations.join(', ') || 'statewide'}
    Topics/Stages: ${resource.topics.join(', ') || 'any'}
    Summary: ${resource.description.slice(0, 280)}`
    )
    .join('\n');

  const stepLine =
    persona === 'founder'
      ? journeyStep
        ? `The founder says they are at JOURNEY STEP ${journeyStep}: ${JOURNEY_STEP_TITLES[journeyStep] || ''}. Prioritize resources that serve that step (or the next 1-2 steps), and tag every recommendation with the step number(s) it supports.`
        : 'Infer where the founder is in the 19-step Utah entrepreneur journey from their input, and tag every recommendation with the step number(s) it supports.'
      : `Tag every recommendation with the founder journey step(s) the program serves so the ${cfg.audience} knows which founders they will reach through it.`;

  return `You are ${cfg.role}.

VOICE — ${cfg.voice}

CONTEXT — Utah's startup.utah.gov organizes founder support around a 19-step entrepreneur journey:
1. Find Your Big Idea (Thinking)
2. Important Business Skills (Thinking)
3. Business Validation (Starting)
4. Build Your Product or Service (Starting)
5. Develop Brand & Marketing (Starting)
6. Write Your Business Plan (Starting)
7. Registration & Licensure (Starting)
8. Establish Business Operations (Starting)
9. Fund Your Small Business (Starting)
10. Find Office Space (Starting)
11. Pay Your Taxes (Starting)
12. Join a Community (Growing)
13. Growth Stage Funding (Growing)
14. Strategic Planning for Growth (Growing)
15. Workforce & Talent Acquisition (Growing)
16. Obtain Government Contracts (Growing)
17. International Trade (Growing)
18. Relocate Your Business to Utah (Growing)
19. Close Your Business (Exit)

The ${cfg.audience} just said:
"""
${userInput}
"""

${stepLine}

${cfg.intent} Only use resources from the list.

CATALOG:
${catalog}

Respond in TWO parts.

PART 1 — Concise markdown for the ${cfg.audience}, in this exact structure:

${cfg.partTitle}

For each match (3-5, ranked):
### {Resource name}  ·  Step {N}{, M}
- **Why this fits:** one or two sentences tying it to the ${cfg.audience}'s situation and the journey step the program serves.
- **Next step:** one specific action.
- **Link:** the URL.

${cfg.planTitle}
A short paragraph with a prioritized 2-3 step plan.

PART 2 — Immediately after the markdown, output a single fenced JSON code block. Use this exact shape (keys are fixed; ${cfg.jsonHint}):

\`\`\`json
{
  "founder_summary": "One sentence per the field meaning above.",
  "journey_step": 9,
  "top_picks": [
    {
      "resource_id": "the [id] from the catalog",
      "name": "Resource name",
      "url": "URL",
      "email": "contact email or null",
      "journey_steps": [9, 13],
      "why": "one sentence",
      "next_step": "one specific action",
      "deadline": "deadline if mentioned in catalog summary, else null"
    }
  ],
  "intro_email": "Subject: ...\\n\\nHi [Program Team],\\n\\nThe email body per the field meaning above. Address it generically since we don't know the recipient's name."
}
\`\`\`

Include 3 picks in top_picks (the strongest from your matches). Be direct, Utah-specific, and never invent programs not in the catalog.`;
}

export default async function claude(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response('ANTHROPIC_API_KEY not configured on the server.', { status: 500 });
  }

  const requestId = crypto.randomUUID();
  const ip = getClientIp(req);
  if (isRateLimited(ip, Date.now())) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again in a few minutes.', requestId }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Request is too large.', requestId }), {
      status: 413,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  let body: Body;
  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: 'Request is too large.', requestId }), {
        status: 413,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }
    body = JSON.parse(rawBody) as Body;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const userInput = cleanText(body?.userInput, MAX_INPUT_CHARS);
  if (!userInput) {
    return new Response('Missing userInput', { status: 400 });
  }

  const rawStep = body?.journeyStep;
  const journeyStep =
    typeof rawStep === 'number' && Number.isFinite(rawStep) && rawStep >= 1 && rawStep <= 19
      ? Math.trunc(rawStep)
      : undefined;

  const persona: Persona =
    body?.persona === 'investor' || body?.persona === 'provider' ? body.persona : 'founder';

  const resources = await loadResourceCatalog();
  if (resources.length === 0) {
    console.error(`[${requestId}] Resource catalog is empty or invalid.`);
    return new Response('Resource catalog is unavailable.', { status: 500 });
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(userInput, resources, journeyStep, persona);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for (let attempt = 1; attempt <= MAX_CLAUDE_ATTEMPTS; attempt += 1) {
        let wroteText = false;
        try {
          const response = await client.messages.stream({
            model: MODEL,
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }],
          });

          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              wroteText = true;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
          return;
        } catch (error) {
          console.error(`[${requestId}] Claude request failed on attempt ${attempt}.`, error);
          if (!wroteText && attempt < MAX_CLAUDE_ATTEMPTS && isRetryableClaudeError(error)) {
            await delay(CLAUDE_RETRY_DELAY_MS * attempt);
            continue;
          }

          const message = wroteText
            ? '\n\n[The match service was interrupted. Please try again.]'
            : '\n\n[The match service hit an error. Please try again.]';
          controller.enqueue(encoder.encode(message));
          controller.close();
          return;
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Request-Id': requestId,
    },
  });
}
