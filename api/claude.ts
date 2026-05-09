import Anthropic from '@anthropic-ai/sdk';
import { loadResourceCatalog, type ResourceCatalogItem } from './_lib/catalog';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_INPUT_CHARS = 1200;
const MAX_BODY_BYTES = 8_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

const rateWindowByIp = new Map<string, number[]>();

interface Body {
  userInput: string;
  journeyStep?: number;
}

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

function buildPrompt(userInput: string, resources: ResourceCatalogItem[], journeyStep?: number): string {
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

  const stepLine = journeyStep
    ? `The founder says they are at JOURNEY STEP ${journeyStep}: ${JOURNEY_STEP_TITLES[journeyStep] || ''}. Prioritize resources that serve that step (or the next 1-2 steps), and tag every recommendation with the step number(s) it supports.`
    : 'Infer where the founder is in the 19-step Utah entrepreneur journey from their input, and tag every recommendation with the step number(s) it supports.';

  return `You are a Utah-savvy advisor for the Governor's Office of Economic Development.

VOICE — Adapt your tone to the founder's situation. The user message tells you what kind of business they run. Plain, friendly English for trades / food / services / agriculture / retail owners; direct startup-speak (TAM, GTM, runway, dilution) only when the founder is clearly a tech / SaaS / life-sciences operator. Never use jargon a non-technical owner wouldn't recognize. Avoid the word "ecosystem" with non-tech founders.

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

The user just said:
"""
${userInput}
"""

${stepLine}

Match them to the 3-5 best resources from this catalog. Only use resources from the list.

CATALOG:
${catalog}

Respond in TWO parts.

PART 1 — Concise markdown for the founder, in this exact structure:

## Top matches

For each match (3-5, ranked):
### {Resource name}  ·  Step {N}{, M}
- **Why this fits:** one or two sentences tying it to their stage and the journey step.
- **Next step:** one specific action.
- **Link:** the URL.

## What to do this week
A short paragraph with a prioritized 2-3 step plan.

PART 2 — Immediately after the markdown, output a single fenced JSON code block that machines can parse for a "Founder Briefing" handout. Use this exact shape:

\`\`\`json
{
  "founder_summary": "One sentence describing the founder including which journey step they're at.",
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
  "intro_email": "Subject: ...\\n\\nHi [Program Team],\\n\\nA full 4-6 sentence email the founder can copy-paste to introduce themselves and ask for a next step. Address it generically since we don't know the recipient's name."
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

  const resources = await loadResourceCatalog();
  if (resources.length === 0) {
    console.error(`[${requestId}] Resource catalog is empty or invalid.`);
    return new Response('Resource catalog is unavailable.', { status: 500 });
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(userInput, resources, journeyStep);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const response = await client.messages.stream({
          model: MODEL,
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        });

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (error) {
        console.error(`[${requestId}] Claude request failed.`, error);
        controller.enqueue(encoder.encode('\n\n[The match service hit an error. Please try again.]'));
        controller.close();
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
