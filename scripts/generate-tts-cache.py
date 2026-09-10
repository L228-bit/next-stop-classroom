"""Generate each annotated speech span and join them into game paragraphs."""
import concurrent.futures, io, json, os, pathlib, time, urllib.request, urllib.error, wave

root=pathlib.Path('public/audio')
story=json.loads(pathlib.Path('lib/story-v4.json').read_text())
direction=json.loads(pathlib.Path('lib/story-v4-direction.json').read_text())
parts=json.loads(pathlib.Path('lib/speech-parts.json').read_text())
for line in pathlib.Path('.dev.vars').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        key,value=line.split('=',1);os.environ.setdefault(key,value.strip().strip('"'))
base=os.environ['TTS_BASE_URL'].rstrip('/')+'/services/aigc/multimodal-generation/generation'
clone_model=os.environ['TTS_CLONE_MODEL']
system_model='qwen3-tts-flash'
clones={'陈应':os.environ['TTS_VOICE_CHEN'],'徐进':os.environ['TTS_VOICE_XU'],'吴国平':os.environ['TTS_VOICE_WU']}
voices={**clones,'旁白':os.environ.get('TTS_VOICE_NARRATOR','Chelsie'),'你':'Ethan','张龙':'Kai','笑笑':'Serena','家长':'Cherry','学生':'Ethan','同桌':'Ethan','孩子':'Ethan','小孩':'Ethan'}

def request(part):
    payload=json.dumps({'model':part['model'],'input':{'text':part['text'],'voice':part['voice'],'language_type':'Chinese'}},ensure_ascii=False).encode()
    req=urllib.request.Request(base,data=payload,headers={'Authorization':f"Bearer {os.environ['DASHSCOPE_API_KEY']}",'Content-Type':'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req,timeout=60) as response:data=json.load(response)
            with urllib.request.urlopen(data['output']['audio']['url'].replace('http:','https:',1),timeout=60) as response:audio=bytearray(response.read())
            if audio[:4]!=b'RIFF' or audio[8:12]!=b'WAVE' or audio[36:40]!=b'data':raise ValueError('unexpected WAV layout')
            audio[4:8]=(len(audio)-8).to_bytes(4,'little');audio[40:44]=(len(audio)-44).to_bytes(4,'little')
            with wave.open(io.BytesIO(audio)) as clip:
                if (clip.getnchannels(),clip.getsampwidth(),clip.getframerate())!=(1,2,24000):raise ValueError('expected mono 24kHz PCM16')
                return clip.readframes(clip.getnframes())
        except urllib.error.HTTPError as error:
            if error.code not in (429,500,502,503,504) or attempt==3:raise
        time.sleep(2**attempt)

items=[]
for chapter in story:
    for segment,lines in [('intro',chapter['intro']),*[(c['id'],c['lines']) for c in chapter['choices']],('common',chapter['common'])]:
        for line,text in enumerate(lines):
            key=f"{chapter['id']}/{segment}/{line:03d}"
            spans=[]
            for span in parts[key]:
                speaker=span['speaker'];spans.append({**span,'voice':voices[speaker],'model':clone_model if speaker in clones else system_model})
            items.append({'chapter':chapter['id'],'segment':segment,'line':line,'text':text,'speaker':direction[chapter['id']][segment][line]['speaker'],'parts':spans,'path':f'/{root}/{key}.wav'})

def generate(item):
    try:
        pcm=bytearray();rendered=[]
        for span in item['parts']:
            start=len(pcm)/48000;pcm.extend(request(span));rendered.append({**span,'start':start,'end':len(pcm)/48000})
        buffer=io.BytesIO()
        with wave.open(buffer,'wb') as clip:clip.setnchannels(1);clip.setsampwidth(2);clip.setframerate(24000);clip.writeframes(pcm)
        path=pathlib.Path(item['path'][1:]);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(buffer.getvalue())
        return {**item,'parts':rendered,'status':'generated','bytes':len(buffer.getvalue())}
    except Exception as error:return {**item,'status':'error','error':f'{type(error).__name__}: {str(error)[:180]}'}

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
    results=[]
    for n,result in enumerate(executor.map(generate,items),1):
        results.append(result)
        if n%10==0:print(f'{n}/{len(items)} processed; errors={sum(x["status"]=="error" for x in results)}',flush=True)
errors=[x for x in results if x['status']=='error']
manifest={'clone_model':clone_model,'system_model':system_model,'generated_at':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'items':results}
(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'DONE {len(results)-len(errors)}/{len(results)} paragraphs, {sum(len(x["parts"]) for x in results if x["status"]!="error")} voice parts',flush=True)
for item in errors:print(item['path'],item['error'],flush=True)
if errors:raise SystemExit(1)
