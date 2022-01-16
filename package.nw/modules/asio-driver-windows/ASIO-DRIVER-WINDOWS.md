# FlexAsio using portAudio like we do already
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
