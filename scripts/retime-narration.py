"""Retain character speeds while accelerating every narrator span to 1.15x."""
import json, pathlib, subprocess, tempfile, wave

root = pathlib.Path('public/audio')
manifest_path = root / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
ffmpeg = '/opt/homebrew/bin/ffmpeg'

for number, item in enumerate(manifest['items'], 1):
    source = pathlib.Path(item['path'][1:])
    parts = item.get('parts', [])
    if not parts:
        continue
    filters, labels = [], []
    for index, part in enumerate(parts):
        label = f'p{index}'
        speed = 1.15 if part['speaker'] == '旁白' else 1.0
        filters.append(f'[0:a]atrim=start={part["start"]:.6f}:end={part["end"]:.6f},asetpts=PTS-STARTPTS' + (f',atempo={speed}' if speed != 1 else '') + f'[{label}]')
        labels.append(f'[{label}]')
    filters.append(''.join(labels) + f'concat=n={len(parts)}:v=0:a=1,aresample=24000[out]')
    with tempfile.NamedTemporaryFile(suffix='.wav', dir=source.parent, delete=False) as temp:
        target = pathlib.Path(temp.name)
    try:
        subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source), '-filter_complex', ';'.join(filters), '-map', '[out]', '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', str(target)], check=True)
        target.replace(source)
    finally:
        target.unlink(missing_ok=True)
    offset = 0.0
    with wave.open(str(source)) as output:
        if (output.getnchannels(), output.getsampwidth(), output.getframerate()) != (1, 2, 24000):
            raise ValueError(f'{source} is not mono 24 kHz PCM')
        total = output.getnframes() / output.getframerate()
    for part in parts:
        previous = part['end'] - part['start']
        duration = previous / 1.15 if part['speaker'] == '旁白' else previous
        part['start'], part['end'], part['speed'] = offset, offset + duration, 1.15 if part['speaker'] == '旁白' else 1.0
        offset += duration
    # Align the final metadata boundary with the actual PCM sample count.
    parts[-1]['end'] = total
    if number % 25 == 0:
        print(f'{number}/{len(manifest["items"])} retimed', flush=True)

manifest['narrator_speed'] = 1.15
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'retimed {len(manifest["items"])} WAV files; narrator speed is 1.15x')
