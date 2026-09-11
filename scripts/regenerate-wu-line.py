import json,urllib.request,io,wave
from pathlib import Path
v=dict(line.split('=',1) for line in Path('.dev.vars').read_text().splitlines() if '=' in line and not line.startswith('#'))
m=json.loads(Path('public/audio/manifest.json').read_text());item=next(x for x in m['items'] if '给她太大压力' in x['text']);text=item['text'].replace('给她太大压力','别给她太大压力')
req=urllib.request.Request(v['TTS_BASE_URL'].rstrip('/')+'/services/aigc/multimodal-generation/generation',data=json.dumps({'model':v['TTS_CLONE_MODEL'],'input':{'text':text,'voice':v['TTS_VOICE_WU'],'language_type':'Chinese'}}).encode(),headers={'Authorization':'Bearer '+v['DASHSCOPE_API_KEY'],'Content-Type':'application/json'})
with urllib.request.urlopen(req,timeout=60) as r:data=json.load(r)
with urllib.request.urlopen(data['output']['audio']['url'].replace('http:','https:',1),timeout=60) as r:audio=bytearray(r.read())
audio[4:8]=(len(audio)-8).to_bytes(4,'little');audio[40:44]=(len(audio)-44).to_bytes(4,'little')
with wave.open(io.BytesIO(audio)) as w: duration=w.getnframes()/w.getframerate();assert (w.getnchannels(),w.getsampwidth(),w.getframerate())==(1,2,24000)
Path(item['path'][1:]).write_bytes(audio);item['text']=text;item['bytes']=len(audio);item['parts'][0].update(text=text,start=0,end=duration)
Path('public/audio/manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print(item['path'],round(duration,2),'seconds')
