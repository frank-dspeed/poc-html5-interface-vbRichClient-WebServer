/** 
 * @typedef {Object} supportsSetCodecPreferences
 * @property {(codecPreferences: RTCRtpCodecCapability[])=>void} setCodecPreferences
 *
 * @typedef {RTCRtpTransceiver & supportsSetCodecPreferences} RTCRtpTransceiverWithSetCodecPreferences
 */
export const castRTCRtpTransceiverWithSetCodecPreferences = (/** @type {RTCRtpTransceiver} */ transceiver) => /** @type {RTCRtpTransceiverWithSetCodecPreferences} */ (transceiver)
