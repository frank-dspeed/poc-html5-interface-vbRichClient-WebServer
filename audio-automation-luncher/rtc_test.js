// @ts-ignore

/// <reference path="socket.io-client" />
/**
 * readableStream
 *  .pipeThrough(
 *    new FilterStream((value)=>value === value)
 *  ).pipeTo(writeableStream)
 * 
 * let [spyStream, newReadableStream] = readableStream.tee()
 * spyStream
 *  .pipeThrough(
 *    new FilterStream((value)=>value === value)
 *  ).pipeTo(writeableStream);
 * 
 * newReadableStream.locked === false 
 * 
 * @param {(chunk: any)=>boolean} filter 
 */
const FilterStream = class FilterStream extends TransformStream {
  constructor(/** @type {(chunk: any)=>boolean} */ filter) {
    const transform = (/** @type {any} */ chunk, /** @type {TransformStreamDefaultController} */ controller) => {
      if (filter(chunk)) { controller.enqueue(chunk) };
    };
    super({ transform });
  }
};

/**
 * takes a readable and a array of writable Streams
 * pipes copys of the readable into the writeables
 * and returns a copy of the original readable.
 * @param {ReadableStream} readableStream 
 * @param {WritableStream[]} writableStreams 
 * @returns {ReadableStream}
 */
const pipeToArray = (readableStream, writableStreams) => {
  let nextStream = readableStream;
  writableStreams.forEach( (writableStream) => {
    const [current, next] = nextStream.tee();
    nextStream = next;
    current.pipeTo(writableStream);
  } );
  return nextStream;
}

/**
 * ReadableStream with .push() method
 */
 class ReadableStreamWithPush extends ReadableStream {
  constructor() {
    /** @type {ReadableStreamController<any>} */
    let defferedController; //let localScope = { /** @type {ReadableStreamController<any>.enqueue} */ push(/** @type {any} */ chunk) {} };
    const start = (/** @type {ReadableStreamController<any>} */ controller) => 
      defferedController = controller; //localScope.push = (/** @type {any} */ chunk) => controller.enqueue(chunk);
    super({ start }); // @ts-ignore
    this.push = defferedController.enqueue;
  }
};

/**
 * combines streams via a new ReadableStreamWithPush
 * all other streams get a new writableStream
 * that writes to the push stream.
 * @param {ReadableStream[]} streams 
 */
const flattenStreams = (streams) => {
  const mergedStream = new ReadableStreamWithPush();
  streams.forEach( (stream) => stream.pipeTo(new WritableStream({ 
    write(chunk) { mergedStream.push(chunk) }
  })) );
  return mergedStream;
}

async function* asAsyncIterator(/** @type {ReadableStream} */ stream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) { return; };
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
};

