import type {SpeechInput} from './tts';
import type {SpeechStatus} from './speech-playback';
// The first provider chunk contains a WAV header; subsequent chunks are PCM.
export class StreamPlayback {
 private began=0;private duration=0;private paused=false;private context?:AudioContext;private abort?:AbortController;private sources=new Set<AudioBufferSourceNode>();private generation=0;
 private cache=new Map<string,Uint8Array[]>();
 constructor(private update:(status:SpeechStatus)=>void){}
 progress(){return this.context&&this.duration?Math.min(1,Math.max(0,(this.context.currentTime-this.began)/this.duration)):undefined;}
 pause(value:boolean){this.paused=value;if(this.context)void (value?this.context.suspend():this.context.resume());}
 unlock(){this.context??=new AudioContext();if(!this.paused)void this.context.resume();}
 stop(){this.generation++;this.abort?.abort();for(const s of this.sources){s.onended=null;s.stop();}this.sources.clear();}
 clear(){this.stop();this.cache.clear();void this.context?.close();this.context=undefined;}
 async play(input:SpeechInput){
  this.stop();const generation=this.generation;this.abort=new AbortController();const signal=this.abort.signal;
  this.began=0;this.duration=0;this.update('loading');
  try{
   this.unlock();const context=this.context!;await context.resume();if(generation!==this.generation)return;
   if(context.state!=='running'){this.update('blocked');return;}
   let pending=new Uint8Array(0),header=false,nextTime=context.currentTime+.06,received=false,complete=false;
   const schedule=(chunk:Uint8Array)=>{
    const combined=new Uint8Array(pending.length+chunk.length);combined.set(pending);combined.set(chunk,pending.length);pending=combined;
    if(!header){if(pending.length<12)return;if(new TextDecoder().decode(pending.slice(0,4))!=='RIFF')throw new Error('无效音频');let offset=12;while(offset+8<=pending.length){const size=new DataView(pending.buffer).getUint32(offset+4,true);if(new TextDecoder().decode(pending.slice(offset,offset+4))==='data'){pending=pending.slice(offset+8);header=true;break;}offset+=8+size+(size%2);}if(!header)return;}
    const samples=Math.floor(pending.length/2);if(!samples)return;
    const buffer=context.createBuffer(1,samples,24000),floats=buffer.getChannelData(0),view=new DataView(pending.buffer,pending.byteOffset);
    for(let i=0;i<samples;i++)floats[i]=view.getInt16(i*2,true)/32768;
    pending=pending.slice(samples*2);const source=context.createBufferSource();source.buffer=buffer;source.playbackRate.value=input.speaker==='旁白'?1.15:1;const gain=context.createGain();try{gain.gain.value=Number(localStorage.getItem('vn-volume')??1);}catch{}source.connect(gain);gain.connect(context.destination);this.sources.add(source);
    source.onended=()=>{this.sources.delete(source);source.disconnect();if(complete&&!this.sources.size&&generation===this.generation)this.update('ready');};
    nextTime=Math.max(nextTime,context.currentTime+.02);if(!received){this.began=nextTime;this.duration=input.text.length*.16;}source.start(nextTime);nextTime+=buffer.duration/source.playbackRate.value;received=true;this.update('playing');
   };
   const key=JSON.stringify(input),cached=this.cache.get(key),chunks:Uint8Array[]=[];
   if(cached)cached.forEach(schedule);else{
    const response=await fetch('/api/tts-stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.any([signal,AbortSignal.timeout(60000)])});
    if(!response.ok||!response.body)throw new Error('语音暂未送达');const reader=response.body.getReader();
    try{while(true){const {value,done}=await reader.read();if(generation!==this.generation)return;if(done)break;chunks.push(value);schedule(value);}}finally{await reader.cancel().catch(()=>{});}
    if(!received)throw new Error('没有收到音频');this.cache.set(key,chunks);if(this.cache.size>24)this.cache.delete(this.cache.keys().next().value!);
   }
   this.duration=nextTime-this.began;complete=true;if(!this.sources.size)this.update('ready');
  }catch(error){if(generation===this.generation){this.stop();this.update(error instanceof Error&&error.name==='NotAllowedError'?'blocked':'error');}}
 }
}
