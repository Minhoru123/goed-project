export interface FilterResult {
  ids: string[];
  reasoning: string;
  summary: string;
}

export async function aiFilterCompanies(query: string): Promise<FilterResult> {
  const res = await fetch('/api/filter-companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<FilterResult> & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Filter request failed (${res.status})`);
  }
  if (!Array.isArray(data.ids)) {
    throw new Error('Malformed response from filter endpoint');
  }
  return {
    ids: data.ids,
    reasoning: data.reasoning || '',
    summary: data.summary || '',
  };
}
