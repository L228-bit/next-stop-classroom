import { env } from 'cloudflare:workers';
import { localPost, apiJson } from '../../../lib/local-api';
import { validateEndingInput, endingFingerprint, endingMessages, parseEnding } from '../../../lib/v4-ending';
export const POST=localPost(validateEndingInput,async(input,request)=>{
  const vars=env as unknown as Record<string,string|undefined>;
  if(!vars.DASHSCOPE_API_KEY)return apiJson({error:'结尾暂未连接，可以阅读原稿结尾。'},503);
  const response=await fetch(`${(vars.DASHSCOPE_BASE_URL||'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/,'')}/chat/completions`,{
    method:'POST',headers:{Authorization:`Bearer ${vars.DASHSCOPE_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:vars.QWEN_MODEL||'qwen3.8-flash',messages:endingMessages(input),enable_thinking:false,response_format:{type:'json_object'},max_tokens:650,temperature:.7}),
    signal:AbortSignal.any([request.signal,AbortSignal.timeout(20000)]),
  });
  if(!response.ok)return apiJson({error:'结尾暂时没有写完，可以重试或阅读原稿结尾。'},502);
  const data=await response.json() as {choices?:{message?:{content?:string}}[]};
  const text=parseEnding(data.choices?.[0]?.message?.content??'');
  if(!text)return apiJson({error:'结尾暂时没有写完，可以重试或阅读原稿结尾。'},502);
  return apiJson({text,fingerprint:endingFingerprint(input)});
});
