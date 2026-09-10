import { env } from 'cloudflare:workers';
import { localPost, apiJson } from '../../../lib/local-api';
import { validateSpeech, voiceFor, safeAudioURL } from '../../../lib/tts';
export const POST=localPost(validateSpeech,async(input,request)=>{
  const vars=env as unknown as Record<string,string|undefined>;
  if(!vars.DASHSCOPE_API_KEY)return apiJson({error:'语音暂未连接，仍可继续阅读。'},503);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);
  const {model,voice}=voiceFor(input.speaker,vars,input.age);
  const response=await fetch(`${(vars.TTS_BASE_URL||'https://dashscope.aliyuncs.com/api/v1').replace(/\/$/,'')}/services/aigc/multimodal-generation/generation`,{
    method:'POST',headers:{Authorization:`Bearer ${vars.DASHSCOPE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:{text:input.text,voice,language_type:'Chinese'}}),signal,
  });
  if(!response.ok)return apiJson({error:'语音暂未生成，可以重试或继续阅读。'},502);
  const data=await response.json() as {output?:{audio?:{url?:string}}};
  const url=safeAudioURL(data.output?.audio?.url??'');
  if(!url)return apiJson({error:'语音暂未送达，可以继续阅读。'},502);
  // Only fetch the provider's audio object; credentials never reach the audio host or browser.
  const audio=await fetch(url,{signal,redirect:'error'});
  if(!audio.ok||Number(audio.headers.get('content-length'))>4_000_000)return apiJson({error:'语音暂未送达，可以继续阅读。'},502);
  const bytes=await audio.arrayBuffer();
  if(bytes.byteLength>4_000_000||new TextDecoder().decode(bytes.slice(0,4))!=='RIFF')return apiJson({error:'语音格式异常，可以继续阅读。'},502);
  return new Response(bytes,{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store'}});
});
