// good answer from me about MediaStream => MediaStram https://stackoverflow.com/questions/11292076/load-audiodata-into-audiobuffersourcenode-from-audio-element-via-createmediae/70753627#70753627
import { ReadableStreamWithPush, readableFromEvent } from './helpers-stream.js'
import { initReceiverStats, initSenderStats } from './timeline-graph.js'
import { WebrtcCodecSelect } from './webrtc-codec-element.js';
import { setCodecPreferencesOnTransceiver } from './webrtc-codec-helpers.js';
/// <reference path="socket.io-client" />
// https://webrtc.github.io/samples/src/content/peerconnection/audio/


/**
* 
* @param {RTCPeerConnection} param0 
* @returns 
*/
const isConnected = ({ signalingState, localDescription, remoteDescription }) => (signalingState === 'stable' && localDescription && remoteDescription && true)

// @ts-ignore
//if (!globalThis.io) { import(`./${window.require ? 'node_modules/socket.io/client-dist' : 'socket.io'}/socket.io.esm.min.js`).then(m=> globalThis.io = /** @type {WebSocketServer}*/ m.io) };
  
/**
* @typedef signalStream
* @property {ReadableStream<any>} readable 
* @property {WritableStream<any>} writable
* @property {(reason?: string)=>void} close
*/
/** @type {(serverUrl?: string)=>Promise<signalStream>} */
const getSignalStream = async (serverUrl="wss://localhost:8080/webRTC") => {
    console.log(`getSignalStream(${serverUrl})`);
    // @ts-ignore
    if (!globalThis.io) { await import(`./${window.require ? 'node_modules/socket.io/client-dist' : 'socket.io'}/socket.io.esm.min.js`).then(m=> globalThis.io = /** @type {WebSocketServer}*/ m.io) };
    // @ts-ignore
    /** @type {Socket} */ //@ts-ignore
    const socketConnection = io(serverUrl, { transports: ['websocket'], rejectUnauthorized: false, });
    // const signalTransformStream = new TransformStream({
    //   start(controller) {
    //     socketConnection.on('message', (signal={}) => controller.enqueue(signal) /** peerConnectionSignalHandler */);
    //     socketConnection.on('error', (evt = '') => { controller.error(evt); controller.terminate() });
    //     socketConnection.on('close', (evt = '') => { controller.error(evt); controller.terminate() });
    //     /** @type {NodeJS.Timeout} */
    //     let signalConnectionTimeout;
    //     return Promise.race([
    //       new Promise( (resolve) => signalConnectionTimeout = setTimeout( () => resolve(Promise.reject('Timeout')), 500) ),
    //       new Promise( (resolve) => socketConnection.on("connect", () => { clearTimeout(signalConnectionTimeout); resolve(signalStream) }) ),
    //     ]);
    //   },
    //   transform(chunk) {
    //     socketConnection.send(chunk)
    //   },
    // });
    const signalStream = {
      readable: new ReadableStream({
        async start(controller) {
          console.log(`getSignalStream(${serverUrl}).readable.start`);
          socketConnection.on('message', (signal={}) => controller.enqueue(signal) /** peerConnectionSignalHandler */);
          socketConnection.on('error', (evt = '') => { signalStream.close(evt); controller.close() });
          socketConnection.on('close', (evt = '') => { signalStream.close(evt); controller.error(evt) });
          /** @type {NodeJS.Timeout} */
          let signalConnectionTimeout;
          
          const connection = Promise.race([
            new Promise( (resolve) => signalConnectionTimeout = setTimeout( () => resolve(Promise.reject('Timeout')), 2500) ),
            new Promise( (resolve) => socketConnection.on("connect", () => { clearTimeout(signalConnectionTimeout); resolve(signalStream) }) ),
          ]);
          console.log(`getSignalStream(${serverUrl}).readable Got Connection`, await connection, socketConnection);
          return connection;
        },
        cancel(reason) {
          console.error(reason);
          socketConnection.close();
        },
      }),
      writable: new WritableStream({
        write(chunk) {
          socketConnection.send(chunk)
        },
        close() {
          socketConnection.close();
        },
        abort(reason) {
          console.error(reason);
        }
      }),
      close(reason='signalStream.close()') {
        signalStream.readable.cancel(reason);
      }
    };
    return signalStream;
};



