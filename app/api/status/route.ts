import { env } from 'cloudflare:workers';
import {dashScopeKey} from '@/lib/local-api';
export async function GET(request:Request) {
  const vars = env as unknown as Record<string, string | undefined>;
  return Response.json(
    { available: !!dashScopeKey(request,vars), provider: '阿里云百炼' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
