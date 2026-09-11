import type { SpeechInput } from './tts';
export type SpeechStatus='idle'|'loading'|'playing'|'ready'|'blocked'|'error';
type Clip={play:()=>Promise<void>;pause:()=>void;currentTime:number;volume?:number;duration?:number;playbackRate?:number;onended:((event:Event)=>void)|null;onerror:((event:Event)=>void)|null};
type Dependencies={fetchClip:(input:SpeechInput,signal:AbortSignal)=>Promise<Blob>;url:(blob:Blob)=>string;revoke:(url:string)=>void;audio:(url:string)=>Clip;update:(status:SpeechStatus)=>void};
// A generation counter prevents an old network result from speaking in a new scene.
export class SpeechPlayback {
  private generation=0;
  private controller?:AbortController;
  private clip?:Clip;
  private input?:SpeechInput;
  private cache=new Map<string,string>();
  constructor(private deps:Dependencies){}
  stop(){this.generation++;this.controller?.abort();this.controller=undefined;if(this.clip){this.clip.onended=null;this.clip.onerror=null;this.clip.pause();this.clip=undefined;}}
  progress(){return this.clip?.duration?this.clip.currentTime/this.clip.duration:undefined;}
  pause(value:boolean){if(this.clip){if(value)this.clip.pause();else void this.clip.play().catch(()=>this.deps.update('blocked'));}}
  setLine(input?:SpeechInput,autoplay=true){this.stop();this.input=input;this.deps.update('idle');if(input&&autoplay)void this.play();}
  async play(){
    if(!this.input)return;
    this.stop();
    const generation=this.generation,input=this.input,key=JSON.stringify(input);
    const controller=new AbortController();this.controller=controller;
    this.deps.update('loading');
    try{
      let url=this.cache.get(key);
      if(!url){
        const blob=await this.deps.fetchClip(input,controller.signal);
        if(this.generation!==generation)return;
        url=this.deps.url(blob);this.cache.set(key,url);
        if(this.cache.size>12){const oldest=this.cache.keys().next().value!;this.deps.revoke(this.cache.get(oldest)!);this.cache.delete(oldest);}
      }
      if(this.generation!==generation)return;
      const clip=this.deps.audio(url);this.clip=clip;try{if(clip.volume!==undefined)clip.volume=Number(localStorage.getItem('vn-volume')??1);}catch{}
      // Cached files already contain the intended speaker speeds.
      if(clip.playbackRate!==undefined)clip.playbackRate=1;
      clip.onended=()=>{if(this.generation===generation)this.deps.update('ready');};
      clip.onerror=()=>{if(this.generation===generation)this.deps.update('error');};
      try{await clip.play();if(this.generation===generation)this.deps.update('playing');}
      catch(error){if(this.generation===generation)this.deps.update(error instanceof Error&&error.name==='NotAllowedError'?'blocked':'error');}
    }catch{if(this.generation===generation)this.deps.update('error');}
  }
  clear(){this.stop();this.input=undefined;for(const url of this.cache.values())this.deps.revoke(url);this.cache.clear();this.deps.update('idle');}
}
