const instance = {};
onmessage = function(ev) {
    if (!instance.inputSocket || typeof ev.data === 'string') {
        if (typeof ev.data === 'string') {
            const json = JSON.parse(ev.data)
            if (json.wssUrl) {
                console.log('websocket-worker.js config.wssUrl:',wssUrl)
                const inputSocket = new WebSocket(wssUrl);
                inputSocket.onmessage = function (event) { console.log(event);  return false; };
                inputSocket.onopen = function () {
                    postMessage(JSON.stringify({ event: 'open' }))
                    // inputStatus.innerHTML = `<span style="color: green;">OPEN</span>`;
                    // micButton.setAttribute('disabled','')
                    // micButton.removeAttribute("enabled");
                    return false
                }
                
                // Fired when a connection with a WebSocket is closed,
                inputSocket.onclose = function(event) {
                    console.log(event);
                    postMessage(JSON.stringify({ event: 'close' }))
                    // inputStatus.innerHTML = `<span style="color: brown;">CLOSED: ${JSON.stringify(event)}</span>`;
                    // micButton.removeAttribute("disabled");
                    // micButton.setAttribute('enabled', '')
                };
            
                // Fired when a connection with a WebSocket has been closed because of an error,
                inputSocket.onerror = function(event) {
                    console.log(event);
                    postMessage(JSON.stringify({ event }))
                    // inputStatus.innerHTML = `<span style="color: red;">ERROR: ${JSON.stringify(event)}</span>`;
                    // micButton.removeAttribute("disabled");
                    // micButton.setAttribute('enabled','')
                };
                
                instance.inputSocket = inputSocket;
            }
        } 
    } else {
        const { inputSocket } = instance;
        if (inputSocket.readyState === 1) {
            inputSocket.send(ev.data); // sent as byte[128] if sampleRate ~8000 mono
        }
    }
 
}