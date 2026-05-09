import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';

export function createNetlifyHandler(
  handler: (request: Request) => Promise<Response>
): Handler {
  return async (event: HandlerEvent): Promise<HandlerResponse> => {
    const request = toRequest(event);
    const response = await handler(request);
    const body = await response.text();

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    };
  };
}

function toRequest(event: HandlerEvent): Request {
  const url = event.rawUrl || buildFallbackUrl(event);
  const headers = new Headers();

  for (const [key, value] of Object.entries(event.headers)) {
    if (typeof value === 'string') {
      headers.set(key, value);
    }
  }

  const body =
    event.httpMethod === 'GET' || event.httpMethod === 'HEAD'
      ? undefined
      : event.isBase64Encoded && event.body
        ? Buffer.from(event.body, 'base64')
        : event.body ?? undefined;

  return new Request(url, {
    method: event.httpMethod,
    headers,
    body,
  });
}

function buildFallbackUrl(event: HandlerEvent): string {
  const host = event.headers.host || 'localhost';
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const path = event.path || '/';
  const query = event.rawQuery ? `?${event.rawQuery}` : '';
  return `${proto}://${host}${path}${query}`;
}
