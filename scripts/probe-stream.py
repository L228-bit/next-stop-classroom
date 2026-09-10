import json, urllib.request, time, base64
from pathlib import Path
v=dict(line.split('=',1) for line in Path('.dev.vars').read_text().splitlines() if '=' in line and not line.startswith('#'))
for speaker in ['TTS_VOICE_NARRATOR','TTS_VOICE_CHEN']:
 model=v['TTS_CLONE_MODEL'] if speaker.endswith('CHEN') else 'qwen3-tts-flash'
 req=urllib.request.Request(v['TTS_BASE_URL'].rstrip('/')+'/services/aigc/multimodal-generation/generation',data=json.dumps({'model':model,'input':{'text':'先别着急，把你的想法说完，我们一起看看。','voice':v[speaker],'language_type':'Chinese'}}).encode(),headers={'Authorization':'Bearer '+v['DASHSCOPE_API_KEY'],'Content-Type':'application/json','X-DashScope-SSE':'enable'})
 start=time.monotonic();n=0
 with urllib.request.urlopen(req,timeout=40) as r:
  for line in r:
   if line.startswith(b'data:'):
    d=json.loads(line[5:]);a=d.get('output',{}).get('audio',{}).get('data')
    if a:
     n+=1
     if n==1: print(speaker,'first audio',round(time.monotonic()-start,2),'seconds','prefix',base64.b64decode(a)[:12].hex(),flush=True)
 print('chunks',n,'total',round(time.monotonic()-start,2),flush=True)
