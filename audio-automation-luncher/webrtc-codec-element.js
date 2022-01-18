/**
 * This Element is designed to offer  
 */
import { setCodecPreferences,forceCodecIfNotSupported, supportsSetCodecPreferences } from './webrtc-codec-helpers.js'

class WebrtcCodecSelect extends HTMLSelectElement {
    connectedCallback() {
        this.supportsSetCodecPreferences = supportsSetCodecPreferences;
        const selectCodecPreferences = this;
        if (supportsSetCodecPreferences) {
            const RTCRtpCapabilities = /** @type {RTCRtpCapabilities} */ (RTCRtpSender.getCapabilities('audio'));
            const { codecs } = RTCRtpCapabilities; // Will Error if null that is expected and wanted

            const offerCodec = (/** @type {{ mimeType: string; }} */ codec) => !(['audio/CN', 'audio/telephone-event'].includes(codec.mimeType));
            
            /** @type {RTCRtpCodecCapability[]} */
            this.codecPreferences = (codecs.filter(offerCodec));
            selectCodecPreferences.innerHTML = `<option selected value="">Default</option>`;           
            
            this.codecPreferences.forEach((codec, index) => {
                const option = document.createElement('option');
                option.value = `${index}`; //`${codec.mimeType} ${codec.clockRate}${codec.sdpFmtpLine ? ` ${codec.sdpFmtpLine}` : ''}`;
                option.innerText = `${codec.mimeType} ${codec.clockRate}${codec.sdpFmtpLine ? ` ${codec.sdpFmtpLine}` : ''}`;
                selectCodecPreferences.appendChild(option);
            });
            
            const getCodecPreferences = (/** @type {number} */ preferredCodecIndex) => {
                const codecPreferences = /** @type {RTCRtpCodecCapability[]} */ (this.codecPreferences);
                const selectedCodec =  codecPreferences[preferredCodecIndex]; 
                return [ selectedCodec, ...codecPreferences.filter(c => c !== selectedCodec) ];
            };
            
            selectCodecPreferences.onchange = () => {
                const selectCodecPreferencesValueAsInt = parseInt(selectCodecPreferences.value);
                this.codecPreferences = getCodecPreferences(selectCodecPreferencesValueAsInt);
            }
            
            this.setCodecPreferences = (/** @type {RTCPeerConnection} */ peerConnection, /** @type {MediaStreamTrack} */ mediaStreamTrack) => setCodecPreferences(peerConnection, mediaStreamTrack, /** @type {RTCRtpCodecCapability[]} */ (this.codecPreferences));
          
         } else {
            
            /**
             * Codec values are matched with how they appear in the signaled offer and answer SDP.
             * For instance, opus matches opus/48000/2 in Chrome, and ISAC/16000
             * matches 16K iSAC (but not 32K iSAC). 
             **/
            selectCodecPreferences.innerHTML = `<option selected value="opus">Opus</option>
              <option value="ISAC">iSAC 16K</option>
              <option value="G722">G722</option>
              <option value="PCMU">PCMU</option>
              <option value="red">RED</option>`;
        } 
        
        if (supportsSetCodecPreferences) {
            // addMediaStream can set the codec on the transceiver
        }
    }
    /** 
     * // fallback if not Supported and Opus Options.
     * @param {RTCSessionDescriptionInit} RTCSessionDescriptionInit
     **/
    signalProcessing(RTCSessionDescriptionInit) {
        const needsProcessing = this.value === 'opus' || !supportsSetCodecPreferences;
        // forceCodecIfNotSupported(RTCSessionDescriptionInit, codecSelectorValue, useDtx = false, useFec = true);
        return needsProcessing ? forceCodecIfNotSupported(RTCSessionDescriptionInit, this.value, false, true) : RTCSessionDescriptionInit;
    }
}

export { WebrtcCodecSelect };