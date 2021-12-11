import Speaker from 'speaker';
var speaker = new Speaker({
    channels: 1,          // 1 channel
    bitDepth: 32,         // 32-bit samples
    sampleRate: 8000,     // 48,000 Hz sample rate
    float: true,
  });

  import { readFileSync, promises } from 'fs';
  speaker.write(readFileSync('./audio.raw'))