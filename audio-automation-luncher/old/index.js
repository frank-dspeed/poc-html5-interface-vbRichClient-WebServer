//import * as dependencies_js from './dependencies.js'

//import httpProxy from 'http-proxy';
// application/octet-stream
// Connection: Keep-Alive       
//proxy_read_timeout 86400s;
//proxy_send_timeout 86400s;
//Record 1 sec takes 1.05 sec + transfer first result arrives after 1,05 sec will run 1 sec and we will wait 1,05 sec for the next,

// Frontend Related Code
const showMicInputFrontend = async () => {
    new Promise( (resolve) => {
        const startAudioContextButton = document.createElement('button');
        startAudioContextButton.id = 'startAudioContextButton';
        startAudioContextButton.innerText = 'startAudioContext';
        startAudioContextButton.onclick = () => {
            resolve(startAudioContextButton);
        }
        document.body.append(startAudioContextButton);
    }).then( (startAudioContextButton) => {
        startAudioContextButton.outerHTML = `<websocket-input-panel></websocket-input-panel>`
    
        const audioContext = new AudioContext({ sampleRate: 8000 });

        const RegisterAudioWorklet = async () => {
        // mic-audio-extraction-worklet.js
            /**
             * Typechecking not possible as this will run in the AudioWorklet Context.
             */
            const RecorderWorkletProcessor = () => {
                /*
                The AudioWorkletProcessor interface of the Web Audio API represents an audio processing code 
                behind a custom AudioWorkletNode. It lives in the AudioWorkletGlobalScope and runs on the 
                Web Audio rendering thread. In turn, an AudioWorkletNode based on it runs on the main thread.

                It is used as Mixer

                */

                
  
           
                class RecorderWorkletProcessor extends AudioWorkletProcessor {
                    // @ts-ignore outputs, parameters
                    constructor() { super(); this.port.postMessage('ready')}
                    /**
                     * 
                     * @param {[Float32Array[]]} inputs length 128 Float32Array(128)
                     * non-interleaved IEEE754 32-bit linear PCM 
                     * with a nominal range between -1 and +1, 
                     * with each sample between -1.0 and 1.0.
                     * the sample rate depends on the audioContext and is variable
                     * @param {*} outputs 
                     * @param {*} parameters 
                     * @returns 
                     */
                    process(inputs, outputs, parameters) {
                        const inputChannel = inputs[0][0];  //inputChannel Float32Array(128)
                        // @ts-ignore
                        this.port.postMessage(inputChannel); // float32Array sent as byte[512] 

                        return true; // needed on error return false to invalidate the worklet
                    }
                }
                
                // @ts-ignore 
                registerProcessor('recorder-worklet', RecorderWorkletProcessor);
            }
            const audioWorkletBlob = new Blob([`(${RecorderWorkletProcessor})()`], { "type": 'application/javascript' });
            const audioWorkletUrl = URL.createObjectURL(audioWorkletBlob);
            await audioContext.audioWorklet.addModule(audioWorkletUrl);
        }
        RegisterAudioWorklet();

        /**
         * @type {WebSocket}
         */
        // const delay = () => new Promise((done) => setTimeout(() => done(true),1800));
        
        /**
         * 
         * @param {string} state 
         */
        const handleMicStatus = async (state) => {
            if (state === 'prompt' || state === 'granted') {
                // /**
                //  * Problem with browser cache and dynamic imports
                //  * You need to test the network resource and fail
                //  * before you call import() else the import result
                //  * gets cached. and you need to refresh the site.
                //  */
        
                // // Start recorder AudioWorklet and connect it to the mic
                // const { audioContext } = await import(`${currentScriptLocation}/../../../libs/audio-context.js`);
                const requestMicAccess = await navigator.mediaDevices.getUserMedia({ audio: true });
                const microphone = audioContext.createMediaStreamSource(requestMicAccess);
                
                const recorder = new AudioWorkletNode(audioContext, 'recorder-worklet');
                microphone.connect(recorder);
                
                // take recorder AudioWorklet output and stream it to the Automation Server
                const inputStatus = document.getElementById('input-status')
                
                /**
                 * @type {HTMLButtonElement | null}
                 */
                // @ts-ignore
                const micButton = document.getElementById('mic-button')
                if (inputStatus && micButton) {
                    const connectInputFild = document.createElement('input');
                    connectInputFild.value = `wss://${window.location.host}/input`;
        
                    const connectButton = document.createElement('button');
                    connectButton.textContent = 'Connect';
                    connectButton.onclick = () => {
                        const wssUrl = connectInputFild.value;
                        if (wssUrl) {
                            const WebSocketWorkerSrc = () => {
                        
                                const inputSocket = new WebSocket(wssUrl);
                                inputSocket.onmessage = function (event) { console.log(event);  return false; };
                                inputSocket.onopen = () => {
                                    postMessage(JSON.stringify({ event: 'open' }));
                                    return false;
                                }
                                
                                inputSocket.onclose = function(event) {
                                    console.log(event);
                                    postMessage(JSON.stringify({ event: 'close' }))
                                };
                            
                                // Fired when a connection with a WebSocket has been closed because of an error,
                                inputSocket.onerror = function(event) {
                                    console.log(event);
                                    postMessage(JSON.stringify({ event }))
                                };
                                
                                //worker
                                onmessage = function(ev) {                        
                                    
                                    if (inputSocket.readyState === 1) {
                                        inputSocket.send(ev.data); // sent as byte[128] if sampleRate ~8000 mono
                                    } else {
                                        console.log(ev, inputSocket.readyState)
                                    }
                                }
                            }

                            const WebSocketWorkerBlob = new Blob([`const wssUrl = '${wssUrl}';\n`,`(${WebSocketWorkerSrc})()`], { "type": 'application/javascript' });
                            const WebSocketWorkerUrl = URL.createObjectURL(WebSocketWorkerBlob);
                            const worker = new Worker(WebSocketWorkerUrl);
                            
                            worker.onmessage = async (ev) => {
                                if (typeof ev.data === 'string') {
                                    const json = JSON.parse(ev.data);
                                    if (json.event === 'close') {
                                        // recorder.onmessage = () => {};
                                        // recorder.close()
                                        const userMediaInputStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                                        userMediaInputStream.getAudioTracks()
                                                .forEach(track => track.stop());
                                        worker.terminate();
                                        inputStatus.innerHTML = `<span style="color: brown;">CLOSED</span>`;
                                        micButton.removeAttribute("disabled");
                                        micButton.setAttribute('enabled', '')
                                    }
                                    
                                    if (json.event === 'open') {
                                        inputStatus.innerHTML = `<span style="color: green;">OPEN</span>`;
                                        micButton.setAttribute('disabled','')
                                        micButton.removeAttribute("enabled");
                                        recorder.port.onmessage = (ev) => worker.postMessage(ev.data);
                                        recorder.connect(audioContext.destination);
                                    }
                                } 
                                
                            }
            
                            //worker.postMessage(JSON.stringify({ wssUrl })) // Send url parm to the worker
                            
                        
                        }    
                    }
                    inputStatus?.append(connectInputFild)
                    inputStatus?.append(connectButton)

                    
                    
                    
                };
            }
        
            const micStatus = document.getElementById('mic-status')
            
            if (micStatus) {
                micStatus.innerHTML = `<span style="color: red;">${state}</span>${(state === 'denied') ? `<br />
                <p> Please open a new tab and go to chrome://settings/content/microphone 
                unblock there the mic access for ${window.location.origin}</p>` : ''};`;
            }
        
        }
        /**
         * 
         * @param {HTMLElement} el 
         */
        const renderMicMode = (el) => {
            el.innerHTML = `
                <div id="Status">
                    <div id="mic-status"></div>
                    <div id="input-status"></div>
                    <div id="sample-rate"></div>
                </div>
            `
            // const Status = document.createElement('div')
            // Status.id = 'Status';
        
            // const micStatus = document.createElement('div')
            // micStatus.id = 'mic-status';
            // Status.append(micStatus);
        
            // const inputStatus = document.createElement('div')
            // inputStatus.id = 'input-status';
            // Status.append(inputStatus);
        
            const micButton = document.createElement('button')
            micButton.innerText = 'Mic Live'
            micButton.id = 'mic-button'
            micButton.onclick = async () => {
                // @ts-ignore because of name: 'microphone' not in ts
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' })
                const { state } = permissionStatus;
                handleMicStatus(state).catch(e=>console.log(e));;
                permissionStatus.onchange = () => handleMicStatus(state).catch(e=>console.log(e));
            }
            
            el.append(micButton);
            //el.append(Status);
        }
        
        customElements.define('microphone-input-panel', class extends HTMLElement {
            connectedCallback() {
                renderMicMode(this);
            }
        })



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
         * @param {Float32Array} data 
         * @param {AudioContext} audioContext
         */
        const convertFloatToAudioBuffer = (data, audioContext, numberOfAudioChannels=1, sampleRate=8000) => {
            if (sampleRate !== audioContext.sampleRate) {
                console.log('sample rate does not match', sampleRate, audioContext.sampleRate);
            }
            const audioBuffer = audioContext.createBuffer(numberOfAudioChannels, data.length /** 128 */, sampleRate);
            audioBuffer.copyToChannel(new Float32Array(data), 0); // depending on your processing this could be already a float32array
            return audioBuffer;
        }     


    })

    navigator.mediaDevices.enumerateDevices()
    .then(function(devices) {
        // devices.forEach(function(device) {
        //     console.log(device.kind + ": " + device.label +
        //                 " id = " + device.deviceId);
        
        // });
        console.log(devices)
    })
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
    });


    
}


