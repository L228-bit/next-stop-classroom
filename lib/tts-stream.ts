// Incremental SSE parsing: transport chunks can split JSON or UTF-8 characters.
export async function* audioEvents(body:ReadableStream<Uint8Array>){
 const reader=body.getReader(),decoder=new TextDecoder();let pending='';
 try {while(true){const {value,done}=await reader.read();pending+=decoder.decode(value,{stream:!done});let end;
  while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end).trim();pending=pending.slice(end+1);if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')continue;const data=JSON.parse(raw);if(data.code||data.status_code>=400)throw new Error('语音服务返回错误');const audio=data.output?.audio?.data;if(audio)yield Uint8Array.from(atob(audio),c=>c.charCodeAt(0));}
  if(done)break;
 }}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
