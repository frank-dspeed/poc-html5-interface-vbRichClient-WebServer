// Tools to set the codec
// import { RTCRtpTransceiverWithSetCodecPreferences } from './type-casting-helpers.js' would error on runtime without build

import { castRTCRtpTransceiverWithSetCodecPreferences } from './type-casting-helpers.js'

/**
 * inspects a=rtpmap:X line.
 * @param {string} sdpLine
 */
function getCodecPayloadType(sdpLine) {
    const pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
    const result = sdpLine.match(pattern);
    return (result && result.length === 2) ? result[1] : null;
}
 
// const newLine = elements.slice(0, 3);
// newLine.push(payload); // Put target payload first and copy in the rest.
// for (let i = 3; i < elements.length; i++) {
//   if (elements[i] !== payload) { newLine.push(elements[i]); }
// }
// return newLine.join(' ');
/**
 * Returns a new m= line with the specified codec as the first one.
 * @param {string} mLine
 * @param {any} payload
 */
 const setDefaultCodec = (mLine, payload) => {
    const elements = mLine.split(' '); 
    return [...elements.slice(0, 3), payload, ...elements.slice(3).filter(element => element !== payload)].join(' ');
  }
  
  // Sets |codec| as the default |type| codec if it's present.
  // The format of |codec| is 'NAME/RATE', e.g. 'opus/48000'.
  /**
   * @param {string} sdp
   * @param {string} type
   * @param {string} dir
   * @param {string} codecString
   */
  function maybePreferCodec(sdp, type, dir, codecString = '') {
    const str = `${type} ${dir} codec`;
    if (!codecString) { console.log(`No Codec selected on ${str}.`); return sdp; }
    console.log(`Prefer ${str}: ${codecString}`);
  
    const sdpLines = sdp.split('\r\n');
  
    // Search for m line.
    const mLineIndex = findLine(sdpLines, 'm=', type);
    if (mLineIndex === null) { return sdp; }
  
    // If the codec is available, set it as the default in mLine.
    const codecIndex = findLine(sdpLines, 'a=rtpmap', codecString);
    console.log('codecIndex', codecIndex);
    if (codecIndex) {
      const payload = getCodecPayloadType(sdpLines[codecIndex]);
      if (payload) { sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], payload); }
    }
  
    sdp = sdpLines.join('\r\n');
    return sdp;
  }
  
  function forceChosenAudioCodec(/** @type {string} sdp */ sdp, /** @type {string} */ codecString) {
    return maybePreferCodec(sdp, 'audio', 'send', codecString);
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
   
  const supportsSetCodecPreferences = window.RTCRtpTransceiver && 'setCodecPreferences' in window.RTCRtpTransceiver.prototype;
  /**
   * if (!supportsSetCodecPreferences) this still trys to force it
   * via changes on the Signaled Offer and Answer on both sides
   * params useDtx, useFec do only work with the opus codec
   * @param {RTCSessionDescriptionInit} RTCSessionDescriptionInit
   */
  const forceCodecIfNotSupported = (RTCSessionDescriptionInit, /** @type {string} */ codecString, useDtx = false, useFec = true) => {
    if (RTCSessionDescriptionInit.sdp) {
        const needsForce = !supportsSetCodecPreferences;
        if (needsForce) { RTCSessionDescriptionInit.sdp = forceChosenAudioCodec(RTCSessionDescriptionInit.sdp, codecString) };
        // Opus Expert options without GUI.
        if (RTCSessionDescriptionInit.type === 'answer' && codecString === 'opus') { // Remote Answer Adjustment
            if (useDtx) { RTCSessionDescriptionInit.sdp = RTCSessionDescriptionInit.sdp.replace('useinbandfec=1', 'useinbandfec=1;usedtx=1'); }; /** Enabling DTX */
            if (!useFec) { RTCSessionDescriptionInit.sdp = RTCSessionDescriptionInit.sdp.replace('useinbandfec=1', 'useinbandfec=0'); }; /** Disabling FEC */
        }
    };
    return RTCSessionDescriptionInit;
  };

  /**
 * 
 * @param {string} sdp 
 * @returns 
 */
const setOwnerAndSession = (sdp, owner = '-', session = '-') => sdp.replace('o=-', `o=${owner}`).replace('s=-', `s=${session}`)

// if (supportsSetCodecPreferences)
//const getTransceiverByTrack = (/** @type {MediaStreamTrack} */ mediaStreamTrack) => 
const setCodecPreferencesOnTransceiver = (/** @type {RTCRtpTransceiver} */ transceiver, /** @type {RTCRtpCodecCapability[]} */ sortedCodecs) => castRTCRtpTransceiverWithSetCodecPreferences(transceiver).setCodecPreferences(sortedCodecs);
const getTransceiverByTrack = (/** @type {RTCPeerConnection} */ peerConnection, /** @type {MediaStreamTrack} */ mediaStreamTrack) => peerConnection.getTransceivers().find(t => t.sender && t.sender.track === mediaStreamTrack);
const setCodecPreferences = (/** @type {RTCPeerConnection} */ peerConnection, /** @type {MediaStreamTrack} */ mediaStreamTrack, /** @type {RTCRtpCodecCapability[]} */ sortedCodecs) => {
    const transceiver = getTransceiverByTrack(peerConnection, mediaStreamTrack);
    if (!transceiver) { return; };
    setCodecPreferencesOnTransceiver(transceiver, sortedCodecs);
};
  
export { getTransceiverByTrack ,setCodecPreferencesOnTransceiver, forceCodecIfNotSupported, supportsSetCodecPreferences, setCodecPreferences };