const getPeerConnectionAsStreams = (/** @type {RTCPeerConnection} */ peerConnection) => {
  
  const peerConnectionStateStream = new ReadableStreamWithPush();
  const signalingStateStream = readableFromEvent(peerConnection,'onsignalingstatechange','signalingState')
  const iceConnectionStateStream = readableFromEvent(peerConnection,'oniceconnectionstatechange','iceConnectionState')
  
  
  const trackStream = { 
    writable: new WritableStream({
      /**@param {Promise<MediaStream>} mediaStreamPromise */
      async write(mediaStreamPromise = navigator.mediaDevices.getUserMedia({ audio: true })) {
        const mediaStream = await mediaStreamPromise;
        const audioTracks = mediaStream.getTracks();
        console.log('Adding Local Stream to peer connection');
        console.log(`Using Audio device: ${audioTracks[0].label}`);
        audioTracks.forEach((track) => { 
            const transceiver = peerConnection.addTransceiver(track, { streams: [mediaStream] });
            //if (supportsSetCodecPreferences) { transceiver.setCodecPreferences(getSelectedCodec(preferredCodec)); };
        });
        initSenderStats(peerConnection);
      }
    }),
    readable: readableFromEvent(peerConnection, 'ontrack') ,
  };
   
  const gotRemoteRTCSessionDescription = async (/** @type {RTCSessionDescriptionInit} */ RTCSessionDescriptionInit) => {
    console.log('gotRemoteRTCSessionDescription: ', RTCSessionDescriptionInit);
    const oldSdp = RTCSessionDescriptionInit.sdp;
    
    if (oldSdp !== RTCSessionDescriptionInit.sdp) {
      console.log('gotRemoteRTCSessionDescription: changed SDP ', oldSdp,RTCSessionDescriptionInit.sdp);
    }
    const isOffer = RTCSessionDescriptionInit.type === 'offer';
    const isAnswer = RTCSessionDescriptionInit.type === 'answer';
    const inAcceptAbleOffer =  isOffer && peerConnection.signalingState != "stable";
    const inAcceptAbleAnswer = isAnswer && peerConnection.signalingState != "have-local-offer";
    
    if (inAcceptAbleOffer || inAcceptAbleAnswer) {
      await peerConnection.setLocalDescription({type: "rollback"}); // Should reset local and remote Description // iceConnectionState = new signalingState = new/stable
      console.log({ message: `gotRemoteRTCSessionDescription: setLocalDescription({type: "rollback"})`, RTCSessionDescriptionInit });
    };
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(RTCSessionDescriptionInit)); // have-remote-offer | have-remote-answer signalingState

    if (isOffer) {
      await peerConnection.setLocalDescription(await peerConnection.createAnswer()); // have-remote-answer
      signalOutputStream.enqueue(peerConnection.localDescription); // emits on the signalOutputStream
    }; // } else { // have-remote-offer signalingState}

  };

  const gotRemoteIceCandidate = async (/** @type {RTCIceCandidateInit} */ RTCIceCandidateInit) => {
    console.log('gotRemoteIceCandidate:  ', RTCIceCandidateInit );
    await peerConnection.addIceCandidate((RTCIceCandidateInit === null) ? RTCIceCandidateInit : new RTCIceCandidate(RTCIceCandidateInit));
    peerConnectionStateStream.enqueue({ message: `addIceCandidate()`, RTCIceCandidateInit })
  };
  
  // called by WebRTC after peerConnection.addTransceiver(track, { streams: [mediaStream] });
  peerConnection.onnegotiationneeded = async () => {
    try {
        //   if (rtcPeerConnection.signalingState != "stable") { return; } // this would now require the other side to answer to our offer or to send a new offer as we will not offer anything ?
        if (peerConnection.signalingState != "stable") { // this discards the old state and creates a new offer from our side
            await peerConnection.setLocalDescription({type: "rollback"}); // Should reset local and remote Description // signalingState = new // return;
            peerConnectionStateStream.enqueue({ message: `onnegotiationneeded: setRemoteDescription({type: "rollback"})` });
        }; // Should not happen
        await peerConnection.setLocalDescription(await peerConnection.createOffer());
        signalOutputStream.enqueue(peerConnection.localDescription)
    } catch (e) { console.dir(e) }
  };
  
  peerConnection.onicecandidateerror = (ev) => { console.log(` IceCandidateError: ${ev}`,ev) };
  
  const gotLocalIceCandidate =  async (/** @type {RTCPeerConnectionIceEvent} */ RTCPeerConnectionIceEvent) => {
    console.log('gotLocalIceCandidate:  ', RTCPeerConnectionIceEvent.candidate);
    signalOutputStream.enqueue(RTCPeerConnectionIceEvent.candidate);
  };
  
  peerConnection.onicecandidate = gotLocalIceCandidate;

  peerConnection.oniceconnectionstatechange = (ev) => {
    const isConnected = peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed';
    if (isConnected && peerConnection.iceGatheringState === "complete") {}
  }
  
  // TODO: Drive real signal state from here as we know if we sended offer or answer or anything
  const signalInputStream = new WritableStream({
    async write(signal) {
      //if (signal === null) { gotRemoteIceCandidate(null)); return; };
      if (signal) {
          if (signal.sdp) { gotRemoteRTCSessionDescription(signal); return; };
          if (signal.candidate) { gotRemoteIceCandidate(signal); return; };
      }
      console.log('signalInputStream.write(): ', signal);
    },
  });
  
  signalingStateStream.pipeTo(new WritableStream({ write(signalingState) { 
    console.log('signalingStateLogStream: ', signalingState, { peerConnection })
  }}));
  
  const signalOutputStream = new ReadableStreamWithPush();

  return { signalInputStream, signalOutputStream, iceConnectionStateStream,trackStream };
}

