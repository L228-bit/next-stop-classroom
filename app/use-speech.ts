'use client';
import {useEffect,useRef,useState} from 'react';
import {SpeechPlayback,type SpeechStatus} from '@/lib/speech-playback';
import {StreamPlayback} from '@/lib/stream-playback';
export const speechSettingKey='next-stop-classroom-speech-muted';
export function useSpeech(text:string,speaker:string,enabled:boolean,age?:number,assetPath?:string,dynamic=false,paused=false){
  const [progress,setProgress]=useState<number|undefined>();
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
    window.addEventListener('pointerdown',unlock);window.addEventListener('touchend',unlock);window.addEventListener('click',unlock);window.addEventListener('keydown',unlock);
    const preferences=()=>{try{player.current?.rate(Math.min(2.5,Math.max(.5,Number(localStorage.getItem('vn-speech-rate'))||1)));setMuted(localStorage.getItem(speechSettingKey)==='true');}catch{}};window.addEventListener('vn-preferences',preferences);
    setReady(true);return()=>{window.removeEventListener('vn-preferences',preferences);window.removeEventListener('pointerdown',unlock);window.removeEventListener('touchend',unlock);window.removeEventListener('click',unlock);window.removeEventListener('keydown',unlock);stream.current?.clear();stream.current=null;player.current?.clear();player.current=null;};
  },[]);
  useEffect(()=>{if(ready){player.current?.setLine(enabled&&assetPath?{text,speaker,age,assetPath}:undefined,!muted);if(enabled&&dynamic&&!assetPath&&!muted&&text)void stream.current?.play({text,speaker,age});}return()=>{player.current?.stop();stream.current?.stop();};},[text,speaker,age,assetPath,dynamic,enabled,muted,ready]);
  useEffect(()=>{player.current?.pause(paused);stream.current?.pause(paused);},[paused]);
  useEffect(()=>{if(status!=='playing'){setProgress(status==='ready'?1:undefined);return;}const timer=setInterval(()=>setProgress(dynamic?stream.current?.progress():player.current?.progress()),40);return()=>clearInterval(timer);},[status,dynamic]);
  function toggle(){setMuted(value=>{try{localStorage.setItem(speechSettingKey,String(!value));}catch{/* optional preference */}return !value;});}
  return {status,progress,muted,compatible:()=>{if(dynamic)void stream.current?.play({text,speaker,age},true);},toggle,replay:()=>{stream.current?.unlock();if(muted)toggle();else if(dynamic&&!assetPath)void stream.current?.play({text,speaker,age});else void player.current?.play();},clear:()=>{player.current?.clear();stream.current?.clear();setMuted(false);try{localStorage.removeItem(speechSettingKey);}catch{/* reset still works */}}};
}
