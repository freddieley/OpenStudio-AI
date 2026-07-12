import { AudioWaveform } from 'lucide-react';

export default function VoiceStudio() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-studio-text-muted">
      <AudioWaveform className="w-16 h-16 opacity-20" />
      <h2 className="text-lg font-semibold text-studio-text">Voice Studio</h2>
      <p className="text-sm max-w-sm text-center">
        Speech recognition, text-to-speech, and voice cloning. Install Whisper or 
        a TTS model in Model Manager to begin working with audio.
      </p>
    </div>
  );
}
