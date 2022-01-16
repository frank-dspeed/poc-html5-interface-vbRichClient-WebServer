/*
 The AudioWorkletProcessor interface of the Web Audio API represents an audio processing code 
 behind a custom AudioWorkletNode. It lives in the AudioWorkletGlobalScope and runs on the 
 Web Audio rendering thread. In turn, an AudioWorkletNode based on it runs on the main thread.

 It is used as Mixer

 */

// @ts-ignore
class RecorderWorkletProcessor extends AudioWorkletProcessor {
    // @ts-ignore outputs, parameters
    process(inputs, output) {
      /**
      * @type {Float32Array} length 128 Float32Array(128)
      * non-interleaved IEEE754 32-bit linear PCM 
      * with a nominal range between -1 and +1, 
      * with each sample between -1.0 and 1.0.
      * the sample rate depends on the audioContext and is variable
      */
      const inputChannel = inputs[0][0];  //inputChannel Float32Array(128)
      const { postMessage } = this.port;
      postMessage(inputChannel)  // float32Array sent as byte[512] 

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
      
      function mergeAudioBuffers(config, cb) {
        var numberOfAudioChannels = config.numberOfAudioChannels;

        // todo: "slice(0)" --- is it causes loop? Should be removed?
        var leftBuffers = config.leftBuffers.slice(0);
        var rightBuffers = config.rightBuffers.slice(0);
        var sampleRate = config.sampleRate;
        var internalInterleavedLength = config.internalInterleavedLength;
        var desiredSampRate = config.desiredSampRate;

        if (numberOfAudioChannels === 2) {
            leftBuffers = mergeBuffers(leftBuffers, internalInterleavedLength);
            rightBuffers = mergeBuffers(rightBuffers, internalInterleavedLength);
            if (desiredSampRate) {
                leftBuffers = interpolateArray(leftBuffers, desiredSampRate, sampleRate);
                rightBuffers = interpolateArray(rightBuffers, desiredSampRate, sampleRate);
            }
        }

        if (numberOfAudioChannels === 1) {
            leftBuffers = mergeBuffers(leftBuffers, internalInterleavedLength);
            if (desiredSampRate) {
                leftBuffers = interpolateArray(leftBuffers, desiredSampRate, sampleRate);
            }
        }

        // set sample rate as desired sample rate
        if (desiredSampRate) {
            sampleRate = desiredSampRate;
        }

        // for changing the sampling rate, reference:
        // http://stackoverflow.com/a/28977136/552182
        function interpolateArray(data, newSampleRate, oldSampleRate) {
            var fitCount = Math.round(data.length * (newSampleRate / oldSampleRate));
            //var newData = new Array();
            var newData = [];
            //var springFactor = new Number((data.length - 1) / (fitCount - 1));
            var springFactor = Number((data.length - 1) / (fitCount - 1));
            newData[0] = data[0]; // for new allocation
            for (var i = 1; i < fitCount - 1; i++) {
                var tmp = i * springFactor;
                //var before = new Number(Math.floor(tmp)).toFixed();
                //var after = new Number(Math.ceil(tmp)).toFixed();
                var before = Number(Math.floor(tmp)).toFixed();
                var after = Number(Math.ceil(tmp)).toFixed();
                var atPoint = tmp - before;
                newData[i] = linearInterpolate(data[before], data[after], atPoint);
            }
            newData[fitCount - 1] = data[data.length - 1]; // for new allocation
            return newData;
        }

        function linearInterpolate(before, after, atPoint) {
            return before + (after - before) * atPoint;
        }

        function mergeBuffers(channelBuffer, rLength) {
            var result = new Float64Array(rLength);
            var offset = 0;
            var lng = channelBuffer.length;

            for (var i = 0; i < lng; i++) {
                var buffer = channelBuffer[i];
                result.set(buffer, offset);
                offset += buffer.length;
            }

            return result;
        }

        function interleave(leftChannel, rightChannel) {
            var length = leftChannel.length + rightChannel.length;

            var result = new Float64Array(length);

            var inputIndex = 0;

            for (var index = 0; index < length;) {
                result[index++] = leftChannel[inputIndex];
                result[index++] = rightChannel[inputIndex];
                inputIndex++;
            }
            return result;
        }

        function writeUTFBytes(view, offset, string) {
            var lng = string.length;
            for (var i = 0; i < lng; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        // interleave both channels together
        var interleaved;

        if (numberOfAudioChannels === 2) {
            interleaved = interleave(leftBuffers, rightBuffers);
        }

        if (numberOfAudioChannels === 1) {
            interleaved = leftBuffers;
        }

        var interleavedLength = interleaved.length;

        // create wav file
        var resultingBufferLength = 44 + interleavedLength * 2;

        var buffer = new ArrayBuffer(resultingBufferLength);

        var view = new DataView(buffer);

        // RIFF chunk descriptor/identifier 
        writeUTFBytes(view, 0, 'RIFF');

        // RIFF chunk length
        view.setUint32(4, 44 + interleavedLength * 2, true);

        // RIFF type 
        writeUTFBytes(view, 8, 'WAVE');

        // format chunk identifier 
        // FMT sub-chunk
        writeUTFBytes(view, 12, 'fmt ');

        // format chunk length 
        view.setUint32(16, 16, true);

        // sample format (raw)
        view.setUint16(20, 1, true);

        // stereo (2 channels)
        view.setUint16(22, numberOfAudioChannels, true);

        // sample rate 
        view.setUint32(24, sampleRate, true);

        // byte rate (sample rate * block align)
        view.setUint32(28, sampleRate * 2, true);

        // block align (channel count * bytes per sample) 
        view.setUint16(32, numberOfAudioChannels * 2, true);

        // bits per sample 
        view.setUint16(34, 16, true);

        // data sub-chunk
        // data chunk identifier 
        writeUTFBytes(view, 36, 'data');

        // data chunk length 
        view.setUint32(40, interleavedLength * 2, true);

        // write the PCM samples
        var lng = interleavedLength;
        var index = 44;
        var volume = 1;
        for (var i = 0; i < lng; i++) {
            view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
            index += 2;
        }

        
        return cb(buffer, view);
        

        
      }
      const exampleConfig = {
        // desiredSampRate: internalRecorder.desiredSampRate,
        // sampleRate: internalRecorder.sampleRate,
        // numberOfAudioChannels: internalRecorder.numberOfAudioChannels,
        // internalInterleavedLength: internalRecorder.recordingLength,
        // leftBuffers: leftchannel,
        // rightBuffers: internalRecorder.numberOfAudioChannels === 1 ? [] : rightchannel
      }
      //mergeAudioBuffers(exampleConfig, (buffer, view) => postMessage{ buffer, view })
      return true; // needed on error return false to invalidate the worklet
    }
 }
 
 // @ts-ignore 
 registerProcessor('recorder-worklet', RecorderWorkletProcessor);

 /**
  * Replay it in NodeJS
  */