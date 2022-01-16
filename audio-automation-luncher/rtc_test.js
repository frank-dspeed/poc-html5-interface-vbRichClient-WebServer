import { FilterTransformStream, ReadableStreamWithPush, flattenStreams, readableFromEvent } from './helpers-stream.js'
import { initReceiverStats, initSenderStats } from './rtc_stats.js'

/// <reference path="socket.io-client" />

// https://webrtc.github.io/samples/src/content/peerconnection/audio/
function forceChosenAudioCodec(/** @type {string} sdp */ sdp, /** @type {HTMLSelectElement} sdp */ codecSelector) {
  return maybePreferCodec(sdp, 'audio', 'send', codecSelector.value);
}

// Copied from AppRTC's sdputils.js:

// Sets |codec| as the default |type| codec if it's present.
// The format of |codec| is 'NAME/RATE', e.g. 'opus/48000'.
/**
 * @param {string} sdp
 * @param {string} type
 * @param {string} dir
 * @param {string} codec
 */
function maybePreferCodec(sdp, type, dir, codec) {
  const str = `${type} ${dir} codec`;
  if (codec === '') { console.log(`No preference on ${str}.`); return sdp; }
  console.log(`Prefer ${str}: ${codec}`);

  const sdpLines = sdp.split('\r\n');

  // Search for m line.
  const mLineIndex = findLine(sdpLines, 'm=', type);
  if (mLineIndex === null) { return sdp; }

  // If the codec is available, set it as the default in m line.
  const codecIndex = findLine(sdpLines, 'a=rtpmap', codec);
  console.log('codecIndex', codecIndex);
  if (codecIndex) {
    const payload = getCodecPayloadType(sdpLines[codecIndex]);
    if (payload) {
      sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], payload);
    }
  }

  sdp = sdpLines.join('\r\n');
  return sdp;
}

// Find the line in sdpLines that starts with |prefix|, and, if specified,
// contains |substr| (case-insensitive search).
/**
 * @param {any} sdpLines
 * @param {string} prefix
 * @param {any} substr
 */
function findLine(sdpLines, prefix, substr) {
  return findLineInRange(sdpLines, 0, -1, prefix, substr);
}

// Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
// and, if specified, contains |substr| (case-insensitive search).
/**
 * @param {string | any[]} sdpLines
 * @param {number} startLine
 * @param {number} endLine
 * @param {any} prefix
 * @param {string} substr
 */
function findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
  const realEndLine = endLine !== -1 ? endLine : sdpLines.length;
  for (let i = startLine; i < realEndLine; ++i) {
    if (sdpLines[i].indexOf(prefix) === 0) {
      if (!substr ||
        sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
        return i;
      }
    }
  }
  return null;
}

// Gets the codec payload type from an a=rtpmap:X line.
/**
 * @param {string} sdpLine
 */
function getCodecPayloadType(sdpLine) {
  const pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
  const result = sdpLine.match(pattern);
  return (result && result.length === 2) ? result[1] : null;
}

// Returns a new m= line with the specified codec as the first one.
/**
 * @param {string} mLine
 * @param {any} payload
 */
function setDefaultCodec(mLine, payload) {
  const elements = mLine.split(' ');

  // Just copy the first three parameters; codec order starts on fourth.
  const newLine = elements.slice(0, 3);

  // Put target payload first and copy in the rest.
  newLine.push(payload);
  for (let i = 3; i < elements.length; i++) {
    if (elements[i] !== payload) {
      newLine.push(elements[i]);
    }
  }
  return newLine.join(' ');
}

const supportsSetCodecPreferences = window.RTCRtpTransceiver && 'setCodecPreferences' in window.RTCRtpTransceiver.prototype;
/**
 * force codec usage even if it is not Implemented NOW!
 * @param {RTCSessionDescriptionInit} signal 
 */
const forceCodecIfNotSupported = (signal) => {
  // Enabling opus DTX is an expert option without GUI.
  // eslint-disable-next-line prefer-const
  let useDtx = false;

  // Disabling Opus FEC is an expert option without GUI.
  // eslint-disable-next-line prefer-const
  let useFec = true;
  if (signal.sdp) {
    (!supportsSetCodecPreferences && signal.sdp) 
      ? signal.sdp = forceChosenAudioCodec(signal.sdp) 
      : signal.sdp;
    
    if (signal.type === 'answer') { // Remote Answer Adjustment
      if (useDtx) {
        signal.sdp = signal.sdp.replace('useinbandfec=1', 'useinbandfec=1;usedtx=1');
      }
      if (!useFec) { 
        signal.sdp = signal.sdp.replace('useinbandfec=1', 'useinbandfec=0');
      }
    }
  };
};

