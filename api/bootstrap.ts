export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ data: {}, missing: [] }), {
    status: 200,
    headers: corsHeaders,
  });
}
