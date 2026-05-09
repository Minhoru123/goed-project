import Anthropic from '@anthropic-ai/sdk';
import { loadCompanyCatalog, type CompanyCatalogItem } from './_lib/catalog';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_QUERY_CHARS = 400;
const MAX_BODY_BYTES = 4_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_RESULTS = 30;

const rateWindowByIp = new Map<string, number[]>();

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
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

function buildPrompt(query: string, companies: CompanyCatalogItem[]): string {
  const catalog = companies
    .map(
      (company) =>
        `[${company.id}] ${company.name} | ${company.sector ?? '?'} | ${company.stage ?? '?'} | ${company.city ?? '?'} | ${company.employees ?? '?'} | ${company.description ?? ''}`
    )
    .join('\n');

  return `You are a Utah ecosystem analyst helping an investor scan the startup map.

INVESTOR QUERY:
"""
${query}
"""

CANDIDATE COMPANIES (id | name | sector | stage | city | employees | description):
${catalog}

Return a JSON object — no prose, no markdown — with this exact shape:

{
  "ids": ["company-id-1", "company-id-2", ...],
  "reasoning": "One sentence explaining what you filtered for (e.g. 'Series A AI companies in Salt Lake City').",
  "summary": "One short paragraph (max 60 words) summarizing the matches as a portfolio view for the investor."
}

Rules:
- Only include ids that appear in the candidate list above.
- Return at most ${MAX_RESULTS} ids, ranked by best fit.
- If nothing matches, return ids: [] with a reasoning that says so.
- Output JSON only. Do not wrap it in code fences or commentary.`;
}

interface ClaudeReply {
  ids: string[];
  reasoning: string;
  summary: string;
}

function safeParse(raw: string): ClaudeReply | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (
      Array.isArray(parsed?.ids) &&
      parsed.ids.every((id) => typeof id === 'string') &&
      typeof parsed?.reasoning === 'string' &&
      typeof parsed?.summary === 'string'
    ) {
      return {
        ids: (parsed.ids as string[]).slice(0, MAX_RESULTS),
        reasoning: parsed.reasoning,
        summary: parsed.summary,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export default async function filterCompanies(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response('ANTHROPIC_API_KEY not configured.', { status: 500 });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip, Date.now())) {
    return Response.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429 });
  }

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: 'Request too large.' }, { status: 413 });
  }

  let body: { query?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return Response.json({ error: 'Request too large.' }, { status: 413 });
    }
    body = JSON.parse(raw) as { query?: unknown };
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const query = cleanText(body?.query, MAX_QUERY_CHARS);
  if (!query) {
    return Response.json({ error: 'Missing query.' }, { status: 400 });
  }

  const companies = (await loadCompanyCatalog()).filter(
    (company): company is CompanyCatalogItem & { lat: number; lng: number } =>
      typeof company.lat === 'number' && typeof company.lng === 'number'
  );
  if (companies.length === 0) {
    return Response.json({ error: 'Company catalog unavailable.' }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: 'user', content: buildPrompt(query, companies) }],
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');

    const parsed = safeParse(text);
    if (!parsed) {
      return Response.json({ error: 'Could not parse AI response.', raw: text.slice(0, 200) }, { status: 502 });
    }

    const validIds = new Set(companies.map((company) => company.id));
    const ids = parsed.ids.filter((id) => validIds.has(id));

    return Response.json({ ids, reasoning: parsed.reasoning, summary: parsed.summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 502 });
  }
}
