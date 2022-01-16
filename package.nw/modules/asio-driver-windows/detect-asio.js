var portAudio = require('naudiodon');

console.log(portAudio.getDevices());
console.log(portAudio.getHostAPIs());

var ao = new portAudio.AudioOutput({
    channelCount: 2,
    sampleFormat: portAudio.SampleFormat16Bit,
    sampleRate: 48000,
    deviceId : -1 // Use -1 or omit the deviceId to select the default device
  });

