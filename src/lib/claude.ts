export interface StreamCallbacks {
  onText: (chunk: string) => void;
  onDone: (full: string) => void;
  onError: (err: Error) => void;
}

function parseErrorMessage(raw: string): string {
  if (!raw) return 'Request failed.';

  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {
    // Some responses are plain text, which is fine.
  }

  return raw;
}

export interface StreamMatchOptions {
  journeyStep?: number;
  signal?: AbortSignal;
}

export async function streamMatch(
  userInput: string,
  cb: StreamCallbacks,
  options: StreamMatchOptions = {}
): Promise<void> {
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput, journeyStep: options.journeyStep }),
      signal: options.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`Match request failed (${res.status}): ${parseErrorMessage(text)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      cb.onText(chunk);
    }

    cb.onDone(full);
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    cb.onError(err as Error);
  }
}
