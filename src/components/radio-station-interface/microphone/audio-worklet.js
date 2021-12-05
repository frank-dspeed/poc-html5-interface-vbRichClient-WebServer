/*
 The AudioWorkletProcessor interface of the Web Audio API represents an audio processing code 
 behind a custom AudioWorkletNode. It lives in the AudioWorkletGlobalScope and runs on the 
 Web Audio rendering thread. In turn, an AudioWorkletNode based on it runs on the main thread.

 It is used as Mixer

 */
// @ts-ignore
class RecorderWorkletProcessor extends AudioWorkletProcessor {
    // @ts-ignore outputs, parameters
    process(inputs) {
       /*
        * non-interleaved IEEE754 32-bit linear PCM 
        * with a nominal range between -1 and +1, that is, Float32Array(128), 
        * with each sample between -1.0 and 1.0.
        */
       const inputChannel = inputs[0][0];  //inputChannel Float32Array(128)
       // @ts-ignore
       this.port.postMessage(inputChannel)  // sent as byte[512]
       return true;
    }
 }
 
 // @ts-ignore 
 registerProcessor('recorder-worklet', RecorderWorkletProcessor);