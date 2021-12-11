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
      /**
      * @type {Float32Array} length 128 Float32Array(128)
      * non-interleaved IEEE754 32-bit linear PCM 
      * with a nominal range between -1 and +1, 
      * with each sample between -1.0 and 1.0.
      * the sample rate depends on the audioContext and is variable
      */
      const inputChannel = inputs[0][0];  //inputChannel Float32Array(128)
      this.port.postMessage(inputChannel)  // float32Array sent as byte[512] 

      /**
        * Since the given  float32Array ranges in-between 1 and -1, 
        * multiplying by the range of the new ArrayBuffer (32767 to -32768).
        * gives us precies enough integers,
        */
      // let sampleLength = inputChannel.length;
      // const inputChannelAs16BitIntegers = new Int16Array(inputChannel.length) // 128
      
      // while (sampleLength--) {
      //    inputChannelAs16BitIntegers[sampleLength] = inputChannel[sampleLength] * 0XFFFF;  //convert to 16 bit
      // }
      //this.port.postMessage(inputChannelAs16BitIntegers)  // sent as byte[512]   
      
      return true;
    }
 }
 
 // @ts-ignore 
 registerProcessor('recorder-worklet', RecorderWorkletProcessor);

 /**
  * Replay it in NodeJS
  */