/**
 * 
 * @param {string} sdp 
 * @returns 
 */
const setOwnerAndSession = (sdp, owner = '-', session = '-') => sdp.replace('o=-', `o=${owner}`).replace('s=-', `s=${session}`)

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



const getPeerConnectionAsStreams = (peerConnection = new RTCPeerConnection({
  iceServers: [
      { 'urls': 'stun:stun.l.google.com:19302', },
  ],
  iceTransportPolicy: "relay", // "all"
})) => {
  
  // called by WebRTC after peerConnection.addTransceiver(track, { streams: [mediaStream] });
  peerConnection.onnegotiationneeded = async () => {
    try {
        if (peerConnection.signalingState != "stable") { 
            await peerConnection.setLocalDescription({type: "rollback"}); // Should reset local and remote Description // signalingState = new // return;
            peerConnectionStateStream.enqueue({ message: `onnegotiationneeded: setRemoteDescription({type: "rollback"})` });
        }; // Should not happen
        await peerConnection.setLocalDescription(await peerConnection.createOffer());
        signalOutputStream.enqueue(peerConnection.localDescription)
    } catch (e) { console.dir(e) }
  };
  
  peerConnection.onicecandidateerror = (ev) => {
    console.log(` IceCandidateError: ${ev}`,ev)
  };

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
    forceCodecIfNotSupported(RTCSessionDescriptionInit);
    
    if ((RTCSessionDescriptionInit.type === 'offer' && peerConnection.signalingState != "stable") || RTCSessionDescriptionInit.type === 'answer' && peerConnection.signalingState != "have-local-offer") {
      await peerConnection.setLocalDescription({type: "rollback"}); // Should reset local and remote Description // signalingState = new
      peerConnectionStateStream.enqueue({ message: `gotRemoteRTCSessionDescription: setLocalDescription({type: "rollback"})`, RTCSessionDescriptionInit });
    };
    
    if (RTCSessionDescriptionInit.type === 'answer' && peerConnection.signalingState != "have-local-offer") {
      await peerConnection.setLocalDescription({type: "rollback"}); // Should reset local and remote Description // signalingState = new
      return; // should trigger onnegation needed?
    }
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(RTCSessionDescriptionInit)); // have-remote-offer signalingState
    
    if (RTCSessionDescriptionInit.type === 'offer') {
      await peerConnection.setLocalDescription(await peerConnection.createAnswer()); // have-remote-answer
      signalOutputStream.enqueue(peerConnection.localDescription); // emits on the signalOutputStream
    };
  };

  const gotRemoteIceCandidate = async (/** @type {RTCIceCandidateInit} */ RTCIceCandidateInit) => {
    console.log('gotRemoteIceCandidate:  ', RTCIceCandidateInit );
    await peerConnection.addIceCandidate((RTCIceCandidateInit === null) ? RTCIceCandidateInit : new RTCIceCandidate(RTCIceCandidateInit));
    peerConnectionStateStream.enqueue({ message: `addIceCandidate()`, RTCIceCandidateInit })
  };
  
  const gotLocalIceCandidate =  async (/** @type {RTCPeerConnectionIceEvent} */ RTCPeerConnectionIceEvent) => {
    console.log('gotLocalIceCandidate:  ', RTCPeerConnectionIceEvent.candidate);
    signalOutputStream.enqueue(RTCPeerConnectionIceEvent.candidate);
  }
  
  peerConnection.onicecandidate = gotLocalIceCandidate;

  peerConnection.oniceconnectionstatechange = (ev) => {
    const isConnected = peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed';
    if (isConnected && peerConnection.iceGatheringState === "complete") {

    }
  }
  // TODO: Drive real signal state from here as we know if we sended offer or answer or anything
  
  const signalInputStream = new WritableStream({
    async write(signal) {
      //if (signal === null) { readableRemoteIceCandidateStream.push(signal); return; };
      if (signal) {
          if (signal.sdp) { gotRemoteRTCSessionDescription(signal); return; };
          if (signal.candidate) { gotRemoteIceCandidate(signal); return; };
      }
      console.log('signalInputStream.write(): ', signal);
    },
  });
  
  const [ signalingStateForSignalStream, signalingStateLogStream ] = signalingStateStream.tee();
  const peerConnectionLocalDescriptionPreTransformStreamFilter = new FilterTransformStream((signalState='') => [
    //"have-local-offer", // The local peer has called RTCPeerConnection.setLocalDescription(), passing in SDP representing an offer (usually created by calling RTCPeerConnection.createOffer()), and the offer has been applied successfully.
    //"have-remote-offer", // The remote peer has created an offer and used the signaling server to deliver it to the local peer, which has set the offer as the remote description by calling RTCPeerConnection.setRemoteDescription().
    //"have-local-pranswer", // The offer sent by the remote peer has been applied and an answer has been created (usually by calling RTCPeerConnection.createAnswer()) and applied by calling RTCPeerConnection.setLocalDescription(). This provisional answer describes the supported media formats and so forth, but may not have a complete set of ICE candidates included. Further candidates will be delivered separately later.
  ].includes(signalState));
  
  signalingStateLogStream.pipeTo(new WritableStream({ write(signalingState) { 
    console.log('signalingStateLogStream: ', signalingState, { peerConnection })
  }}));

  const peerConnectionLocalDescriptionTransformStream = new TransformStream({
    async transform(signalingState, controller) { 
      if (!peerConnection.localDescription) { console.error('peerConnectionLocalDescriptionTransformStream: ', peerConnection.localDescription, { peerConnection })};
      controller.enqueue(peerConnection.localDescription) 
    },
  });
  
  const signalingStateToLocalDescriptionStream = signalingStateForSignalStream
    .pipeThrough(peerConnectionLocalDescriptionPreTransformStreamFilter)
    .pipeThrough(peerConnectionLocalDescriptionTransformStream);
  
  const signalOutputStream = flattenStreams([
    signalingStateToLocalDescriptionStream,
  ]);

  return { signalInputStream, signalOutputStream, signalingStateStream,iceConnectionStateStream,trackStream };
}

