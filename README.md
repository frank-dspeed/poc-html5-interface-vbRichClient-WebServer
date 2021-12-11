# poc-html5-interface-vbRichClient-WebServer
This is a PoC Implementation with the main goal to send audio back and forth between a windows APP and also remote control it.

## Use this
https://lemanschik.com/poc-html5-interface-vbRichClient-WebServer/src/index.html
https://lemanschik.com/poc-html5-interface-vbRichClient-WebServer/src/index.html?wss=wss://localhost:8080/input



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

# VB6 Part
- http://www.un4seen.com/forum/?topic=11553.0
- "You've got a long way to go to start using websockets with VB6. Its something I do on the regular, so I know it can be done, but you're relatively far away and I don't have a tidy package for it. Everything I used to learn about websockets came from documentation (tools.ietf.org/html/rfc6455) and the knowledge translates nicely into other languages as well. All of the data that goes from the web browser to your vb6 web socket server will be masked and unreadable unless you learn how to unframe the data first". – 
Brogan
 May 21 '16 at 21:47
- https://www.academia.edu/8041412/Presenting_multiple_auditory_signals_using_multiple_sound_cards_in_Visual_Basic_6_0
 
 
 
## so my proposal is go the Jack (ASIO) way
We Introduce a NWJS Powered App Wrapper for the "Main Audio Station"
this way we abstract away the whole network layer of the "Main Audio Station"
- The NWJS Wrapper will run in the background and gets killed by the vb6 apps exit signal
- The NWJS Wrapper will run the "Main Audio Station Code"
- The NWJS Wrapper will offer a ASIO Device via Jack(Cross Platform including win32)
  - https://jackaudio.org/faq/jack_on_windows.html
  - https://github.com/Streampunk/naudiodon
  - https://github.com/dechamps/FlexASIO
  - Alternativ would maybe be to use direct x wich is less cross platform 

Why?
The main advantage of ASIO over
DirectX lies in its ability to do all of those things with
low latency (i.e., live streaming playback and recording).
DirectSound can provide latencies as low as 20 msec
(Microsoft, 2000). However, if DirectSound must emulate hardware features in software, latencies can be as long
as 100–150 msec (Microsoft, 2000). ASIO is capable of
sound latencies of approximately 3–11 msec (Mars, 2002).
This is particularly useful when one is trying to stream
audio from different audio sources that require a sound monitor.



# Linux 
https://askubuntu.com/questions/572120/how-to-use-jack-and-pulseaudio-alsa-at-the-same-time-on-the-same-audio-device

# Windows Asio shared
https://www.un4seen.com/bassasio.html
https://forum.powerbasic.com/forum/user-to-user-discussions/source-code/55713-bass-asio-with-mixer
## FlexAsio using portAudio like we do already
https://github.com/dechamps/FlexASIO

## ASIO 4 ALL
The concept of our driver is that ASIO always is preferred over Windows sound devices. That means if an applications plays sound through Windows sound devices and ASIO is started with a different sample rate than this application is interrupted because ASIO can change the sample rate. If ASIO is started with the same sample rate than the audio data of the application and ASIO is mixed.
WASAPI exclusive mode is a mechanism of Windows. In shared mode multiple applications can play at the same time and Windows mixes this signals. In exclusive only one application uses the sound device and takes control over the sample rate. No other application can use the sound device during this time. But this is independent from ASIO. ASIO is still preferred over Windows sound devices used in exclusive mode. This is because the driver can't detect if the Windows sound device is used in exclusive mode or not.

Hope this is useful.


extra
But you can try something like this, in Windows mixer set recording device to Microphone and in ASIO4ALL set recording source to Mix...

Another option is to create two recording streams (one recording from the 'What you hear'/'Stereo Mix'; and another recording is from your Mic).

Then you create for each recording a decoding push stream (similar to this post http://www.un4seen.com/forum/?topic=11580 - just add the DECODE flag to the _pushStream creation and omit BASS_ChannelPlay for the push stream).

Finally you create a mixer stream (via the BASSmix add-on) and add the two decoding push streams from the recording to that mixer.
Now you can setup an encoder on the mixer stream - which will then encoder the mixdown of both recordings.

Note: you should make the mixer stream itself also a decoding one (so that nothing is going to the output and adding a feedback echo) - which means you then must query the sample data from the mixer manually via BASS_ChannelGetData (at best in an extra thread)!
