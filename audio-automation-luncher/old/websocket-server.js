import { type } from 'os';
import { Socket } from 'socket.io';
import * as dependencies_js from './dependencies.js' // namespace import
import { server } from './https-server.js' // namespace import

const { WebSocketServer } = dependencies_js;
const webSocketServer = new WebSocketServer(server)

const WebRTC = webSocketServer.of('/webRTC');
WebRTC.on('connection',  (/** @type {Socket} */ stream) => {
    // case "webrtc-offer":  // Invitation and offer to chat sdp
    // case "webrtc-answer":  // Callee has answered our offer sdp
    // case "webrtc-end": // The other peer has hung up the call
    const isIceCandidate = sdp => (sdp.indexOf('a=candidate:') === 0)
    
    // stream.broadcast.emit('webrtc'); // to all clients in the current namespace except the sender
    // stream.to("room1").emit('webrtc'); // to all clients in room1 except the sende!
    // io.to(["room1", "room2"]).except("room3").emit(/* ... */); // to all clients in room1 and/or room2 except those in room3
    stream.on('webrtc', (sdp) => stream.broadcast.emit('webrtc', sdp));
})

const inputSockets = webSocketServer.of('/input');



// const inputSockets = new WebSocketServer({ server, path: '/input' }); // npm ws without callback
let count_clients = 0;

/**
 * @typedef {Float32Array} PCMAudioDataAsFloat32Array length 128 Float32Array(128)
 * Objects of these types are designed to hold small audio snippets, 
 * typically less than 45 s. For longer sounds, objects implementing 
 * the MediaElementAudioSourceNode are more suitable. 
 * The buffer contains data in the following format: 
 * non-interleaved IEEE754 32-bit linear PCM (LPCM)
 * with a nominal range between -1 and +1, that is, a 32-bit floating point buffer, 
 * with each sample between -1.0 and 1.0. If the AudioBuffer has multiple channels, 
 * they are stored in separate buffers.   
 * the SampleRate depends on audioContext.sampleRate
 */
inputSockets.on('connection', (remoteAudioInput) => {

    const id = count_clients++;
    const innerHTML = `new connection, id=${id}, remoteAddress: ${remoteAudioInput._socket.remoteAddress}:${remoteAudioInput._socket.remotePort} #clients=${inputSockets.clients.size}`
    
    console.log(remoteAudioInput);
    inputSockets.emit('frontendUpdate', { 
        id: 'isConnected', innerHTML
    }),
    
    remoteAudioInput.on('error', (err)=> console.log(err));
    remoteAudioInput.on(
        'message', 
        /**
        * Does Something with the recived Audio
        * @param {PCMAudioDataAsFloat32Array} data 
        * @param {boolean} isBinary 
        */
        (data, isBinary) => {
            console.log('data')
            if (isBinary) {
                inputSockets.emit('audio', data);            
            } else {
                // Handle Commands
                console.log({ data })
            }
        });
    remoteAudioInput.on(
        'close', (code,reason) => {
            const innerHTML = `disconnected, code=${code} reason="${reason.toString()} id=${id}, remoteAddress: ${audioChannel._socket.remoteAddress}:${audioChannel._socket.remotePort} #clients=${inputSockets.clients.size}`
            console.log(innerHTML)
            inputSockets.emit('frontendUpdate', { 
                id: 'isConnected', innerHTML
            })
        }
            
    );
});

//inputSockets.on('error',(msg) => console.log(msg))
server.listen(8080)
export { inputSockets, WebRTC }