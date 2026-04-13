export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const fromDate = url.searchParams.get('fromDate') || new Date().toISOString().split('T')[0];
  const toDate = url.searchParams.get('toDate') || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const events = [
    { date: new Date().toISOString().split('T')[0], event: 'FOMC Meeting Minutes', country: 'US', impact: 'high', forecast: '-', previous: '-' },
    { date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0], event: 'CPI Data Release', country: 'US', impact: 'high', forecast: '3.2%', previous: '3.1%' },
    { date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0], event: 'Initial Jobless Claims', country: 'US', impact: 'medium', forecast: '220K', previous: '215K' },
    { date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0], event: 'GDP Growth Rate', country: 'EU', impact: 'high', forecast: '0.3%', previous: '0.1%' },
    { date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], event: 'BoJ Interest Rate Decision', country: 'JP', impact: 'high', forecast: '0.25%', previous: '0.10%' },
  ];

  return new Response(JSON.stringify({ events, fromDate, toDate }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'public, s-maxage=300',
    },
  });
}