const readableFromEvent = (/** @type {any} */ eventEmitter,/** @type {string} */ eventName, /** @type {string} */ returnPropertyName) => {
  return new ReadableStream({
    start(controller) {
      eventEmitter[eventName] = (/** @type {any} */ event) => controller.enqueue(returnPropertyName ? eventEmitter[returnPropertyName] : event);
    }
  });
};

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
  if (codec === '') {
    console.log(`No preference on ${str}.`);
    return sdp;
  }

  console.log(`Prefer ${str}: ${codec}`);

  const sdpLines = sdp.split('\r\n');

  // Search for m line.
  const mLineIndex = findLine(sdpLines, 'm=', type);
  if (mLineIndex === null) {
    return sdp;
  }

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
    console.log(`Connecting to server: ${serverUrl}`);
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
        start(controller) {
          socketConnection.on('message', (signal={}) => controller.enqueue(signal) /** peerConnectionSignalHandler */);
          socketConnection.on('error', (evt = '') => { signalStream.close(evt); controller.close() });
          socketConnection.on('close', (evt = '') => { signalStream.close(evt); controller.error(evt) });
          /** @type {NodeJS.Timeout} */
          let signalConnectionTimeout;
          return Promise.race([
            new Promise( (resolve) => signalConnectionTimeout = setTimeout( () => resolve(Promise.reject('Timeout')), 500) ),
            new Promise( (resolve) => socketConnection.on("connect", () => { clearTimeout(signalConnectionTimeout); resolve(signalStream) }) ),
          ]);
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
  
  peerConnection.onnegotiationneeded = async () => {
    try {
        if (peerConnection.signalingState != "stable") { 
            await peerConnection.setLocalDescription({type: "rollback"}); // Should reset local and remote Description // signalingState = new // return;
        }; // Should not happen
        await peerConnection.setLocalDescription(await peerConnection.createOffer());
    } catch (e) { console.dir(e) }
  };
  
  const signalingStateStream = readableFromEvent(peerConnection,'onsignalingstatechange','signalingState')
  const iceConnectionStateStream = readableFromEvent(peerConnection,'oniceconnectionstatechange','iceConnectionState')
  const iceCandidateStream = readableFromEvent(peerConnection, 'onicecandidate');
  const trackStream = { 
    writable: new WritableStream({
      async write(mediaStreamPromise = navigator.mediaDevices.getUserMedia({ audio: true })) {
        
        const mediaStream = await mediaStreamPromise;
        const audioTracks = mediaStream.getTracks();
        console.log('Adding Local Stream to peer connection');
        console.log(`Using Audio device: ${audioTracks[0].label}`);
        audioTracks.forEach( (track) => { 
            const transceiver = peerConnection.addTransceiver(track, { streams: [mediaStream] });
            //if (supportsSetCodecPreferences) { transceiver.setCodecPreferences(getSelectedCodec(preferredCodec)); };
        });
      
      }
    }),
    readable: readableFromEvent(peerConnection, 'ontrack') ,
  };
   
  const writableAddRemoteRTCSessionDescriptionStream = new WritableStream({
    async write(signal) {
      if (signal.type === 'offer' && peerConnection.signalingState != "stable") {      
          await peerConnection.setLocalDescription({type: "rollback"}); // Should reset local and remote Description // signalingState = new
      }
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal)); // have-remote-offer signalingState
      await peerConnection.setLocalDescription(await peerConnection.createAnswer()); // have-local-preanswer signalingState
    }
  });

  const transformSdp = new TransformStream({
    transform(signal, controller) {
      forceCodecIfNotSupported(signal);
      controller.enqueue(signal)
    }
  });

  const readableRemoteSessionDescriptionStream = new ReadableStreamWithPush();
  readableRemoteSessionDescriptionStream
    .pipeThrough(transformSdp)
    .pipeTo(writableAddRemoteRTCSessionDescriptionStream);
  
  const readableRemoteIceCandidateStream = new ReadableStreamWithPush();
  readableRemoteIceCandidateStream.pipeTo(new WritableStream({
    async write(/** @type {RTCIceCandidateInit} */ signal) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(signal));
    }
  }));
  
  const signalInputStream = new WritableStream({
    async write(signal) {
        if (signal.sdp) { readableRemoteSessionDescriptionStream.push(signal); };
        if (signal.candidate) { readableRemoteIceCandidateStream.push(signal); };
    },
  });
  
  const [ signalingStateForSignalStream, newSignalingStateStream ] = signalingStateStream.tee();
  const peerConnectionLocalDescriptionPreTransformStreamFilter = new FilterStream((signalState='') => [
    "have-local-offer", // The local peer has called RTCPeerConnection.setLocalDescription(), passing in SDP representing an offer (usually created by calling RTCPeerConnection.createOffer()), and the offer has been applied successfully.
    "have-remote-offer", // The remote peer has created an offer and used the signaling server to deliver it to the local peer, which has set the offer as the remote description by calling RTCPeerConnection.setRemoteDescription().
    "have-local-pranswer", // The offer sent by the remote peer has been applied and an answer has been created (usually by calling RTCPeerConnection.createAnswer()) and applied by calling RTCPeerConnection.setLocalDescription(). This provisional answer describes the supported media formats and so forth, but may not have a complete set of ICE candidates included. Further candidates will be delivered separately later.
  ].includes(signalState));
  const peerConnectionLocalDescriptionTransformStream = new TransformStream({
    transform(chunk, controller) { controller.enqueue(peerConnection.localDescription)}
  });
  const peerConnectionLocalDescriptionStream = signalingStateForSignalStream
    .pipeThrough(peerConnectionLocalDescriptionPreTransformStreamFilter)
    .pipeThrough(peerConnectionLocalDescriptionTransformStream);
  
  const signalOutputStream = flattenStreams([
    peerConnectionLocalDescriptionStream,
    iceCandidateStream
  ]);



  return { signalInputStream, signalOutputStream, signalingStateStream,iceConnectionStateStream,iceCandidateStream,trackStream, readableRemoteSessionDescriptionStream, readableRemoteIceCandidateStream };
}

