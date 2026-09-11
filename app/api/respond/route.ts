import { env } from 'cloudflare:workers';
import { validateAIInput, resolveAIResult, buildMessages } from '../../../lib/ai';
import {dashScopeKey} from '@/lib/local-api';
let windowStart = 0;
let requests = 0;
let running = 0;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    origin !== url.origin
  )
    return json({ error: '仅接受本机游戏页面的请求' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return json({ error: '无效请求格式' }, 415);
  const vars = env as unknown as Record<string, string | undefined>;
  const apiKey=dashScopeKey(request,vars);
  if (!apiKey)
    return json({ error: '请先在设置中填写阿里云百炼 API Key，或使用右侧选项继续。' }, 503);
  if (Number(request.headers.get('content-length') || 0) > 20000)
    return json({ error: '输入过长' }, 413);
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return json({ error: '输入过长' }, 413);
    input = validateAIInput(JSON.parse(raw));
  } catch {
    return json({ error: '输入格式无效' }, 400);
  }
  if (!input) return json({ error: '输入格式无效' }, 400);
  const now = Date.now();
  if (now - windowStart > 60000) {
    windowStart = now;
    requests = 0;
  }
  if (requests >= 10 || running >= 2)
    return json({ error: '请稍等片刻再试' }, 429);
  requests++;
  running++;
  try {
    const response = await fetch(`${(vars.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: vars.QWEN_MODEL || 'qwen3.8-flash',
        messages: buildMessages(input),
        enable_thinking: false,
        response_format: { type: 'json_object' },
        max_tokens: 512,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      return json({ error: 'AI 暂时不可用，请稍后重试或使用右侧选项' }, 502);
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const result = resolveAIResult(data.choices?.[0]?.message?.content ?? '', input);
    return json(result);
  } catch {
    return json({ error: '连接超时，请稍后重试或使用右侧选项' }, 504);
  } finally {
    running--;
  }
}