const NWJSCode = async () => {
    const thegui = await import('nw.gui');
    thegui.App.clearCache()
    var win = thegui.Window.get();
    // win.on("devtools-opened", function(url) {
    //     document.getElementById('devtools').src = url;
    // });
    
    win.showDevTools();
    const { inputSockets } = await import('./websocket-server.js');
    
    new Promise( (resolve) => {
        const startAudioContextButton = document.createElement('button');
        startAudioContextButton.id = 'startAudioContextButton';
        startAudioContextButton.innerText = 'startAudioContext';
        startAudioContextButton.onclick = () => {
            resolve(startAudioContextButton);
        }
        
        document.body.append(startAudioContextButton);
        setTimeout(()=>startAudioContextButton.click())
    }).then( (startAudioContextButton) => {
        startAudioContextButton.outerHTML = `<websocket-input-panel></websocket-input-panel>`
        console.log('startAudioContext')
        const audioContext = new AudioContext({ sampleRate: 8000 });
    
        customElements.define('websocket-input-panel', class extends HTMLElement {
            constructor() {
                super();
                        
                this.updateInterval = 500;
                this.channels = 1;
                this.sampleRate = 8000;
                
                /** @type {null|NodeJS.Timer} */
                this.interval = setInterval(() => this.flush(), this.updateInterval);
                
                this.gainNode = audioContext.createGain();
                this.gainNode.gain.value = 1;
                this.gainNode.connect(audioContext.destination);
                
                this.samples = new Float32Array(); // === bufferedData for Scheduling
                this.startTime = audioContext.currentTime; // scheduledData for Playing
                inputSockets.on('audio', (audio) => { this.push(audio); })
    
            }
            static get observedAttributes() { return ['updateInterval', 'sampleRate', 'channels', 'volume']; }
            /**
             * 
             * @param {string} name 
             * @param {string} oldValue 
             * @param {string} newValue 
             */
            attributeChangedCallback(name, oldValue, newValue) {
                // @ts-ignore
                if (oldValue !== newValue) {
                    
                    if (name === 'updateInterval') {
                        if (this.interval) {
                            clearInterval(this.interval);
                        }
                        
                        this.updateInterval = parseInt(newValue);
                        this.interval = setInterval(() => this.flush(), this.updateInterval);
                        return
                    }
                    
                    if (name === 'sampleRate' || name === 'channels') {
                        this[name] = parseInt(newValue);
                    }
                    
                    if (name === 'volume') {
                        this.gainNode.gain.value = parseInt(newValue);
                    }
                    
                }
            }
            connectedCallback() {
                // context needs to be resumed on iOS and Safari (or it will stay in "suspended" state)
                audioContext.resume();
                audioContext.onstatechange = () => console.log(audioContext.state);   // if you want to see "Running" state in console and be happy about it
                
                /**
                 * 
                 * @param {*} param0 
                 */
                const frontendUpdate = ({ id, innerHTML }) => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.innerHTML = innerHTML;
                    }
                }
                inputSockets.on('frontendUpdate', (data) => {
                    console.log({ data })
                    frontendUpdate(data)
                })
    
                this.innerHTML = `
                    <p><span id="isConnected"></span><span id="isConnected"></span></p>
                    <button id="startPlay">Play</button>
                    <pcm-player><pcm-player>
                `;
    
            
                this.innerHTML = `
                    <p> Audio Playback </p><br />
                    <div>currentAudioDuration: <span id="currentAudioDuration"></span></div><br />
                    <div>isConnected: <span id="isConnected"></span></div><br />
                
                `        
            }
            
            /**
             * 
             * @param {Float32Array} data 
             * @returns 
             */
            push(data) {
                if (!this.interval) {
                    this.interval = setInterval(() => this.flush(), this.updateInterval);
                    console.log('start flushing')
                } else {
                    console.log('push', this.interval); // returns number
                }
                this.samples = new Float32Array([...this.samples, ...data]);
                
                return this.samples.byteLength; // buffered Data before Playing.
            }
            
            disconnectedCallback() {
                if (this.interval) {
                    clearInterval(this.interval);
                }
            }
            
            flush() {   
                console.log('flush', (this.samples.byteLength / audioContext.sampleRate));
                if (this.samples.length) {
                    // if (sampleRate !== audioContext.sampleRate) {
                    //     console.log('sample rate does not match', sampleRate, audioContext.sampleRate);
                    // }
                    const audioBuffer = audioContext.createBuffer(this.channels, this.samples.length /** 128 */, audioContext.sampleRate);
                    // audioBuffer.copyToChannel(new Float32Array(this.samples), 0); // depending on your processing this could be already a float32array
                    audioBuffer.copyToChannel(this.samples, 0); // depending on your processing this could be already a float32array
                    
                    // Schedule the Current Buffer
                    const bufferSource = audioContext.createBufferSource()        
                    bufferSource.buffer = audioBuffer;
                    bufferSource.connect(this.gainNode);
                    
                    // Correct StartTimeIfNeeded    
                    const isPlaying = this.startTime >= audioContext.currentTime;
                    const startTime = isPlaying ? this.startTime : audioContext.currentTime;
                    
                    if (!isPlaying) {
                        console.log('Started Playing after creation', audioContext.currentTime - this.startTime)
                    } else {
                        console.log(`start vs current '${startTime} >= ${audioContext.currentTime}' duration: ${audioBuffer.duration}`);
                    }
    
                    bufferSource.start(startTime);
    
                    // Values for next Iteration
                    this.startTime = startTime + audioBuffer.duration;
                    console.log(this.startTime, this.startTime - startTime)
                    this.samples = new Float32Array();
                    return;
                }
                
                
                if (this.interval) {
                    clearInterval(this.interval);
                    this.interval = null;
                    // got no data after 1 Secund create and push should get handled in time.
                    console.log('pause flushing/playing got no data after 1 secund')
                }
                
            }
        }) 
    }).catch(console.log)
   
}


if (location.protocol === 'chrome-extension:') {
    NWJSCode().catch(console.log);
} else {
    showMicInputFrontend();
}
