import { env } from 'cloudflare:workers';
export async function GET() {
  const vars = env as unknown as Record<string, string | undefined>;
  return Response.json(
    { available: !!vars.DASHSCOPE_API_KEY, provider: 'qwen' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