const RemoteMediaStream = async ( /** @type {RTCPeerConnection} */peerConnection) => {
  const signalStream = await getSignalStream();
  const { signalInputStream, signalOutputStream, } = getPeerConnectionAsStreams(peerConnection);
  // forceCodecIfNotSupported(RTCSessionDescriptionInit, codeSelector.value);
  signalStream.readable.pipeTo(signalInputStream);
  signalOutputStream.pipeTo(signalStream.writable);

  const close = () => {
    peerConnection.getTransceivers().forEach( (transceiver) => {
        transceiver.receiver.track.stop(); // === mediaStream.getTracks()[track]
        transceiver.stop();
    });
    peerConnection.close();
  }
  
  const addMediaStream = async (mediaStreamPromise = navigator.mediaDevices.getUserMedia({ audio: true })) => {
    const mediaStream = await mediaStreamPromise;
    const audioTracks = mediaStream.getTracks();
    console.log('Adding Local Stream to peer connection');
    console.log(`Using Audio device: ${audioTracks[0].label}`);
    audioTracks.forEach((track) => { 
        const transceiver = peerConnection.addTransceiver(track, { streams: [mediaStream] });
        //if (supportsSetCodecPreferences) { transceiver.setCodecPreferences(getSelectedCodec(preferredCodec)); };
    });
    initSenderStats(peerConnection);
  }

  return { close, peerConnection };
  // signalingStateStream.pipeTo(new WritableStream({ async write(signalingState) {
  //   console.log("*** ICE connection state changed to " + signalingState);
  //   switch(signalingState) {
  //       case "stable": // no ongoing offer or answer processing. RTCPeerConnection object is new if  both localDescription and remoteDescription are null; or negotiation is complete and a connection has been established.
  //           //yield (isConnected(peerConnection) ? "stable" : "new");
  //           break;
  //       case "have-local-offer": // The local peer has called RTCPeerConnection.setLocalDescription(), passing in SDP representing an offer (usually created by calling RTCPeerConnection.createOffer()), and the offer has been applied successfully.
  //       case "have-local-pranswer": // The offer sent by the remote peer has been applied and an answer has been created (usually by calling RTCPeerConnection.createAnswer()) and applied by calling RTCPeerConnection.setLocalDescription(). This provisional answer describes the supported media formats and so forth, but may not have a complete set of ICE candidates included. Further candidates will be delivered separately later.
  //           // signalConnection.send(peerConnection.localDescription); signalStream.writable
  //           //yield "have-local-description";
  //           break;
  //       case "have-remote-pranswer": // A provisional answer has been received and successfully applied via setRemoteDescription in response to an offer previously sent and established by calling setLocalDescription().
  //           break; // Will reach stable
  //       case "have-remote-offer": // The remote peer has created an offer and used the signaling server to deliver it to the local peer, which has set the offer as the remote description by calling RTCPeerConnection.setRemoteDescription().
  //           //await peerConnection.setLocalDescription(await peerConnection.createAnswer());
  //           signalConnection.send(peerConnection.localDescription);
  //           break;
  //       case "closed": // The RTCPeerConnection has been closed.                   
  //           close();
  //           break;
  //   };
  // }}));
   
};
 
 // Change the ptime. For opus supported values are [10, 20, 40, 60].
 // Expert option without GUI.
 // eslint-disable-next-line no-unused-vars
 /**
  * @param {string} ptime
  * @param {RTCSessionDescriptionInit} signal RTCPeerAnswer before it gets applyed via setRemote
  */
 async function setPtime(ptime, signal) { // Should be answer before setRemoteDescription
  if (signal.sdp && signal.sdp.indexOf('a=ptime:') !== -1) {
     signal.sdp = signal.sdp.replace(/a=ptime:.*/, 'a=ptime:' + ptime);
   } else {
     signal.sdp += 'a=ptime:' + ptime + '\r\n';
   }
   return signal;
 }
 
