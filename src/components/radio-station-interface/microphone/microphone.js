const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);


// Preserves import.meta which is only there on first execution.
const importMetaUrl = import.meta.url;

/**
 * gets https://domain.tld/pathname/scriptname.js
 * returns https://domain.tld/pathname
 * @returns 
 */
const getCurrentScriptPathUrl = () => {
    const currentScriptPath = new URL(importMetaUrl).pathname.split("/");
    currentScriptPath.pop();
    return currentScriptPath.join('/');
}

const currentScriptLocation = getCurrentScriptPathUrl()

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
        await Promise.all([
             fetch('./libs/audio-context.js').catch(console.log),
             fetch(`${currentScriptLocation}/audio-worklet.js`),
        ]);

        // // Start recorder AudioWorklet and connect it to the mic
        const { audioContext } = await import(`${currentScriptLocation}/../../../libs/audio-context.js`);
        await audioContext.audioWorklet.addModule(`${currentScriptLocation}/audio-worklet.js`);
        
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
            
            const httpUrl = urlParams.get('url'); // || `/audioStream` 
            const wssUrl = urlParams.get('wss');
            if (!httpUrl || wssUrl) {
                const wssUrl = wssUrl || `wss://${window.location.host}/input`;
                const worker = new Worker(`${currentScriptLocation}/websocket-worker.js`);
                worker.onmessage = async (ev) => {
                    
                    if (typeof ev.data === 'string') {
                        const json = JSON.parse(ev.data);
                        if (json.event === 'close') {
                            recorder.onmessage = () => {};
                            recorder.close()
                            const userMediaInputStream = await navigator.mediaDevices.getUserMedia(constraints)
                            userMediaInputStream.getAudioTracks()
                                    .forEach(track => track.stop());
                            worker.terminate();
                            inputStatus.innerHTML = `<span style="color: brown;">CLOSED</span>`;
                            micButton.removeAttribute("disabled");
                            micButton.setAttribute('enabled', '')
                        }
                        
                        if (json.event === 'open') {
                            inputStatus.innerHTML = `<span style="color: green;">OPEN}`;
                            micButton.setAttribute('disabled','')
                            micButton.removeAttribute("enabled");
                            recorder.port.onmessage = (ev) => worker.postMessage(ev.data);
                            recorder.connect(audioContext.destination);
                        }
                    } 
                    
                }

                worker.postMessage(JSON.stringify({ wssUrl })) // Send url parm to the worker
                
            } else if(urlParams.get('webrtc')) {

            } else if(urlParams.get('httpstream')) {

                
            } else {
                const worker = new Worker(`${currentScriptLocation}/httppost-worker.js`);
                worker.postMessage(JSON.stringify({ httpUrl })) // Send url parm to the worker
                recorder.port.onmessage = (ev) => worker.postMessage(ev.data);
                let lastMessage = 'CLOSED';
                inputStatus.innerHTML = `<span style="color: black;">CLOSED</span>`;
                worker.onmessage = async (ev) => {
                    
                    if (typeof ev.data === 'string') {
                        const json = JSON.parse(ev.data);
                        if (json.exit) {
                            recorder.onmessage = () => {};
                            const userMediaInputStream = await navigator.mediaDevices.getUserMedia(constraints)
                            userMediaInputStream.getAudioTracks()
                                    .forEach(track => track.stop());
                            worker.terminate();
                            lastMessage = 'NOT CONNECTED';
                        }
                    } else {
                        const msg = ev.data;
                        if (lastMessage !== msg) {
                            lastMessage = msg;
                            if (lastMessage === 'ok') {
                                inputStatus.innerHTML = `<span style="color: green;">OPEN`;
                                micButton.setAttribute('disabled','')
                                micButton.removeAttribute("enabled");
                            } else {
                                if (parseInt(msg) < 1000) {
                                    console.log('EMPTY', msg)
                                }
                                inputStatus.innerHTML = `<span style="color: green;">Audio Buffer Length: ${msg}</span>`;
                                micButton.removeAttribute("disabled");
                                micButton.setAttribute('enabled','')
                            }
                        }
                    }
                    
                }
                new Promise(res=>setTimeout(()=> {
                    console.log(lastMessage)
                    res()
                },2000))
                // (ev) => { 
                //     fetch(httpUrl, {
                //         method: 'POST',
                //         body: ev.data,
                //         allowHTTP1ForStreamingUpload: true,
                //     }).catch(event=>{
                //         inputStatus.innerHTML = `<span style="color: red;">ERROR: ${JSON.stringify(event)}</span>`;
                //         micButton.removeAttribute("disabled");
                //         micButton.setAttribute('enabled','')
                //     })
                    
                //     // .then((event)=>{
                //     //     inputStatus.innerHTML = `<span style="color: brown;">CLOSED: ${JSON.stringify(event)}</span>`;
                //     //     micButton.removeAttribute("disabled");
                //     //     micButton.setAttribute('enabled', '')
                //     // });
                // }; 
                recorder.connect(audioContext.destination);
            }
            
            
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

customElements.define('microphone-mode', class extends HTMLElement {
    connectedCallback() {
        renderMicMode(this);
    }
})

/**
 * 
 * @param {HTMLElement} el 
 */
export const render = (el) => {
    el.innerHTML = `<microphone-mode></microphone-mode>`;
}