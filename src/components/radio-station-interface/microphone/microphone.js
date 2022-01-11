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
            if (!httpUrl) {
                const wssUrl = urlParams.get('wss') || `wss://${window.location.host}/input`
                console.log(`Using: ${wssUrl}`)
                
                const inputSocket = new WebSocket(wssUrl);
    
                inputSocket.onmessage = function (event) { console.log(event);  return false; };
                inputSocket.onopen = function () {
                    inputStatus.innerHTML = `<span style="color: green;">OPEN</span>`;
                    micButton.setAttribute('disabled','')
                    micButton.removeAttribute("enabled");
                    return false
                }
                
                // Fired when a connection with a WebSocket is closed,
                inputSocket.onclose = function(event) {
                    inputStatus.innerHTML = `<span style="color: brown;">CLOSED: ${JSON.stringify(event)}</span>`;
                    micButton.removeAttribute("disabled");
                    micButton.setAttribute('enabled', '')
                    return false
                };
            
                // Fired when a connection with a WebSocket has been closed because of an error,
                inputSocket.onerror = function(event) {
                    inputStatus.innerHTML = `<span style="color: red;">ERROR: ${JSON.stringify(event)}</span>`;
                    micButton.removeAttribute("disabled");
                    micButton.setAttribute('enabled','')
                    return false
                };
                // @ts-ignore
                recorder.port.onmessage = (ev) => { 
                    const constants = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
                    if (inputSocket.readyState === 1) {
                        inputSocket.send(ev.data); // sent as byte[512]
                    }        
                }; 
            } else if(urlParams.get('stream')) {
                /**
                 * Http2 Stream example
                 */
                const stream = new ReadableStream({
                    start(controller) {
                      // Die folgende Funktion behandelt jeden Daten-Chunk
                      // @ts-ignore
                      recorder.port.onmessage = (ev) => { 
                            controller.close();
                            controller.enqueue(ev.data);
                      }; 
                      
                    }
                  });

                const { readable, writable } = new TransformStream();
                const inputSocket = writable.getWriter();
                
                const responsePromise = fetch(httpUrl, {
                    method: 'POST',
                    body: readable,
                    allowHTTP1ForStreamingUpload: true,
                }).catch(event=>{
                    inputStatus.innerHTML = `<span style="color: red;">ERROR: ${JSON.stringify(event)}</span>`;
                    micButton.removeAttribute("disabled");
                    micButton.setAttribute('enabled','')
                }).then((event)=>{
                    inputStatus.innerHTML = `<span style="color: brown;">CLOSED: ${JSON.stringify(event)}</span>`;
                    micButton.removeAttribute("disabled");
                    micButton.setAttribute('enabled', '')
                });
                
            } else {
                const worker = new Worker(`${currentScriptLocation}/httppost-worker.js`);
                recorder.port.onmessage = (ev) => worker.postMessage(ev.data);
                let lastMessage = 'NOT CONNECTED';
                inputStatus.innerHTML = `<span style="color: black;">${lastMessage}</span>`;
                worker.onmessage = (ev) => {
                    const msg = ev.data;
                    if (lastMessage !== msg) {
                        lastMessage = msg;
                        if (lastMessage === 'ok') {
                            inputStatus.innerHTML = `<span style="color: green;">${lastMessage}`;
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
                
            }
            
            recorder.connect(audioContext.destination);
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