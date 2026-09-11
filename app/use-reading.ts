'use client';
import {useEffect,useRef,useState} from 'react';
import {createReader} from '@/lib/reading';
export function useReducedMotion() {
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>setReduced(q.matches);sync();q.addEventListener('change',sync);return()=>q.removeEventListener('change',sync);},[]);
  return reduced;
}
export function useReading(text:string,id:string,enabled:boolean,instant:boolean,paused:boolean,audioProgress?:number) {
  const [speed,setSpeed]=useState(1);
  useEffect(()=>{const sync=()=>{try{setSpeed(Number(localStorage.getItem('vn-text-speed'))||1);}catch{}};sync();window.addEventListener('vn-preferences',sync);return()=>window.removeEventListener('vn-preferences',sync);},[]);
  const [view,setView]=useState({id:'',count:0,done:false});
  const current=useRef<{id:string;reader:ReturnType<typeof createReader>}|null>(null);
  useEffect(()=>{
    if(!enabled){current.current=null;return;}
    const reader=createReader(text,(count,done)=>setView({id,count,done}),instant,{set:(fn,ms)=>setTimeout(fn,ms/speed),clear:id=>clearTimeout(id as ReturnType<typeof setTimeout>),now:()=>Date.now()});
    current.current={id,reader};
    return()=>{reader.cancel();current.current=null;};
  },[text,id,enabled,instant,speed]);
  useEffect(()=>{current.current?.reader.pause(paused);},[paused,id,enabled,instant]);
  useEffect(()=>{if(audioProgress!==undefined&&!paused){current.current?.reader.progress(audioProgress);}else current.current?.reader.pause(paused);},[audioProgress,paused,id]);
  return {visible:Array.from(text).slice(0,view.id===id?view.count:0).join(''),done:view.id===id&&view.done,advance:()=>current.current?.id===id&&current.current.reader.advance()};
}
