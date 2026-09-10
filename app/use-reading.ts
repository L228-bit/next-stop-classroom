'use client';
import {useEffect,useRef,useState} from 'react';
import {createReader} from '@/lib/reading';
export function useReducedMotion() {
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>setReduced(q.matches);sync();q.addEventListener('change',sync);return()=>q.removeEventListener('change',sync);},[]);
  return reduced;
}
export function useReading(text:string,id:string,enabled:boolean,instant:boolean,paused:boolean) {
  const [view,setView]=useState({id:'',count:0,done:false});
  const current=useRef<{id:string;reader:ReturnType<typeof createReader>}|null>(null);
  useEffect(()=>{
    if(!enabled){current.current=null;return;}
    const reader=createReader(text,(count,done)=>setView({id,count,done}),instant);
    current.current={id,reader};
    return()=>{reader.cancel();current.current=null;};
  },[text,id,enabled,instant]);
  useEffect(()=>{current.current?.reader.pause(paused);},[paused,id,enabled,instant]);
  return {visible:Array.from(text).slice(0,view.id===id?view.count:0).join(''),done:view.id===id&&view.done,advance:()=>current.current?.id===id&&current.current.reader.advance()};
}
