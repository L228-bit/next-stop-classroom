export const readingDelay = (character:string) => /[。！？!?…]/u.test(character)?260:/[，、,；;：:]/u.test(character)?120:35;
type Clock = {set:(fn:()=>void,ms:number)=>unknown;clear:(id:unknown)=>void;now:()=>number};
const clock:Clock={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id as ReturnType<typeof setTimeout>),now:()=>Date.now()};
export function createReader(text:string, update:(count:number,done:boolean)=>void, instant=false, time:Clock=clock) {
  const characters=Array.from(text);
  let count=instant?characters.length:0, done=instant||!characters.length, stopped=false, paused=false;
  let timer:unknown, allowedAt=0;
  function schedule() {
    if(stopped||paused||done)return;
    timer=time.set(()=>{
      if(stopped||paused)return;
      if(count===characters.length){done=true;update(count,true);return;}
      count++;update(count,false);schedule();
    },count?readingDelay(characters[count-1]):35);
  }
  update(count,done);schedule();
  return {
    finish(){time.clear(timer);count=characters.length;done=true;update(count,true);},
    advance(){
      if(stopped||paused||time.now()<allowedAt)return false;
      if(!done){this.finish();allowedAt=time.now()+180;return false;}
      allowedAt=time.now()+180;return true;
    },
    pause(value:boolean){paused=value;time.clear(timer);if(!value)schedule();},
    cancel(){stopped=true;time.clear(timer);},
  };
}
