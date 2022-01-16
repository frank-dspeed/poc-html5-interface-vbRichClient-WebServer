class RecorderWorkletProcessorWithAdditionalProcessing {
                        process() {

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

                        /**
                         * 
                         * @param {*} config 
                         * @param {*} cb 
                         * @returns 
                         */
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
                            /**
                             * 
                             * @param {*} data 
                             * @param {*} newSampleRate 
                             * @param {*} oldSampleRate 
                             * @returns 
                             */
                            function interpolateArray(data, newSampleRate, oldSampleRate) {
                                const fitCount = Math.round(data.length * (newSampleRate / oldSampleRate));
                                //var newData = new Array();
                                const newData = [];
                                //var springFactor = new Number((data.length - 1) / (fitCount - 1));
                                const springFactor = Number((data.length - 1) / (fitCount - 1));
                                newData[0] = data[0]; // for new allocation
                                for (let i = 1; i < fitCount - 1; i++) {
                                    const tmp = i * springFactor;
                                    const before = parseInt(Number(Math.floor(tmp)).toFixed());
                                    const after = parseInt(Number(Math.ceil(tmp)).toFixed());
                                    const atPoint = tmp - before;
                                    newData[i] = linearInterpolate(data[before], data[after], atPoint);
                                }
                                newData[fitCount - 1] = data[data.length - 1]; // for new allocation
                                return newData;
                            }

                            /**
                             * 
                             * @param {*} before 
                             * @param {*} after 
                             * @param {*} atPoint 
                             * @returns 
                             */
                            function linearInterpolate(before, after, atPoint) {
                                return before + (after - before) * atPoint;
                            }
                            
                            /**
                             * 
                             * @param {*} channelBuffer 
                             * @param {*} rLength 
                             * @returns 
                             */
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
                            
                            /**
                             * 
                             * @param {*} leftChannel 
                             * @param {*} rightChannel 
                             * @returns 
                             */
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
                            const RiffChunkDescriptorIdentifier = writeUTFBytes(view, 0, 'RIFF');
                            const RiffChunkLength = view.setUint32(4, 44 + interleavedLength * 2, true);
                            const RiffType = writeUTFBytes(view, 8, 'WAVE');
                            const FormartSubChunkIdentifier = writeUTFBytes(view, 12, 'fmt ');
                            const formartChunkLength = view.setUint32(16, 16, true);
                            const sampleFormartRaw = view.setUint16(20, 1, true);

                            view.setUint16(22, numberOfAudioChannels, true);
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
                            const lng = interleavedLength;
                            const volume = 1;
                            let index = 44;
                            for (let i = 0; i < lng; i++) {
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


                        }
                        
}
class pcmPlayer {
    flush() {
        /**
         * Demo with fadein out
         */
        /*
        let length = this.samples.length / this.option.channels
        const audioBuffer = audioContext.createBuffer(this.option.channels, length, this.option.sampleRate)
        
        let audioData;
        let offset;
        let decrement;
        // Copy this.samples to audioData with fadeIn Out
        for (let channel = 0; channel < this.option.channels; channel++) {
            audioData = audioBuffer.getChannelData(channel);
            offset = channel;
            decrement = 50;
            
            for (let i = 0; i < length; i++) {
                audioData[i] = this.samples[offset];
                // fadeIn 
                if (i < 50) {
                    audioData[i] =  (audioData[i] * i) / 50;
                }
                /& fadeOut
                if (i >= (length - 51)) {
                    audioData[i] =  (audioData[i] * decrement--) / 50;
                }
                offset += this.option.channels;
            }
        }
        */
        
        //const audioBuffer = convertFloatToAudioBuffer(this.samples, audioContext, this.sample);
    }
}
/**
 * expected buffer that needs to get converted
 * then converts it to Float32Array
 * @param {Float32Array|Int16Array|Int32Array|Int8Array} typedArray 
 * @returns {Float32Array}
 */
const getFormatedValue = (typedArray) => {
        // @ts-ignore
        const typedArrays = {
            '8bitInt': Int8Array,
            '16bitInt': Int16Array,
            '32bitInt': Int32Array,
            '32bitFloat': Float32Array
        };
        // @ts-ignore
        const typedData = new typedArray.constructor(typedArray.buffer);
        const float32 = new Float32Array(typedData.length);
        
        const maxValueMap = new Map();
        maxValueMap.set(Int8Array, 128)
        maxValueMap.set(Int16Array, 32768)
        maxValueMap.set(Int32Array, 2147483648)
        maxValueMap.set(Float32Array, 1) 
        
        const maxValue = maxValueMap.get(typedArray.constructor) || 1;

        for (let i = 0; i < typedData.length; i++) {
            float32[i] = typedData[i] / maxValue; // Default Float 1
        }

        return float32;
    }