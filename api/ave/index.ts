export const config = { runtime: 'edge' };

const AVE_API_KEY = process.env.AVE_API_KEY || '';
const AVE_API_BASE = 'https://prod.ave-api.com/v2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-KEY',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/ave\/?/, '');
  const targetUrl = `${AVE_API_BASE}/${path}${url.search}`;

  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'X-API-KEY': AVE_API_KEY,
        'Accept': 'application/json',
      },
    });

    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: corsHeaders,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
