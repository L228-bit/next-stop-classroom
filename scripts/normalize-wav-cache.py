"""Rewrap cached PCM audio with the standard 44-byte WAVE header used by the client checks."""
import io, json, pathlib, wave

manifest = json.loads(pathlib.Path('public/audio/manifest.json').read_text())
for index, item in enumerate(manifest['items'], 1):
    path = pathlib.Path(item['path'][1:])
    with wave.open(str(path), 'rb') as source:
        params = source.getparams()
        if (params.nchannels, params.sampwidth, params.framerate) != (1, 2, 24000):
            raise ValueError(f'{path} is not mono 24 kHz PCM')
        frames = source.readframes(source.getnframes())
    output = io.BytesIO()
    with wave.open(output, 'wb') as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(24000)
        target.writeframes(frames)
    path.write_bytes(output.getvalue())
    if index % 50 == 0:
        print(f'{index}/{len(manifest["items"])} normalized', flush=True)
print(f'normalized {len(manifest["items"])} WAV files')
