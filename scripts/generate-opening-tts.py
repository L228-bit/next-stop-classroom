"""Generate the two opening-card narrator clips and add them to the local manifest."""
import io, json, os, pathlib, time, urllib.request, wave

root = pathlib.Path('public/audio')
for line in pathlib.Path('.dev.vars').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        key, value = line.split('=', 1)
        os.environ.setdefault(key, value.strip().strip('"'))

endpoint = os.environ['TTS_BASE_URL'].rstrip('/') + '/services/aigc/multimodal-generation/generation'
voice = os.environ.get('TTS_VOICE_NARRATOR', 'Chelsie')
opening = ['你，22 岁。新手高中物理老师。', '这是你的师傅，陈应。']

def synthesize(text: str) -> bytes:
    payload = json.dumps({'model':'qwen3-tts-flash','input':{'text':text,'voice':voice,'language_type':'Chinese'}}, ensure_ascii=False).encode()
    request = urllib.request.Request(endpoint, data=payload, headers={'Authorization':f"Bearer {os.environ['DASHSCOPE_API_KEY']}",'Content-Type':'application/json'})
    with urllib.request.urlopen(request, timeout=60) as response:
        result = json.load(response)
    with urllib.request.urlopen(result['output']['audio']['url'].replace('http:', 'https:', 1), timeout=60) as response:
        audio = bytearray(response.read())
    if audio[:4] != b'RIFF' or audio[8:12] != b'WAVE' or audio[36:40] != b'data':
        raise ValueError('TTS did not return a PCM WAV clip')
    audio[4:8] = (len(audio) - 8).to_bytes(4, 'little')
    audio[40:44] = (len(audio) - 44).to_bytes(4, 'little')
    with wave.open(io.BytesIO(audio)) as clip:
        if (clip.getnchannels(), clip.getsampwidth(), clip.getframerate()) != (1, 2, 24000):
            raise ValueError('expected mono 24 kHz PCM')
        return bytes(audio)

manifest_path = root / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['items'] = [item for item in manifest['items'] if item.get('segment') != 'opening']
for index, text in enumerate(opening):
    audio = synthesize(text)
    target = root / 'opening' / f'{index:03d}.wav'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(audio)
    with wave.open(io.BytesIO(audio)) as clip:
        duration = clip.getnframes() / clip.getframerate()
    manifest['items'].append({'chapter':'00','segment':'opening','line':index,'text':text,'speaker':'旁白','parts':[{'speaker':'旁白','text':text,'voice':voice,'model':'qwen3-tts-flash','start':0,'end':duration}],'path':'/' + str(target),'status':'generated','bytes':len(audio)})
manifest['generated_at'] = time.strftime('%Y-%m-%dT%H:%M:%S%z')
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'generated {len(opening)} opening clips with {voice}')