/**
 * @param {{ toString: () => any; }} error
 */
function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}


customElements.define('remote-audio-element', class RemoteAudioElement extends HTMLElement {
  async connectedCallback() {
    const label = 'Remote audio:'
    this.innerHTML = `
    <style>
      audio { display: inline-block; position: relative; top: 9px; width: calc(100% - 120px); max-width: 100%; }
      div.audio { margin: 0 0 29px 0; }
      div.audio-controls { margin: 0 0 20px 0; }
      div.label { display: inline-block; font-weight: 400; width: 120px; }
    </style>
    <div class="audio">
      <div class="audio-controls">
        <div class="label">${label}</div>
        <!--<audio autoplay controls></audio> -->
      </div>
    </div>
    <div class="graph-container" id="audioLevelGraph">
      <div>average audio level ([0..1])</div>
      <canvas id="audioLevelCanvas"></canvas>
    </div>`;
    
    let audioElement = document.createElement("audio"); //this.getElementsByTagName('audio')[0]; // 
    audioElement.setAttribute('autoplay', '')
    audioElement.setAttribute('controls', '')
    this.getElementsByClassName('audio-controls')[0].appendChild(audioElement);
    
    this.remoteMediaStream = await RemoteMediaStream(new RTCPeerConnection({ 
      iceServers: [ 
        { urls: 'stun:stun.l.google.com:19302', },
        { urls: 'stun:stun1.l.google.com:19302', },
        { urls: 'stun:stun2.l.google.com:19302', },
        { urls: 'stun:stun.l.google.com:19302?transport=udp', },
      ], 
      iceTransportPolicy: "all", // Consider relay
      bundlePolicy: "balanced", 
      rtcpMuxPolicy: "require", 
      iceCandidatePoolSize: 0, 
      //sdpSemantics: "unified-plan", 
      //extmapAllowMixed: true,
    }));

    this.remoteMediaStream.peerConnection.ontrack = function (event) {      
      //  Chrome doesn't support remote audio streams in audio contexts....
      //  const remoteStream = audio_context.createMediaStreamSource(event.stream);
      // remoteStream.connect(audio_context.destination);
      audioElement.srcObject = event.streams[0]; // URL.createObjectURL(event.streams);
      audioElement.volume = 1;
      audioElement.play();
      const closeStats = initReceiverStats(this);
      audioElement.srcObject.onremovetrack = closeStats;       
    };    
 
    // abort // Fired when the resource was not fully loaded, but not as the result of an error.
    // canplay // Fired when the user agent can play the media, but estimates that not enough data has been loaded to play the media up to its end without having to stop for further buffering of content
    // canplaythrough // Fired when the user agent can play the media, and estimates that enough data has been loaded to play the media up to its end without having to stop for further buffering of content.
    // durationchange // Fired when the duration property has been updated.
    // emptied // Fired when the media has become empty; for example, when the media has already been loaded (or partially loaded), and the HTMLMediaElement.load() method is called to reload it.
    // ended // Fired when playback stops when end of the media (<audio> or <video>) is reached or because no further data is available.
    // error // Fired when the resource could not be loaded due to an error.
    // loadeddata // Fired when the first frame of the media has finished loading.
    // loadedmetadata // Fired when the metadata has been loaded
    // loadstart // Fired when the browser has started to load a resource.
    // pause // Fired when a request to pause play is handled and the activity has entered its paused state, most commonly occurring when the media's HTMLMediaElement.pause() method is called.
    // play // Fired when the paused property is changed from true to false, as a result of the HTMLMediaElement.play() method, or the autoplay attribute
    // playing // Fired when playback is ready to start after having been paused or delayed due to lack of data
    // progress // Fired periodically as the browser loads a resource.
    // ratechange // Fired when the playback rate has changed.
    // resize // Fired when one or both of the videoWidth and videoHeight properties have just been updated.
    // seeked // Fired when a seek operation completes
    // seeking // Fired when a seek operation begins
    // stalled // Fired when the user agent is trying to fetch media data, but data is unexpectedly not forthcoming.
    // suspend // Fired when the media data loading has been suspended.
    // timeupdate // Fired when the time indicated by the currentTime property has been updated.
    // volumechange // Fired when the volume has changed.
    // waiting // Fired when playback has stopped because of a temporary lack of data
 

  }
});

