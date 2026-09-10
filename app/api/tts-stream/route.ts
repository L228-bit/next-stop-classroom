import {env} from 'cloudflare:workers';
import {localPost,apiJson} from '@/lib/local-api';
import {validateSpeech,voiceFor} from '@/lib/tts';
import {audioEvents} from '@/lib/tts-stream';
export const POST=localPost(validateSpeech,async(input,request)=>{
 const vars=env as unknown as Record<string,string|undefined>;
 if(!vars.DASHSCOPE_API_KEY)return apiJson({error:'语音暂未连接'},503);
 const abort=new AbortController();const signal=AbortSignal.any([request.signal,abort.signal,AbortSignal.timeout(60000)]);
 const {model,voice}=voiceFor(input.speaker,vars,input.age);
 const response=await fetch(`${(vars.TTS_BASE_URL||'https://dashscope.aliyuncs.com/api/v1').replace(/\/$/,'')}/services/aigc/multimodal-generation/generation`,{method:'POST',headers:{Authorization:`Bearer ${vars.DASHSCOPE_API_KEY}`,'Content-Type':'application/json','X-DashScope-SSE':'enable'},body:JSON.stringify({model,input:{text:input.text,voice,language_type:'Chinese'}}),signal});
 if(!response.ok||!response.body)return apiJson({error:'语音服务暂时不可用'},502);
 const events=audioEvents(response.body);let bytes=0;
 return new Response(new ReadableStream<Uint8Array>({
  async pull(controller){try{const next=await events.next();if(next.done){controller.close();return;}bytes+=next.value.length;if(bytes>8_000_000)throw new Error('语音过长');controller.enqueue(next.value);}catch(error){abort.abort();controller.error(error);}},
  async cancel(){abort.abort();await events.return(undefined);}
 }),{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
});
