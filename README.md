# poc-html5-interface-vbRichClient-WebServer
This is a PoC Implementation with the main goal to send audio back and forth between a windows APP and also remote control it.

## Use this
https://lemanschik.com/poc-html5-interface-vbRichClient-WebServer/src/index.html

### how to specify a alternativ server
https://localhost:8080/?wss=wss://localhost:1214

## Releasing
When you want to create a new release, follow these steps:

1. Update the version in your project's package.json file (e.g. 1.2.3)
2. git commit -am v1.2.3
3. git tag v1.2.3
4. git push && git push --tags

# Research 

- https://ayushgp.github.io/scaling-websockets-using-sharedworkers/
- AudioWorklets do not contain WebSocket access but can send the raw data of a mic
- WebRTC can do the same we get the same PCM stuff
- https://github.com/benwtrent/WebSocketWebRTCRecorders/blob/master/Scripts/WSAudioRecorder.js
  - is a interristing code snipet with its audio worklet while it is old it still shows stuff lile
  - converting 32bit PCM To 16bit PCM since we offload most time inside the same location this is not importent
- Options
  - Send smaller chuncks of recorded audio with a timer and merge them again server side. http://www.smartjava.org/content/record-audio-using-webrtc-chrome-and-speech-recognition-websockets
  - Send the audio packets as they occur over websockets to your server so that you can manipulate and merge them there.
  - https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/audio/index.html

- Playback https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API

Consider abandoning MP3 (very old) all together in favor of 64-kbit Opus files. MSE can play audio/webm codecs=opus files but cannot currently play audio/ogg files. If you need to play Ogg Opus files, you could bypass MSE and use WebAssembly with the Web Audio API, but you'll need to manually throttle the decoding and output buffers to be memory-efficient. You'll have more control but the coding is more complicated.

See chunk decoding examples at https://fetch-stream-audio.anthum.com/
https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API
