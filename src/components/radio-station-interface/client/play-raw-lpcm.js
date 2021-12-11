/**
 * EXAMPLE CODE TO ALLOW Direct Playback of
 * raw LPCM Data
 */

// https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode
// The AudioWorkletNode interface of the Web Audio API represents a base class for a user-defined AudioNode, which can be connected to an audio routing graph along with other nodes. It has an associated AudioWorkletProcessor, which does the actual audio processing in a Web Audio rendering thread.
import { audioContext } from '../../../libs/audio-context.js'
const audioStreamDestination = audioContext.createMediaStreamDestination();

//node1.connect(audioStreamDestination)
//node2.connect(audioStreamDestination)
/**
 *   
 * Objects of these types are designed to hold small audio snippets, 
 * typically less than 45 s. For longer sounds, objects implementing 
 * the MediaElementAudioSourceNode are more suitable. 
 * The buffer contains data in the following format: 
 * non-interleaved IEEE754 32-bit linear PCM (LPCM)
 * with a nominal range between -1 and +1, that is, a 32-bit floating point buffer, 
 * with each sample between -1.0 and 1.0. If the AudioBuffer has multiple channels, 
 * they are stored in separate buffers.    
 * @param {ArrayBufferLike} data 
 */
 const convertFloatToAudioBuffer = (data) => {
    const sampleRate = 8000 | audioContext.sampleRate
    const channels = 1;
    const sampleLength = 128 | data.length; // 1sec = sampleRate * 1
    const buf = audioContext.createBuffer(channels, sampleLength, sampleRate); // Empty Audio
    buf.copyToChannel(new Float32Array(data), 0); // depending on your processing this could be already a float32array
    return buf;
}

/**
 * 
 * @param {ArrayBufferLike} data 
 */
const play = (data) => {
    const player = audioContext.createBufferSource();  
    player.buffer = convertFloatToAudioBuffer(data);
    player.connect(audioContext.destination);    
    player.start(0);
}