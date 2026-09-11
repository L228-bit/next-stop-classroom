import type {SpeechInput} from './tts';
import type {SpeechStatus} from './speech-playback';
function streamApiHeaders(){
 const headers:Record<string,string>={'Content-Type':'application/json'};
 try{const key=localStorage.getItem('next-stop-classroom-dashscope-key')?.trim();if(key)headers['X-DashScope-Api-Key']=key;}catch{}
 return headers;
}
// The first provider chunk contains a WAV header; subsequent chunks are PCM.
export class StreamPlayback {
 private began=0;private duration=0;private paused=false;private context?:AudioContext;private abort?:AbortController;private sources=new Set<AudioBufferSourceNode>();private generation=0;
 private fallback?:HTMLAudioElement;private fallbackURL?:string;
 private cache=new Map<string,Uint8Array[]>();
 constructor(private update:(status:SpeechStatus)=>void){}
 progress(){return this.context&&this.duration?Math.min(1,Math.max(0,(this.context.currentTime-this.began)/this.duration)):undefined;}
 pause(value:boolean){this.paused=value;if(this.context)void (value?this.context.suspend():this.context.resume()).catch(()=>{});}
 unlock(){
  if(!this.context||this.context.state==='closed')this.context=new AudioContext();
  if(!this.paused)void this.context.resume().catch(()=>{});
 }
 private async prepare(){
  this.unlock();const context=this.context!;
  // Safari may leave resume pending indefinitely outside a user gesture.
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([context.resume(),new Promise<void>(resolve=>{timer=setTimeout(resolve,1200);})]);}finally{clearTimeout(timer);}
  return context;
 }
 stop(){this.generation++;if(this.fallback){this.fallback.pause();this.fallback.onended=null;this.fallback=undefined;}if(this.fallbackURL){URL.revokeObjectURL(this.fallbackURL);this.fallbackURL=undefined;}this.abort?.abort();for(const s of this.sources){s.onended=null;s.stop();}this.sources.clear();}
 clear(){this.stop();this.cache.clear();void this.context?.close();this.context=undefined;}
 async play(input:SpeechInput,compatible=false){
  this.stop();const generation=this.generation;this.abort=new AbortController();const signal=this.abort.signal;
  this.began=0;this.duration=0;this.update('loading');
  try{
   const context=await this.prepare();if(generation!==this.generation)return;
   compatible=compatible||context.state!=='running';
   if(this.paused)await context.suspend();
   let globalRate=1;try{globalRate=Math.min(2.5,Math.max(.5,Number(localStorage.getItem('vn-speech-rate'))||1));}catch{}
   let pending=new Uint8Array(0),header=false,nextTime=context.currentTime+.06,received=false,complete=false;
   const schedule=(chunk:Uint8Array)=>{
    const combined=new Uint8Array(pending.length+chunk.length);combined.set(pending);combined.set(chunk,pending.length);pending=combined;
    if(!header){if(pending.length<12)return;if(new TextDecoder().decode(pending.slice(0,4))!=='RIFF')throw new Error('无效音频');let offset=12;while(offset+8<=pending.length){const size=new DataView(pending.buffer).getUint32(offset+4,true);if(new TextDecoder().decode(pending.slice(offset,offset+4))==='data'){pending=pending.slice(offset+8);header=true;break;}offset+=8+size+(size%2);}if(!header)return;}
    const samples=Math.floor(pending.length/2);if(!samples)return;
    const buffer=context.createBuffer(1,samples,24000),floats=buffer.getChannelData(0),view=new DataView(pending.buffer,pending.byteOffset);
    for(let i=0;i<samples;i++)floats[i]=view.getInt16(i*2,true)/32768;
    pending=pending.slice(samples*2);const source=context.createBufferSource();source.buffer=buffer;source.playbackRate.value=(input.speaker==='旁白'?1.15:1)*globalRate;const gain=context.createGain();try{gain.gain.value=Number(localStorage.getItem('vn-volume')??1);}catch{}source.connect(gain);gain.connect(context.destination);this.sources.add(source);
    source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();if(complete&&!this.sources.size&&generation===this.generation)this.update('ready');};
    nextTime=Math.max(nextTime,context.currentTime+.02);if(!received){this.began=nextTime;this.duration=input.text.length*.16;}source.start(nextTime);nextTime+=buffer.duration/source.playbackRate.value;received=true;this.update('playing');
   };
   const key=JSON.stringify(input),cached=this.cache.get(key),chunks:Uint8Array[]=[];
   if(cached){if(!compatible)cached.forEach(schedule);}else{
    const response=await fetch('/api/tts-stream',{method:'POST',headers:streamApiHeaders(),body:JSON.stringify(input),signal:AbortSignal.any([signal,AbortSignal.timeout(60000)])});
    if(!response.ok||!response.body)throw new Error('语音暂未送达');const reader=response.body.getReader();
    try{while(true){const {value,done}=await reader.read();if(generation!==this.generation)return;if(done)break;chunks.push(value);if(!compatible)schedule(value);}}finally{await reader.cancel().catch(()=>{});}
    if(!chunks.length||(!compatible&&!received))throw new Error('没有收到音频');this.cache.set(key,chunks);if(this.cache.size>24)this.cache.delete(this.cache.keys().next().value!);
   }
   if(compatible){
    const parts=cached??chunks,bytes=new Uint8Array(parts.reduce((n,c)=>n+c.length,0));let offset=0;for(const c of parts){bytes.set(c,offset);offset+=c.length;}
    if(bytes.length<44)throw new Error('音频不完整');const view=new DataView(bytes.buffer);view.setUint32(4,bytes.length-8,true);
    for(let i=12;i+8<=bytes.length;){const size=view.getUint32(i+4,true);if(new TextDecoder().decode(bytes.slice(i,i+4))==='data'){view.setUint32(i+4,bytes.length-i-8,true);break;}i+=8+size+(size%2);}
    this.fallbackURL=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));const audio=new Audio(this.fallbackURL);this.fallback=audio;audio.playbackRate=(input.speaker==='旁白'?1.15:1)*globalRate;try{audio.volume=Number(localStorage.getItem('vn-volume')??1);}catch{}
    audio.onended=()=>{if(generation===this.generation)this.update('ready');};audio.onerror=()=>{if(generation===this.generation)this.update('error');};
    await audio.play();if(generation===this.generation)this.update('playing');return;
   }
   this.duration=nextTime-this.began;complete=true;if(!this.sources.size)this.update('ready');
  }catch(error){if(generation===this.generation){this.stop();this.update(error instanceof Error&&error.name==='NotAllowedError'?'blocked':'error');}}
 }
}
