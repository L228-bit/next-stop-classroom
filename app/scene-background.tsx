'use client';
import {useEffect,useState} from 'react';
export default function SceneBackground({image,label}:{image:string;label?:string}) {
  const [layers,setLayers]=useState({current:image,previous:'',changing:false});
  useEffect(()=>{
    setLayers(old=>old.current===image?old:{current:image,previous:old.current,changing:true});
  },[image]);
  useEffect(()=>{
    if(!layers.changing)return;
    const timer=setTimeout(()=>setLayers(old=>({...old,previous:'',changing:false})),800);
    return()=>clearTimeout(timer);
  },[layers.current,layers.changing]);
  return <div className="vn-background-stack" role={label?'img':undefined} aria-label={label}>
    {layers.previous&&<div className="vn-background" style={{backgroundImage:`url(/art/${layers.previous}.png)`}}/>}
    <div key={layers.current} className={`vn-background ${layers.changing?'vn-scene-enter':''}`} style={{backgroundImage:`url(/art/${layers.current}.png)`}}/>
  </div>;
}
