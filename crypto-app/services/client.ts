const AVE_API_KEY = import.meta.env.VITE_AVE_API_KEY || '';

export function isEnabled(): boolean {
  return !!AVE_API_KEY;
}

export interface AveClient {
  get(path: string): Promise<any>;
}

let client: AveClient | null = null;

function getClient(): AveClient {
  if (!client) {
    client = {
      async get(path: string) {
        if (!AVE_API_KEY) {
          throw new Error('AVE_API_KEY not configured. Add VITE_AVE_API_KEY to your .env.local file.');
        }
        const response = await fetch(`https://api.ave.cloud/v1${path}`, {
          headers: {
            'Authorization': `Bearer ${AVE_API_KEY}`,
            'Accept': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error(`AVE API error: ${response.status}`);
        }
        return response.json();
      },
    };
  }
  return client;
}

export async function aveGet(path: string): Promise<any> {
  return getClient().get(path);
}
