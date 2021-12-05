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
    const buf = audioContext.createBuffer(1, 128, 8000);
    buf.copyToChannel(new Float32Array(data), 0);
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


const getDataViaWebsockets = () => {
    // Creates new WebSocket object with an ws URI as the parameter
    const recivingSocket = new WebSocket('ws://');

    // Fired when a connection with a WebSocket is opened,
    //recivingSocket.onopen = function () {
    //   setInterval(function() {
    //     if (recivingSocket.bufferedAmount == 0)
    //       recivingSocket.send(getUpdateData());
    //   }, 50);
    //};

    // Fired when a connection with a WebSocket is closed,
    recivingSocket.onclose = function(event) {
        console.log(event)
    };

    // Fired when a connection with a WebSocket has been closed because of an error,
    recivingSocket.onerror = function(event) {
        console.log(event)
    };
}
 

/**
 * 
 * @param {{data: ArrayBufferLike}} evt 
 */
socket.messageReceived = function ({ data }) {
    play(data);
}
/**
 * 
 * @param {HTMLElement} el 
 * @returns 
 */
export const client = (el) => {
    return el;
}


/*
    Example recived buffer ogg


source = audioCtx.createBufferSource();
var request = new XMLHttpRequest();

request.open('GET', 'viper.ogg', true);

request.responseType = 'arraybuffer';


request.onload = function() {
  var audioData = request.response;

  audioCtx.decodeAudioData(audioData, function(buffer) {
      source.buffer = buffer;

      source.connect(audioCtx.destination);
      source.loop = true;
    },

    function(e){"Error with decoding audio data" + e.err});

}
*/ 