customElements.define('local-audio-element', class LocalAudioElement extends HTMLElement {
  async connectedCallback() {
    `<div class="label">Local audio:</div><audio id="audio1" autoplay controls muted></audio>`
  }
})

customElements.define('webrtc-codec-select', WebrtcCodecSelect, { extends: "select" })

//const createWebrtcCodecSelectElement
customElements.define('web-rtc-connection', class WebRTCPConnection extends HTMLElement {
  async connectedCallback() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const css = (await import('./css.js')).default;
    const webRTCPConnectionElement = this;
    // Handle userGestureNeeded before play();
    const isInitator = urlParams.get('mic');
    
    if (!isInitator) { 
      webRTCPConnectionElement.innerHTML = `<style>body, web-rtc-connection { height: 100vh } </style>
      <h1>Click Anywhere on The Body To start the App<h1>`;
      await new Promise( (resolve) => document.body.onclick = webRTCPConnectionElement.onclick = resolve)
      .then(()=> document.body.onclick = webRTCPConnectionElement.onclick = null);
      webRTCPConnectionElement.innerHTML = ''
      webRTCPConnectionElement.append(document.createElement('remote-audio-element'));
    };
    
    webRTCPConnectionElement.innerHTML = `
      ${css}
      <h1>
        <a href="https://lemanschik.com" title="Frank Lemanschik">WebRTC</a> <span>Peer connection: with Advanced Audio Processing</span>
      </h1>    
      <div id="container">
        <div id="audio"><div id="audio-controls">
          ${(isInitator) 
            ? `<div class="label">Local audio:</div><audio autoplay controls muted></audio>` 
            : `<div class="label">Remote audio:</div><audio autoplay controls></audio>`}
        </div></div>    
        ${ (isInitator) 
          ? `<div id="buttons">
              <select is="webrtc-codec-select"></select>
              <button id="callButton">Call</button>
              <button id="hangupButton" disabled>Hang Up</button>
            </div>
            <div class="graph-container" id="bitrateGraph">
              <div>Bitrate</div>
              <canvas id="bitrateCanvas"></canvas>
            </div>
            <div class="graph-container" id="packetGraph">
              <div>Packets sent per second</div>
              <canvas id="packetCanvas"></canvas>
            </div>` 
          : `<div class="graph-container" id="audioLevelGraph">
              <div>average audio level ([0..1])</div>
              <canvas id="audioLevelCanvas"></canvas>
            </div>` 
        }
      </div>
      <table>
        <caption>Bitrate and Packes sent per second - approximate results in browsers</caption>
        <tr>
          <th>Opus</th>
          <th>iSAC 16K</th>
          <th>G722</th>
          <th>PCMU</th>
          <th>Browsers Tested</th>
        </tr>
        <tr>
          <td>~40 kbps / Muted : Same, ~50 Packets, Muted : Same or slight drop</td>
          <td>~30 kbps / Muted : Same, ~33 Packets, Muted : Same or slight drop</td>
          <td>~70 kbps / Muted : Same, ~50 Packets, Muted : Same</td>
          <td>~70 kbps / Muted : Same, ~55 Packets, Muted : Same</td>
          <td>Tested in Chrome, Not tested in Opera, Firefox, Safari, Edge</td>
        </tr>
      </table>
      <hr>
      `;
    
    const audioElement = document.getElementsByTagName('audio')[0]; // document.createElement("audio");
    // audioElement.setAttribute('autoplay', '')
    // audioElement.setAttribute('controls', '')
    // this.appendChild(audioElement);
    
    // abort // Fired when the resource was not fully loaded, but not as the result of an error.
    // canplay // Fired when the user agent can play the media, but estimates that not enough data has been loaded to play the media up to its end without having to stop for further buffering of content
    // canplaythrough // Fired when the user agent can play the media, and estimates that enough data has been loaded to play the media up to its end without having to stop for further buffering of content.
    // durationchange // Fired when the duration property has been updated.
    // emptied // Fired when the media has become empty; for example, when the media has already been loaded (or partially loaded), and the HTMLMediaElement.load() method is called to reload it.
    // ended // Fired when playback stops when end of the media (<audio> or <video>) is reached or because no further data is available.
    // error // Fired when the resource could not be loaded due to an error.
    // loadeddata // Fired when the first frame of the media has finished loading.
    // loadedmetadata // Fired when the metadata has been loaded
    // loadstart // Fired when the browser has started to load a resource.
    // pause // Fired when a request to pause play is handled and the activity has entered its paused state, most commonly occurring when the media's HTMLMediaElement.pause() method is called.
    // play // Fired when the paused property is changed from true to false, as a result of the HTMLMediaElement.play() method, or the autoplay attribute
    // playing // Fired when playback is ready to start after having been paused or delayed due to lack of data
    // progress // Fired periodically as the browser loads a resource.
    // ratechange // Fired when the playback rate has changed.
    // resize // Fired when one or both of the videoWidth and videoHeight properties have just been updated.
    // seeked // Fired when a seek operation completes
    // seeking // Fired when a seek operation begins
    // stalled // Fired when the user agent is trying to fetch media data, but data is unexpectedly not forthcoming.
    // suspend // Fired when the media data loading has been suspended.
    // timeupdate // Fired when the time indicated by the currentTime property has been updated.
    // volumechange // Fired when the volume has changed.
    // waiting // Fired when playback has stopped because of a temporary lack of data

    // HTML Preffered Codec
    
                
    if (isInitator) {
      
      const callButton = /** @type {HTMLButtonElement} */ (document.getElementById('callButton'));
      const hangupButton = /** @type {HTMLButtonElement} */ (document.getElementById('hangupButton'));
      const codecSelector = /** @type {WebrtcCodecSelect} */ (document.getElementsByTagName('select')[0]);
      // document.createElement("select", { is: "webrtc-codec-select" });
      const switchDisabled = ( /** @type {HTMLButtonElement|HTMLSelectElement} */ el) => {
        if (el && el.disabled) { el.disabled = !el.disabled; };
      }
      
      const switchButtonsAndSelectors = () => {
        switchDisabled(hangupButton); //hangupButton.disabled = true;
        switchDisabled(callButton); // callButton.disabled = false;
        switchDisabled(codecSelector); // codecSelector.disabled = false;
      }

      await new Promise( (resolve) => callButton?.addEventListener('click', (ev) => {
        ev.preventDefault();
        resolve(null);
      }));

      async function callAndRegisterHangup() {
        const remoteMediaStream = await RemoteMediaStream(new RTCPeerConnection({ 
          iceServers: [ 
            { urls: 'stun:stun.l.google.com:19302', },
            { urls: 'stun:stun1.l.google.com:19302', },
            { urls: 'stun:stun2.l.google.com:19302', },
            { urls: 'stun:stun.l.google.com:19302?transport=udp', },
          ], 
          iceTransportPolicy: "all", // Consider relay
          bundlePolicy: "balanced", 
          rtcpMuxPolicy: "require", 
          iceCandidatePoolSize: 0, 
          // sdpSemantics: "unified-plan", 
          // extmapAllowMixed: true,
        }));
    
        /**
        * 
        * @param {MediaStream} mediaStream
        * @returns 
        */
        const addMediaStream = (mediaStream) => {
          console.log('Adding Local Stream to peer connection');
          console.log(`Using Audio device: ${audioTracks[0].label}`);

          mediaStream.getTracks().forEach( (track) => {
            const transceiver = remoteMediaStream.peerConnection.addTransceiver(track, { streams: [mediaStream] });
            if (codecSelector.supportsSetCodecPreferences && codecSelector.codecPreferences) { 
              setCodecPreferencesOnTransceiver(transceiver, codecSelector.codecPreferences)
              //setCodecPreferences(remoteMediaStream.peerConnection, track, codecSelector.codecPreferences);
            };
          });
          
          audioElement.setAttribute('muted', '');
          audioElement.srcObject = mediaStream;
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTracks = mediaStream.getTracks();
        addMediaStream(mediaStream)
        
        const closeStats = initSenderStats(remoteMediaStream.peerConnection);
        if (hangupButton){
            hangupButton.onclick = () => {
                audioTracks.forEach((/** @type {{ stop: () => any; }} */ track) => track.stop());
                switchButtonsAndSelectors();
                closeStats();
            }
        }
        
        switchButtonsAndSelectors();
      }
      callAndRegisterHangup();
    }
                   
    // function setMuting(pc, muting) {
    //     let senderList = pc.getSenders();
    //     senderList.forEach(sender) {
    //         sender.track.enabled = !muting;
    //     }
    // }
    
    // const pauseButton = document.createElement('button')
    // pauseButton.onclick = function(evt) {
    //   const newState = !myAudioTrack.enabled;
    //   pauseButton.innerHTML = newState ? "&#x25B6;&#xFE0F;" : "&#x23F8;&#xFE0F;";
    //   audioElement.srcObject.getTracks().forEach(track=>track.enabled = newState;)
    // }

    // getStats without real gui
    // const self = this;
                  
    //  function getConnectionStats() {
    //      const sender = peerConnection.getSenders()[0];
    //      if (!sender) {
    //        return;
    //      }
    //      console.log('call')
    //      peerConnection.getStats(null).then(stats => {
    //        var statsOutput = "";
    //        stats.forEach(report => {
    //          console.log({ report })
    //          if (report.type === "inbound-rtp" && report.kind === "audio") {
    //            Object.keys(report).forEach(statName => {
    //              statsOutput += `<strong>${statName}:</strong> ${report[statName]}<br>\n`;
    //            });
    //          }
    //        });
        
    //        self.innerHTML = statsOutput;
    //      });
    //    }
    // try {                
    //      window.statsInterval = window.setInterval(getConnectionStats, 1000);
    //      /* add event handlers, etc */
    // } catch(err) {
    //      console.error("Error creating RTCPeerConnection: " + err);
    // }
                    

  }
  disconnectedCallback() {
    // Close audioElement.srcObject.getTracks().forEach(track => track.stop() ); peerConnection.close() signalConnection.close() element reset
  }
});
 

