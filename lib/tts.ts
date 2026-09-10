import { allowedSpeakers } from './ai';
export type SpeechInput={text:string;speaker:string;age?:number;assetPath?:string};
export function validateSpeech(value:unknown):SpeechInput|null {
  if(!value||typeof value!=='object')return null;
  const v=value as SpeechInput;
  return typeof v.text==='string'&&!!v.text.trim()&&v.text.length<=400&&allowedSpeakers.includes(v.speaker)&&(v.age===undefined||Number.isInteger(v.age)&&v.age>=0&&v.age<=100)?{text:v.text.trim(),speaker:v.speaker,age:v.age}:null;
}
const voiceKeys:Record<string,string>={'陈应':'TTS_VOICE_CHEN','徐进':'TTS_VOICE_XU','吴国平':'TTS_VOICE_WU','旁白':'TTS_VOICE_NARRATOR','你':'TTS_VOICE_PLAYER','张龙':'TTS_VOICE_ZHANGLONG','笑笑':'TTS_VOICE_XIAOXIAO'};
export function voiceFor(speaker:string,vars:Record<string,string|undefined>,age?:number) {
  const configured=vars[voiceKeys[speaker]];
  if(configured && ['陈应','徐进','吴国平'].includes(speaker))return {model:vars.TTS_CLONE_MODEL||'qwen3-tts-vc-2026-01-22',voice:configured};
  if(configured)return {model:vars.TTS_SYSTEM_MODEL||vars.TTS_MODEL||'qwen3-tts-flash',voice:configured};
  const female=['旁白','笑笑','家长'].includes(speaker);
  const ageVoice=age!==undefined?(age<18?vars.TTS_CHILD_VOICE:age>=55?vars.TTS_OLD_VOICE:vars.TTS_ADULT_VOICE):undefined;
  return {model:vars.TTS_MODEL||'qwen3-tts-flash',voice:ageVoice||(female?vars.TTS_FEMALE_VOICE:vars.TTS_MALE_VOICE)||(female?'Cherry':'Ethan')};
}
export function safeAudioURL(raw:string):URL|null {
  try {const url=new URL(raw);if(!['http:','https:'].includes(url.protocol)||!/^dashscope-result-[a-z0-9-]+\.oss-[a-z0-9-]+\.aliyuncs\.com$/.test(url.hostname)||url.username||url.password||url.port)return null;url.protocol='https:';return url;}catch{return null;}
}