const RemoteMediaStream = async (peerConnection = new RTCPeerConnection({
  iceServers: [
      { 'urls': 'stun:stun.l.google.com:19302', },
  ],
  iceTransportPolicy: "relay", // "all"
})) => {
  const signalStream = await getSignalStream();
  const { signalInputStream, signalOutputStream, signalingStateStream, trackStream } = getPeerConnectionAsStreams(peerConnection);
  console.log('pre setup')  
  signalStream.readable.pipeTo(signalInputStream);
  signalOutputStream.pipeTo(signalStream.writable);

  const close = () => {
    peerConnection.getTransceivers().forEach( (transceiver) => {
        transceiver.receiver.track.stop(); // === mediaStream.getTracks()[track]
        transceiver.stop();
    });
    peerConnection.close();
  }

  return { signalingStateStream, trackStream, close, peerConnection };
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
      sdpSemantics: "unified-plan", 
      extmapAllowMixed: true,
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

customElements.define('web-rtc-connection', class WebRTCPConnection extends HTMLElement {
  async connectedCallback() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const css = (await import('./css.js')).default;
    const webRTCPConnectionElement = this;
    // Handle userGestureNeeded before play();
    if (!urlParams.get('mic')) { 
      webRTCPConnectionElement.innerHTML = `<style>body, web-rtc-connection { height: 100vh } </style>
      <h1>Click Anywhere on The Body To start the App<h1>`;
      await new Promise( (resolve) => document.body.onclick = webRTCPConnectionElement.onclick = resolve)
      .then(()=> document.body.onclick = webRTCPConnectionElement.onclick = null);
      webRTCPConnectionElement.innerHTML = ''
      webRTCPConnectionElement.append(document.createElement('remote-audio-element'));
    };
    
    webRTCPConnectionElement.innerHTML = `
      ${css}
      <h1><a href="https://lemanschik.com" title="Frank Lemanschik">WebRTC</a> <span>Peer connection: with Advanced Audio Processing</span>
      </h1>    
      <div id="container">
        <div id="audio"><div id="audio-controls"></div></div>    
        <div id="buttons"></div>
        
        ${ (urlParams.get('mic')) 
        ? `<div class="graph-container" id="bitrateGraph">
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
          </div>` }

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
    
    document.getElementById('audio-controls').innerHTML = (urlParams.get('mic')) 
      ? `<div class="label">Local audio:</div><audio id="audio1" autoplay controls muted></audio>` 
      : `<div class="label">Remote audio:</div><audio id="audio2" autoplay controls></audio>`
    
    document.getElementById('buttons').innerHTML = (urlParams.get('mic')) 
      ? `<select id="codec">
        <!-- Codec values are matched with how they appear in the SDP.
        For instance, opus matches opus/48000/2 in Chrome, and ISAC/16000
        matches 16K iSAC (but not 32K iSAC). -->
          <option value="opus">Opus</option>
          <option value="ISAC">iSAC 16K</option>
          <option value="G722">G722</option>
          <option value="PCMU">PCMU</option>
          <option value="red">RED</option>
        </select>
        <select id="codecPreferences" disabled>
          <option selected value="">Default</option>
        </select>
        <button id="callButton">Call</button>
        <button id="hangupButton" disabled>Hang Up</button>`
      : '';
    
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

    const peerConnectionSetCodec = (/** @type {RTCPeerConnection} */ peerConnection) => {
      const transceiver = peerConnection.getTransceivers().find(t => t.sender && t.sender.track === audioTracks[0]);              
      transceiver.setCodecPreferences(getSelectedCodec(codecPreferences?.options[codecPreferences.selectedIndex]));
    };
                
    if (urlParams.get('mic')) {
      const callButton = document.getElementById('callButton');
      const hangupButton = document.getElementById('hangupButton');
      
      // Start
      const codecSelector = document.getElementById('codec');
      // We only show one way of doing this.
      const codecPreferences = document.getElementById('codecPreferences'); //#
      if (supportsSetCodecPreferences && codecSelector && codecPreferences) {
        codecSelector.style.display = 'none';
        const offerCodec = (/** @type {{ mimeType: string; }} */ codec) => !(['audio/CN', 'audio/telephone-event'].includes(codec.mimeType));
        // @ts-ignore
        const { codecs } = RTCRtpSender.getCapabilities('audio');
        codecs
          .filter(offerCodec) //if (['audio/CN', 'audio/telephone-event'].includes(codec.mimeType)) { return; }
          .forEach((/** @type {{ mimeType: string; clockRate: string; sdpFmtpLine: any; }} */ codec) => {
            const option = document.createElement('option');
            option.value = `${codec.mimeType} ${codec.clockRate}${codec.sdpFmtpLine ? ` ${codec.sdpFmtpLine}` : ''}`; //(codec.mimeType + ' ' + codec.clockRate + ' ' + (codec.sdpFmtpLine || '')).trim();
            option.innerText = option.value;
            codecPreferences.appendChild(option);
        });
        codecPreferences.removeAttribute('disabled');
      } else if(codecPreferences) {
        codecPreferences.style.display = 'none';
      } // forceCodecIfNotSupported (signal.sdp)
      // End
  
      // HTML Preffered Codec
      const getSelectedCodec = (preferredCodec) => {
        if (preferredCodec.value !== '') {
          const [ mimeType, clockRate, sdpFmtpLine ] = preferredCodec.value.split(' ');
          // @ts-ignore
          const { codecs } = RTCRtpSender.getCapabilities('audio');
          console.log(mimeType, clockRate, sdpFmtpLine);
          console.log(JSON.stringify(codecs, null, ' '));
          const selectedCodecIndex = codecs.findIndex((/** @type {{ mimeType: any; clockRate: number; sdpFmtpLine: any; }} */ c) => c.mimeType === mimeType && c.clockRate === parseInt(clockRate, 10) && c.sdpFmtpLine === sdpFmtpLine);
          const selectedCodec = codecs[selectedCodecIndex];
          codecs.splice(selectedCodecIndex, 1);
          codecs.unshift(selectedCodec);
          console.log('Preferred video codec', selectedCodec);
          return codecs;
        }
      }
  
      // Start Audio Analyzer Work
      const switchDisabled = (/** @type {HTMLElement | null} */ el) => {
        // @ts-ignore 
        el.disabled = !el?.disabled;
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
          sdpSemantics: "unified-plan", 
          extmapAllowMixed: true,
        }));
    
         /**
          * 
          * @param {Promise<MediaStream>} mediaStreamPromise
          * @returns 
          */
        const addMediaStream = async (mediaStreamPromise = navigator.mediaDevices.getUserMedia({ audio: true })) => { 
          const mediaStream = await mediaStreamPromise;
          const audioTracks = mediaStream.getTracks();
          console.log('Adding Local Stream to peer connection');
          console.log(`Using Audio device: ${audioTracks[0].label}`);
          audioElement.setAttribute('muted','');
          audioElement.srcObject = mediaStream;
          audioTracks.forEach( (track) => { 
              const transceiver = remoteMediaStream.peerConnection.addTransceiver(track, { streams: [mediaStream] });
              //if (supportsSetCodecPreferences) { transceiver.setCodecPreferences(getSelectedCodec(preferredCodec)); };
          });
          return { mediaStream, audioTracks }
        };
        const { audioTracks } = await addMediaStream(navigator.mediaDevices.getUserMedia({ audio: true }))
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
    } else {

      

    };
                   
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
});
 