/**
 * New Features Experimental Code never done before 
 * - upload and offer as single file via http
 */
class uploadingWithProgressBar {
  connectedCallback() {
  // //<progress min="0" max="100" value="0">0% complete</progress>
  // /**
  //    * @param {string | Document | ArrayBufferView | ArrayBuffer | Blob | FormData | null | undefined} blobOrFile
  //    */
  // function upload(blobOrFile) {
  //   var xhr = new XMLHttpRequest();
  //   xhr.open('POST', '/server', true);
  //   xhr.onload = function(e) { ... };

  //   // Listen to the upload progress.
  //   var progressBar = /** @type {} */ (document.querySelector('progress'));
  //   xhr.upload.onprogress = function(e) {
  //     if (e.lengthComputable) {
  //       progressBar.value = (e.loaded / e.total) * 100;
  //       progressBar.textContent = progressBar.value; // Fallback for unsupported browsers.
  //     }
  //   };

  //   xhr.send(blobOrFile);
  // }

  // upload(new Blob(['hello world'], {type: 'text/plain'}));


  // function uploadAudio( blob ) {
  //   var reader = new FileReader();
  //   reader.onload = function(event){
  //     var fd = {};
  //     fd["fname"] = "test.wav";
  //     fd["data"] = event.target.result;
  //     $.ajax({
  //       type: 'POST',
  //       url: 'upload.php',
  //       data: fd,
  //       dataType: 'text'
  //     }).done(function(data) {
  //         console.log(data);
  //     });
  //   };
  //   reader.readAsDataURL(blob);
  // }
  
  // var reader = new FileReader();
  // reader.onload = function(event){
  //   // event.target.result pump that via signaling
  //   // implement looseEcho algo on the server [lastIndex, lastIndex, lastIndex, lastIndex, lastIndex,..]
  // };
  // reader.readAsDataURL(blob);
  // fetch(`https://example.com/upload.php`, {method:"POST", body:blobData})
  //           .then(response => {
  //               if (response.ok) return response;
  //               else throw Error(`Server returned ${response.status}: ${response.statusText}`)
  //           })
  //           .then(response => console.log(response.text()))
  //           .catch(alert);

  }
  // createMediaStreamTrackSource(track)
  // https://github.com/w3c/webrtc-pc/issues/2570
  // new MediaStream(id).addTracks;
  // audioSourceNode = audioContext.createMediaStreamSource(stream);

}
