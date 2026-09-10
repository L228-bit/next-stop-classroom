'use client';
import {useEffect,useState} from 'react';
import {endingFingerprint,parseEnding,type GeneratedEnding} from '@/lib/v4-ending';
import type {Progress} from '@/lib/v4-flow';
export function useEnding(g:Progress,active:boolean,save:(ending:GeneratedEnding)=>void){
  const fingerprint=endingFingerprint(g);
  const cached=g.generatedEnding?.fingerprint===fingerprint?g.generatedEnding.text:undefined;
  const [retry,setRetry]=useState(0);
  const [result,setResult]=useState<{key:string;status:'loading'|'error'}>();
  const [fallback,setFallback]=useState('');
  // A stable request payload avoids restarting a request on every line of the recollection.
  const payload=JSON.stringify({picks:g.picks,answers:g.answers});
  useEffect(()=>{
    if(!active||cached)return;
    const controller=new AbortController();
    setResult({key:fingerprint,status:'loading'});
    fetch('/api/ending',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])})
      .then(async response=>{const data=await response.json() as GeneratedEnding;if(!response.ok||data.fingerprint!==fingerprint||!parseEnding(JSON.stringify(data)))throw new Error('ending unavailable');if(!controller.signal.aborted)save(data);})
      .catch(()=>{if(!controller.signal.aborted){setResult({key:fingerprint,status:'error'});setFallback(fingerprint);}});
    return()=>controller.abort();
  // save only attaches a result if the current record fingerprint still matches.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[active,cached,fingerprint,payload,retry]);
  return {text:cached,status:cached?'ready':result?.key===fingerprint?result.status:'loading',fallback:fallback===fingerprint,useOriginal:()=>setFallback(fingerprint),retry:()=>{setFallback('');setRetry(n=>n+1);},clear:()=>{setFallback('');setResult(undefined);}};
}
