'use client';
import {useEffect,useRef,useState} from 'react';
import {SpeechPlayback,type SpeechStatus} from '@/lib/speech-playback';
import {StreamPlayback} from '@/lib/stream-playback';
export const speechSettingKey='next-stop-classroom-speech-muted';
export function useSpeech(text:string,speaker:string,enabled:boolean,age?:number,assetPath?:string,dynamic=false){
  const [status,setStatus]=useState<SpeechStatus>('idle');
  const [muted,setMuted]=useState(false);
  const [ready,setReady]=useState(false);
  const player=useRef<SpeechPlayback|null>(null);
  const stream=useRef<StreamPlayback|null>(null);
  useEffect(()=>{
    try{setMuted(localStorage.getItem(speechSettingKey)==='true');}catch{/* optional preference */}
    player.current=new SpeechPlayback({
      update:setStatus,url:blob=>URL.createObjectURL(blob),revoke:url=>URL.revokeObjectURL(url),audio:url=>new Audio(url),
      fetchClip:async(input,signal)=>{if(!input.assetPath)throw new Error('固定语音文件缺失');const response=await fetch(input.assetPath,{signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});if(!response.ok)throw new Error('语音暂未送达');return response.blob();},
    });
    stream.current=new StreamPlayback(setStatus);
    const unlock=()=>stream.current?.unlock();
    window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);
    setReady(true);return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);stream.current?.clear();stream.current=null;player.current?.clear();player.current=null;};
  },[]);
  useEffect(()=>{if(ready){player.current?.setLine(enabled&&assetPath?{text,speaker,age,assetPath}:undefined,!muted);if(enabled&&dynamic&&!assetPath&&!muted&&text)void stream.current?.play({text,speaker,age});}return()=>{player.current?.stop();stream.current?.stop();};},[text,speaker,age,assetPath,dynamic,enabled,muted,ready]);
  function toggle(){setMuted(value=>{try{localStorage.setItem(speechSettingKey,String(!value));}catch{/* optional preference */}return !value;});}
  return {status,muted,toggle,replay:()=>{if(muted)toggle();else if(dynamic&&!assetPath)void stream.current?.play({text,speaker,age});else void player.current?.play();},clear:()=>{player.current?.clear();stream.current?.clear();setMuted(false);try{localStorage.removeItem(speechSettingKey);}catch{/* reset still works */}}};
}