const RemoteMediaStream = async (peerConnection = new RTCPeerConnection({
  iceServers: [
      { 'urls': 'stun:stun.l.google.com:19302', },
  ],
  iceTransportPolicy: "relay", // "all"
})) => {
  const signalStream = await getSignalStream();
  const { signalInputStream, signalOutputStream, signalingStateStream, trackStream } = getPeerConnectionAsStreams(peerConnection);
  
  signalStream.readable.pipeTo(signalInputStream);
  signalOutputStream.pipeTo(signalStream.writable);

  const close = () => {
    peerConnection.getTransceivers().forEach( (transceiver) => {
        transceiver.receiver.track.stop(); // === mediaStream.getTracks()[track]
        transceiver.stop();
    });
    peerConnection.close();
  }

  return { signalingStateStream, trackStream, close };
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
 
 /*
  *  Copyright (c) 2021 DIREKTSPEED <frank@lemanschik.com>. All Rights Reserved.
  *
  *  Use of this source code is governed by a BSD-style license
  *  that can be found in the LICENSE file in the root of the source
  *  tree.
  */
 // taken from chrome://webrtc-internals with jshint adaptions
 
 /* exported TimelineDataSeries, TimelineGraphView */
 
 // The maximum number of data points bufferred for each stats. Old data points
 // will be shifted out when the buffer is full.
 const MAX_STATS_DATA_POINT_BUFFER_SIZE = 1000;
 
 const TimelineDataSeries = (function() {
   /**
    * @constructor
    */
   function TimelineDataSeries() {
     // List of DataPoints in chronological order.
     /** @type {*} */
     this.dataPoints_ = [];
 
     // Default color.  Should always be overridden prior to display.
     this.color_ = 'red';
     // Whether or not the data series should be drawn.
     this.isVisible_ = true;
     /** @type {*} */
     this.cacheStartTime_ = null;
     this.cacheStepSize_ = 0;
     /** @type {*} */
     this.cacheValues_ = [];
   }
 
   TimelineDataSeries.prototype = {
     /**
      * @override
      */
     toJSON: function() {
       if (this.dataPoints_.length < 1) {
         return {};
       }
 
       let values = [];
       for (let i = 0; i < this.dataPoints_.length; ++i) {
         values.push(this.dataPoints_[i].value);
       }
       return {
         startTime: this.dataPoints_[0].time,
         endTime: this.dataPoints_[this.dataPoints_.length - 1].time,
         values: JSON.stringify(values),
       };
     },
 
 
     /**
      * Adds a DataPoint to |this| with the specified time and value.
      * DataPoints are assumed to be received in chronological order.
      * @param {number} timeTicks 
      * @param {*} value 
      */
     addPoint: function(timeTicks, value) {
       let time = new Date(timeTicks);
       this.dataPoints_.push(new DataPoint(time, value));
 
       if (this.dataPoints_.length > MAX_STATS_DATA_POINT_BUFFER_SIZE) {
         this.dataPoints_.shift();
       }
     },
 
     isVisible: function() {
       return this.isVisible_;
     },
 
     show: function(isVisible=false) {
       this.isVisible_ = isVisible;
     },
 
     getColor: function() {
       return this.color_;
     },
 
     setColor: function(color='red') {
       this.color_ = color;
     },
 
     getCount: function() {
       return this.dataPoints_.length;
     },
     /**
      * Returns a list containing the values of the data series at |count|
      * points, starting at |startTime|, and |stepSize| milliseconds apart.
      * Caches values, so showing/hiding individual data series is fast.
      * @param {*} startTime 
      * @param {*} stepSize 
      * @param {*} count 
      * @returns 
      */
     getValues: function(startTime, stepSize, count) {
       // Use cached values, if we can.
       if (this.cacheStartTime_ === startTime &&
         this.cacheStepSize_ === stepSize &&
         this.cacheValues_.length === count) {
         return this.cacheValues_;
       }
 
       // Do all the work.
       this.cacheValues_ = this.getValuesInternal_(startTime, stepSize, count);
       this.cacheStartTime_ = startTime;
       this.cacheStepSize_ = stepSize;
 
       return this.cacheValues_;
     },
 
     /**
      * Returns the cached |values| in the specified time period.
      */
     getValuesInternal_: function(/** @type {any} */ startTime, /** @type {any} */ stepSize, /** @type {number} */ count) {
       let values = [];
       let nextPoint = 0;
       let currentValue = 0;
       let time = startTime;
       for (let i = 0; i < count; ++i) {
         while (nextPoint < this.dataPoints_.length &&
         this.dataPoints_[nextPoint].time < time) {
           currentValue = this.dataPoints_[nextPoint].value;
           ++nextPoint;
         }
         values[i] = currentValue;
         time += stepSize;
       }
       return values;
     }
   };
 
   /**
      * A single point in a data series.  Each point has a time, in the form of
      * milliseconds since the Unix epoch, and a numeric value.
      * @constructor
      * @param {Date} time
      * @param {any} value
      */
   function DataPoint(time, value) {
     this.time = time;
     this.value = value;
   }
 
   return TimelineDataSeries;
 })();
 
 const TimelineGraphView = (function() {
   // Maximum number of labels placed vertically along the sides of the graph.
   let MAX_VERTICAL_LABELS = 6;
 
   // Vertical spacing between labels and between the graph and labels.
   let LABEL_VERTICAL_SPACING = 4;
   // Horizontal spacing between vertically placed labels and the edges of the
   // graph.
   let LABEL_HORIZONTAL_SPACING = 3;
   // Horizintal spacing between two horitonally placed labels along the bottom
   // of the graph.
   // var LABEL_LABEL_HORIZONTAL_SPACING = 25;
 
   // Length of ticks, in pixels, next to y-axis labels.  The x-axis only has
   // one set of labels, so it can use lines instead.
   let Y_AXIS_TICK_LENGTH = 10;
 
   let GRID_COLOR = '#CCC';
   let TEXT_COLOR = '#000';
   let BACKGROUND_COLOR = '#FFF';
 
   let MAX_DECIMAL_PRECISION = 3;
 
   /**
      * @constructor
      * @param {string} divId
      * @param {string} canvasId
      */
   function TimelineGraphView(divId, canvasId) {
     this.scrollbar_ = {position_: 0, range_: 0};
 
     this.graphDiv_ = document.getElementById(divId);
     
     this.canvas_ = document.getElementById(canvasId); 
     
     this.repaintTimerRunning_ = false;
 
     // Set the range and scale of the graph.  Times are in milliseconds since
     // the Unix epoch.
 
     // All measurements we have must be after this time.
     this.startTime_ = 0;
     // The current rightmost position of the graph is always at most this.
     this.endTime_ = 1;
 
     // @ts-ignore
     this.graph_ = null;
 
     // Horizontal scale factor, in terms of milliseconds per pixel.
     this.scale_ = 1000;
 
     // Initialize the scrollbar.
     this.updateScrollbarRange_(true);
   }
 
   TimelineGraphView.prototype = {
     setScale: function(/** @type {number} */ scale) {
       this.scale_ = scale;
     },
 
     // Returns the total length of the graph, in pixels.
     getLength_: function() {
       let timeRange = this.endTime_ - this.startTime_;
       // Math.floor is used to ignore the last partial area, of length less
       // than this.scale_.
       return Math.floor(timeRange / this.scale_);
     },
 
     /**
      * Returns true if the graph is scrolled all the way to the right.
      */
     graphScrolledToRightEdge_: function() {
       return this.scrollbar_.position_ === this.scrollbar_.range_;
     },
 
     /**
      * Update the range of the scrollbar.  If |resetPosition| is true, also
      * sets the slider to point at the rightmost position and triggers a
      * repaint.
      */
     updateScrollbarRange_: function(/** @type {boolean} */ resetPosition) {
       // @ts-ignore
       let scrollbarRange = this.getLength_() - this.canvas_.width;
       if (scrollbarRange < 0) {
         scrollbarRange = 0;
       }
 
       // If we've decreased the range to less than the current scroll position,
       // we need to move the scroll position.
       if (this.scrollbar_.position_ > scrollbarRange) {
         resetPosition = true;
       }
 
       this.scrollbar_.range_ = scrollbarRange;
       if (resetPosition) {
         this.scrollbar_.position_ = scrollbarRange;
         this.repaint();
       }
     },
 
     /**
      * Sets the date range displayed on the graph, switches to the default
      * scale factor, and moves the scrollbar all the way to the right.
      */
     setDateRange: function(/** @type {{ getTime: () => number; }} */ startDate, /** @type {{ getTime: () => number; }} */ endDate) {
       this.startTime_ = startDate.getTime();
       this.endTime_ = endDate.getTime();
 
       // Safety check.
       if (this.endTime_ <= this.startTime_) {
         this.startTime_ = this.endTime_ - 1;
       }
 
       this.updateScrollbarRange_(true);
     },
 
     /**
      * Updates the end time at the right of the graph to be the current time.
      * Specifically, updates the scrollbar's range, and if the scrollbar is
      * all the way to the right, keeps it all the way to the right.  Otherwise,
      * leaves the view as-is and doesn't redraw anything.
      */
     updateEndDate: function(/** @type {number} */ optDate) {
       this.endTime_ = optDate || (new Date()).getTime();
       this.updateScrollbarRange_(this.graphScrolledToRightEdge_());
     },
 
     getStartDate: function() {
       return new Date(this.startTime_);
     },
 
     /**
      * Replaces the current TimelineDataSeries with |dataSeries|.
      */
     setDataSeries: function(/** @type {string | any[]} */ dataSeries) {
       // Simply recreates the Graph.
       this.graph_ = new Graph();
       for (let i = 0; i < dataSeries.length; ++i) {
         this.graph_.addDataSeries(dataSeries[i]);
       }
       this.repaint();
     },
 
     /**
      * Adds |dataSeries| to the current graph.
      */
     addDataSeries: function(/** @type {any} */ dataSeries) {
       if (!this.graph_) {
         this.graph_ = new Graph();
       }
       this.graph_.addDataSeries(dataSeries);
       this.repaint();
     },
 
     /**
      * Draws the graph on |canvas_|.
      */
     repaint: function() {
       this.repaintTimerRunning_ = false;
       
       // @ts-ignore
       let width =  this.canvas_.width;
       // @ts-ignore
       let height = this.canvas_.height;
       // @ts-ignore
       let context = this.canvas_.getContext('2d');
 
       // Clear the canvas.
       context.fillStyle = BACKGROUND_COLOR;
       context.fillRect(0, 0, width, height);
 
       // Try to get font height in pixels.  Needed for layout.
       let fontHeightString = context.font.match(/([0-9]+)px/)[1];
       let fontHeight = parseInt(fontHeightString);
 
       // Safety check, to avoid drawing anything too ugly.
       if (fontHeightString.length === 0 || fontHeight <= 0 ||
         fontHeight * 4 > height || width < 50) {
         return;
       }
 
       // Save current transformation matrix so we can restore it later.
       context.save();
 
       // The center of an HTML canvas pixel is technically at (0.5, 0.5).  This
       // makes near straight lines look bad, due to anti-aliasing.  This
       // translation reduces the problem a little.
       context.translate(0.5, 0.5);
 
       // Figure out what time values to display.
       let position = this.scrollbar_.position_;
       // If the entire time range is being displayed, align the right edge of
       // the graph to the end of the time range.
       if (this.scrollbar_.range_ === 0) {
         // @ts-ignore
         position = this.getLength_() - this.canvas_.width;
       }
       let visibleStartTime = this.startTime_ + position * this.scale_;
 
       // Make space at the bottom of the graph for the time labels, and then
       // draw the labels.
       let textHeight = height;
       height -= fontHeight + LABEL_VERTICAL_SPACING;
       this.drawTimeLabels(context, width, height, textHeight, visibleStartTime);
 
       // Draw outline of the main graph area.
       context.strokeStyle = GRID_COLOR;
       context.strokeRect(0, 0, width - 1, height - 1);
 
       if (this.graph_) {
         // Layout graph and have them draw their tick marks.
         this.graph_.layout(
           width, height, fontHeight, visibleStartTime, this.scale_);
         this.graph_.drawTicks(context);
 
         // Draw the lines of all graphs, and then draw their labels.
         this.graph_.drawLines(context);
         this.graph_.drawLabels(context);
       }
 
       // Restore original transformation matrix.
       context.restore();
     },
     /**
      * 
      * @param {{ textBaseline: string; textAlign: string; fillStyle: string; strokeStyle: string; fillText: (arg0: string, arg1: number, arg2: any) => void; beginPath: () => void; lineTo: (arg0: number, arg1: number) => void; stroke: () => void; }} context 
      * @param {number} width 
      * @param {*} height 
      * @param {*} textHeight 
      * @param {number} startTime 
      */
     drawTimeLabels: function(context, width, height, textHeight, startTime) {
       // Draw the labels 1 minute apart.
       let timeStep = 1000 * 60;
 
       // Find the time for the first label.  This time is a perfect multiple of
       // timeStep because of how UTC times work.
       let time = Math.ceil(startTime / timeStep) * timeStep;
 
       context.textBaseline = 'bottom';
       context.textAlign = 'center';
       context.fillStyle = TEXT_COLOR;
       context.strokeStyle = GRID_COLOR;
 
       // Draw labels and vertical grid lines.
       while (true) {
         let x = Math.round((time - startTime) / this.scale_);
         if (x >= width) {
           break;
         }
         let text = (new Date(time)).toLocaleTimeString();
         context.fillText(text, x, textHeight);
         context.beginPath();
         context.lineTo(x, 0);
         context.lineTo(x, height);
         context.stroke();
         time += timeStep;
       }
     },
 
     getDataSeriesCount: function() {
       if (this.graph_) {
         return this.graph_.dataSeries_.length;
       }
       return 0;
     },
 
     hasDataSeries: function(/** @type {any} */ dataSeries) {
       if (this.graph_) {
         return this.graph_.hasDataSeries(dataSeries);
       }
       return false;
     },
 
   };
 
   /**
    * A Graph is responsible for drawing all the TimelineDataSeries that have
    * the same data type.  Graphs are responsible for scaling the values, laying
    * out labels, and drawing both labels and lines for its data series.
    */
   const Graph = (function() {
     /**
      * @constructor
      */
     function Graph() {
       /**
          * @type {any[]}
          */
       this.dataSeries_ = [];
 
       // Cached properties of the graph, set in layout.
       this.width_ = 0;
       this.height_ = 0;
       this.fontHeight_ = 0;
       this.startTime_ = 0;
       this.scale_ = 0;
 
       // The lowest/highest values adjusted by the vertical label step size
       // in the displayed range of the graph. Used for scaling and setting
       // labels.  Set in layoutLabels.
       this.min_ = 0;
       this.max_ = 0;
 
       // Cached text of equally spaced labels.  Set in layoutLabels.
       /**
          * @type {any[]}
          */
       this.labels_ = [];
     }
 
     /**
      * A Label is the label at a particular position along the y-axis.
      * @constructor
      */
     /*
     function Label(height, text) {
       this.height = height;
       this.text = text;
     }
     */
 
     Graph.prototype = {
       addDataSeries: function(/** @type {any} */ dataSeries) {
         this.dataSeries_.push(dataSeries);
       },
 
       hasDataSeries: function(/** @type {any} */ dataSeries) {
         for (let i = 0; i < this.dataSeries_.length; ++i) {
           if (this.dataSeries_[i] === dataSeries) {
             return true;
           }
         }
         return false;
       },
 
       /**
        * Returns a list of all the values that should be displayed for a given
        * data series, using the current graph layout.
        */
       /**
        * 
        * @param {{isVisible: () => any; getValues: (arg0: number, arg1: number, arg2: number) => any; }} dataSeries 
        * @returns 
        */
       getValues: function(dataSeries) {
         if (!dataSeries.isVisible()) {
           return null;
         }
         return dataSeries.getValues(this.startTime_, this.scale_, this.width_);
       },
 
 
       /**
        * Updates the graph's layout.  In particular, both the max value and
        * label positions are updated.  Must be called before calling any of the
        * drawing functions.
        * @param {number} width 
        * @param {number} height 
        * @param {number} fontHeight 
        * @param {number} startTime 
        * @param {number} scale 
        */
       layout: function(width, height, fontHeight, startTime, scale) {
         this.width_ = width;
         this.height_ = height;
         this.fontHeight_ = fontHeight;
         this.startTime_ = startTime;
         this.scale_ = scale;
 
         // Find largest value.
         let max = 0;
         let min = 0;
         for (let i = 0; i < this.dataSeries_.length; ++i) {
           let values = this.getValues(this.dataSeries_[i]);
           if (!values) {
             continue;
           }
           for (let j = 0; j < values.length; ++j) {
             if (values[j] > max) {
               max = values[j];
             } else if (values[j] < min) {
               min = values[j];
             }
           }
         }
 
         this.layoutLabels_(min, max);
       },
 
       /**
        * Lays out labels and sets |max_|/|min_|, taking the time units into
        * consideration.  |maxValue| is the actual maximum value, and
        * |max_| will be set to the value of the largest label, which
        * will be at least |maxValue|. Similar for |min_|.
        */
       layoutLabels_: function(/** @type {number} */ minValue, /** @type {number} */ maxValue) {
         if (maxValue - minValue < 1024) {
           this.layoutLabelsBasic_(minValue, maxValue, MAX_DECIMAL_PRECISION);
           return;
         }
 
         // Find appropriate units to use.
         let units = ['', 'k', 'M', 'G', 'T', 'P'];
         // Units to use for labels.  0 is '1', 1 is K, etc.
         // We start with 1, and work our way up.
         let unit = 1;
         minValue /= 1024;
         maxValue /= 1024;
         while (units[unit + 1] && maxValue - minValue >= 1024) {
           minValue /= 1024;
           maxValue /= 1024;
           ++unit;
         }
 
         // Calculate labels.
         this.layoutLabelsBasic_(minValue, maxValue, MAX_DECIMAL_PRECISION);
 
         // Append units to labels.
         for (let i = 0; i < this.labels_.length; ++i) {
           this.labels_[i] += ' ' + units[unit];
         }
 
         // Convert |min_|/|max_| back to unit '1'.
         this.min_ *= Math.pow(1024, unit);
         this.max_ *= Math.pow(1024, unit);
       },
 
       /**
        * Same as layoutLabels_, but ignores units.  |maxDecimalDigits| is the
        * maximum number of decimal digits allowed.  The minimum allowed
        * difference between two adjacent labels is 10^-|maxDecimalDigits|.
        */
       layoutLabelsBasic_: function(/** @type {number} */ minValue, /** @type {number} */ maxValue, /** @type {number} */ maxDecimalDigits) {
         this.labels_ = [];
         let range = maxValue - minValue;
         // No labels if the range is 0.
         if (range === 0) {
           this.min_ = this.max_ = maxValue;
           return;
         }
 
         // The maximum number of equally spaced labels allowed.  |fontHeight_|
         // is doubled because the top two labels are both drawn in the same
         // gap.
         let minLabelSpacing = 2 * this.fontHeight_ + LABEL_VERTICAL_SPACING;
 
         // The + 1 is for the top label.
         let maxLabels = 1 + this.height_ / minLabelSpacing;
         if (maxLabels < 2) {
           maxLabels = 2;
         } else if (maxLabels > MAX_VERTICAL_LABELS) {
           maxLabels = MAX_VERTICAL_LABELS;
         }
 
         // Initial try for step size between conecutive labels.
         let stepSize = Math.pow(10, -maxDecimalDigits);
         // Number of digits to the right of the decimal of |stepSize|.
         // Used for formating label strings.
         let stepSizeDecimalDigits = maxDecimalDigits;
 
         // Pick a reasonable step size.
         while (true) {
           // If we use a step size of |stepSize| between labels, we'll need:
           //
           // Math.ceil(range / stepSize) + 1
           //
           // labels.  The + 1 is because we need labels at both at 0 and at
           // the top of the graph.
 
           // Check if we can use steps of size |stepSize|.
           if (Math.ceil(range / stepSize) + 1 <= maxLabels) {
             break;
           }
           // Check |stepSize| * 2.
           if (Math.ceil(range / (stepSize * 2)) + 1 <= maxLabels) {
             stepSize *= 2;
             break;
           }
           // Check |stepSize| * 5.
           if (Math.ceil(range / (stepSize * 5)) + 1 <= maxLabels) {
             stepSize *= 5;
             break;
           }
           stepSize *= 10;
           if (stepSizeDecimalDigits > 0) {
             --stepSizeDecimalDigits;
           }
         }
 
         // Set the min/max so it's an exact multiple of the chosen step size.
         this.max_ = Math.ceil(maxValue / stepSize) * stepSize;
         this.min_ = Math.floor(minValue / stepSize) * stepSize;
 
         // Create labels.
         for (let label = this.max_; label >= this.min_; label -= stepSize) {
           this.labels_.push(label.toFixed(stepSizeDecimalDigits));
         }
       },
 
       /**
        * Draws tick marks for each of the labels in |labels_|.
        */
       drawTicks: function(/** @type {{ fillStyle: string; beginPath: () => void; moveTo: (arg0: number, arg1: number) => void; lineTo: (arg0: number, arg1: number) => void; stroke: () => void; }} */ context) {
         let x1;
         let x2;
         x1 = this.width_ - 1;
         x2 = this.width_ - 1 - Y_AXIS_TICK_LENGTH;
 
         context.fillStyle = GRID_COLOR;
         context.beginPath();
         for (let i = 1; i < this.labels_.length - 1; ++i) {
           // The rounding is needed to avoid ugly 2-pixel wide anti-aliased
           // lines.
           let y = Math.round(this.height_ * i / (this.labels_.length - 1));
           context.moveTo(x1, y);
           context.lineTo(x2, y);
         }
         context.stroke();
       },
 
       /**
        * Draws a graph line for each of the data series.
        */
       drawLines: function(/** @type {{ strokeStyle: any; beginPath: () => void; lineTo: (arg0: number, arg1: number) => void; stroke: () => void; }} */ context) {
         // Factor by which to scale all values to convert them to a number from
         // 0 to height - 1.
         let scale = 0;
         let bottom = this.height_ - 1;
         if (this.max_) {
           scale = bottom / (this.max_ - this.min_);
         }
 
         // Draw in reverse order, so earlier data series are drawn on top of
         // subsequent ones.
         for (let i = this.dataSeries_.length - 1; i >= 0; --i) {
           let values = this.getValues(this.dataSeries_[i]);
           if (!values) {
             continue;
           }
           context.strokeStyle = this.dataSeries_[i].getColor();
           context.beginPath();
           for (let x = 0; x < values.length; ++x) {
             // The rounding is needed to avoid ugly 2-pixel wide anti-aliased
             // horizontal lines.
             context.lineTo(
               x, bottom - Math.round((values[x] - this.min_) * scale));
           }
           context.stroke();
         }
       },
 
       /**
        * Draw labels in |labels_|.
        */
       drawLabels: function(/** @type {{ fillStyle: string; textAlign: string; textBaseline: string; fillText: (arg0: any, arg1: number, arg2: number) => void; }} */ context) {
         if (this.labels_.length === 0) {
           return;
         }
         let x = this.width_ - LABEL_HORIZONTAL_SPACING;
 
         // Set up the context.
         context.fillStyle = TEXT_COLOR;
         context.textAlign = 'right';
 
         // Draw top label, which is the only one that appears below its tick
         // mark.
         context.textBaseline = 'top';
         context.fillText(this.labels_[0], x, 0);
 
         // Draw all the other labels.
         context.textBaseline = 'bottom';
         let step = (this.height_ - 1) / (this.labels_.length - 1);
         for (let i = 1; i < this.labels_.length; ++i) {
           context.fillText(this.labels_[i], x, step * i);
         }
       }
     };
 
     return Graph;
   })();
 
   return TimelineGraphView;
 })();
 
 
 // Change the ptime. For opus supported values are [10, 20, 40, 60].
 // Expert option without GUI.
 // eslint-disable-next-line no-unused-vars
 /**
  * @param {string} ptime
  * @param {any} signal
  */
 async function setPtime(ptime, signal) { // Should be answer before setRemoteDescription
 //   const offer = await peerConnection.createOffer();
 //   await peerConnection.setLocalDescription(offer);
   const desc = signal;
   if (desc.sdp.indexOf('a=ptime:') !== -1) {
     desc.sdp = desc.sdp.replace(/a=ptime:.*/, 'a=ptime:' + ptime);
   } else {
     desc.sdp += 'a=ptime:' + ptime + '\r\n';
   }
   return desc;
   // await peerConnection.setRemoteDescription(desc);
 }
 
 
 
 /**
  * @param {{ toString: () => any; }} error
  */
 function onCreateSessionDescriptionError(error) {
   console.log(`Failed to create session description: ${error.toString()}`);
 }

 customElements.define('web-rtc-connection', class WebRTCPConnection extends HTMLElement {
   async connectedCallback() {
    this.innerHTML = `
      <div id="container">
        <h1>
          <div id="buttons">
            <select id="codec">
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
              <button id="hangupButton">Hang Up</button>
            </div>
            <div class="graph-container" id="bitrateGraph">
              <div>Bitrate</div>
              <canvas id="bitrateCanvas"></canvas>
            </div>
            <div class="graph-container" id="packetGraph">
              <div>Packets sent per second</div>
              <canvas id="packetCanvas"></canvas>
            </div>
            <div class="graph-container" id="audioLevelGraph">
              <div>average audio level ([0..1])</div>
              <canvas id="audioLevelCanvas"></canvas>
            </div>
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

    const peerConnectionSetCodec = (/** @type {RTCRtpReceiver} */ transceiver) => {
      //const transceiver = peerConnection.getTransceivers().find(t => t.sender && t.sender.track === audioTracks[0]);              
      transceiver.setCodecPreferences(getSelectedCodec(preferredCodec));
    }
    const preferredCodec = codecPreferences?.options[codecPreferences.selectedIndex];
    
    /**
      * 
      * @param {Promise<MediaStream>} mediaStreamPromise
      * @returns 
      */
    const addMediaStream = async (mediaStreamPromise = navigator.mediaDevices.getUserMedia({ audio: true }), peerConnection = new RTCPeerConnection()) => { 
      const mediaStream = await mediaStreamPromise;
      const audioTracks = mediaStream.getTracks();      
      
      console.log('Adding Local Stream to peer connection');
      console.log(`Using Audio device: ${audioTracks[0].label}`);
      let mediaStreamTrackArray
      audioTracks.forEach( (track) => { 
          const transceiver = peerConnection.addTransceiver(track, { streams: [mediaStream] });
          if (supportsSetCodecPreferences) { transceiver.setCodecPreferences(getSelectedCodec(preferredCodec)); };
      });
      
      return { mediaStream, audioTracks }
    };
 
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const remoteMediaStream = RemoteMediaStream();
    const audioElement = document.createElement("audio");
    audioElement.setAttribute('autoplay','')
    audioElement.setAttribute('controls','')
    this.appendChild(audioElement);


    const initSenderStats = (/** @type {RTCPeerConnection} */ peerConnection) => {
         
      const offerOptions = {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 0,
        voiceActivityDetection: false
      };

            const bitrateSeries = new TimelineDataSeries();
            const bitrateGraph = new TimelineGraphView('bitrateGraph', 'bitrateCanvas');
            bitrateGraph.updateEndDate();

            const targetBitrateSeries = new TimelineDataSeries();
            targetBitrateSeries.setColor('blue');

            const headerrateSeries = new TimelineDataSeries();
            headerrateSeries.setColor('green');

            const packetSeries = new TimelineDataSeries();
            const packetGraph = new TimelineGraphView('packetGraph', 'packetCanvas');
            packetGraph.updateEndDate();

            // // query getStats every second sender Stats
            /**
             * @type {{ has: (arg0: any) => any; get: (arg0: any) => { (): any; new (): any; timestamp: number; bytesSent: number; headerBytesSent: number; packetsSent: number; }; }}
             */
            let lastResult;
            const senderStats = () => {
              if (!peerConnection) { return; }
              const sender = peerConnection.getSenders()[0];
              if (!sender) { return; };
              sender.getStats().then((res) => {
                res.forEach((report) => {
                  let bytes;
                  let headerBytes;
                  let packets;
                  if (report.type === 'outbound-rtp' && !report.isRemote) {
                    const now = report.timestamp;
                    bytes = report.bytesSent;
                    headerBytes = report.headerBytesSent;

                    packets = report.packetsSent;
                    if (lastResult && lastResult.has(report.id)) {
                      const deltaT = (now - lastResult.get(report.id).timestamp) / 1000;
                      // calculate bitrate
                      const bitrate = 8 * (bytes - lastResult.get(report.id).bytesSent) / deltaT;
                      const headerrate = 8 * (headerBytes - lastResult.get(report.id).headerBytesSent) / deltaT;

                      // append to chart
                      bitrateSeries.addPoint(now, bitrate);
                      headerrateSeries.addPoint(now, headerrate);
                      targetBitrateSeries.addPoint(now, report.targetBitrate);
                      bitrateGraph.setDataSeries([bitrateSeries, headerrateSeries, targetBitrateSeries]);
                      bitrateGraph.updateEndDate();

                      // calculate number of packets and append to chart
                      packetSeries.addPoint(now, (packets -
                        lastResult.get(report.id).packetsSent) / deltaT);
                      packetGraph.setDataSeries([packetSeries]);
                      packetGraph.updateEndDate();
                    }
                  }
                });
                lastResult = res;
              });
            };
            window.setInterval(senderStats, 1000);
          }
            
            async function callAndRegisterHangup() {
                 //  console.log('Starting call');
                 audioElement.setAttribute('muted','')
                 const { audioTracks } = await addMediaStream(navigator.mediaDevices.getUserMedia({ audio: true }), peerConnection)
                 initSenderStats(peerConnection);
                 if (hangupButton){
                     hangupButton.onclick = () => {
                         audioTracks.forEach((/** @type {{ stop: () => any; }} */ track) => track.stop());
                         switchButtonsAndSelectors();
                     }
                 }
                 switchButtonsAndSelectors();
             }
             
             // Init Audio 
            /** @type {number[]} */
            const audioLevels = [];
            const audioLevelSeries = new TimelineDataSeries();
            const audioLevelGraph = new TimelineGraphView('audioLevelGraph', 'audioLevelCanvas');
            audioLevelGraph.updateEndDate();  
            
            

            if (urlParams.get('mic')) {
                 callAndRegisterHangup();
                 await new Promise( (resolve) => callButton?.addEventListener('click', (ev) => {
                  ev.preventDefault();
                  resolve(null);
                }));
                 // registers Stats
             } else {
              // maybe await body click?   
                  peerConnection.ontrack = (/** @type {{ streams: (MediaProvider | null)[]; }} */ event) => {       
                     console.log('ontrack') 
                     initSenderStats();
                     //  Chrome doesn't support remote audio streams in audio contexts....
                     //  const remoteStream = audio_context.createMediaStreamSource(event.stream);
                     // remoteStream.connect(audio_context.destination);
                     audioElement.srcObject = event.streams[0]; // URL.createObjectURL(event.streams);
                 };
                
                 // Reciver Stats
                  if (window.RTCRtpReceiver && ('getSynchronizationSources' in window.RTCRtpReceiver.prototype)) {
                    /** @type {number} */
                    let lastTime;
                    /**
                     * 
                     * @param {number} timestamp 
                     * @returns 
                     */
                    const getAudioLevel = (timestamp) => {
                      window.requestAnimationFrame(getAudioLevel);
                      if (!peerConnection) {
                        return;
                      }
                      const receiver = peerConnection.getReceivers().find((/** @type {{ track: { kind: string; }; }} */ r) => r.track.kind === 'audio');
                      if (!receiver) {
                        return;
                      }
                      const sources = receiver.getSynchronizationSources();
                      sources.forEach((/** @type {{ audioLevel: number; }} */ source) => audioLevels.push(source.audioLevel));
                      
                      if (!lastTime) {
                        lastTime = timestamp;
                      } else if (timestamp - lastTime > 500 && audioLevels.length > 0) {
                        // Update graph every 500ms.
                        const maxAudioLevel = Math.max.apply(null, audioLevels);
                        audioLevelSeries.addPoint(Date.now(), maxAudioLevel);
                        audioLevelGraph.setDataSeries([audioLevelSeries]);
                        audioLevelGraph.updateEndDate();
                        audioLevels.length = 0;
                        lastTime = timestamp;
                      }
                    };
                    window.requestAnimationFrame(getAudioLevel);
                  }
             }
            
            // start Self implemented getStats
             //  const self = this;
                         
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
               
               
             
             
             // function setMuting(pc, muting) {
             //     let senderList = pc.getSenders();
             //     senderList.forEach(sender) {
             //         sender.track.enabled = !muting;
             //     }
             // }
             
             // const pauseButton = document.createElement('button')
             // pauseButton.onclick = function(evt) {
             //     const newState = !myAudioTrack.enabled;
             //     pauseButton.innerHTML = newState ? "&#x25B6;&#xFE0F;" : "&#x23F8;&#xFE0F;";
             //     audioElement.srcObject.getTracks().forEach(track=>track.enabled = newState;)
             // }
         }
     }
 )
 