import { loadResourceCatalog } from './_lib/catalog';

export default async function resources(): Promise<Response> {
  try {
    const resources = await loadResourceCatalog();
    return Response.json(resources, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resource catalog unavailable.';
    return Response.json({ error: message }, { status: 502 });
  }
}
