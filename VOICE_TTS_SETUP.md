# Custom Voice TTS Setup

The UI now supports two voice output paths:

1. Browser fallback: built-in `speechSynthesis`, no setup required.
2. Custom TTS: `/api/tts` returns generated MP3 audio from ElevenLabs when credentials are configured.

## Reference Audio

The selected reference sample was copied to:

`ui/voice/nazli-reference.mp3`

This file is available from the running app at:

`/voice/nazli-reference.mp3`

## Required Environment Variables

Set these before starting `ui/server.js`:

```powershell
$env:ELEVENLABS_API_KEY = "your_api_key"
$env:ELEVENLABS_VOICE_ID = "your_voice_id"
$env:ELEVENLABS_MODEL_ID = "eleven_multilingual_v2"
node ui/server.js
```

Optional tuning:

```powershell
$env:ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128"
$env:ELEVENLABS_STABILITY = "0.5"
$env:ELEVENLABS_SIMILARITY_BOOST = "0.78"
$env:ELEVENLABS_STYLE = "0.12"
$env:ELEVENLABS_SPEAKER_BOOST = "true"
```

## Runtime Behavior

- Voice conversation first calls `/api/tts`.
- If custom TTS is configured and succeeds, the app plays the returned MP3.
- If credentials are missing or the provider fails, it falls back to browser speech synthesis.
- STT remains browser-based for low latency.

