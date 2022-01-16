const arrayBuffer = []
const sampleRate = 8000 // 1 sec === sampleRate
const config = {
   // httpUrl: 'https://localhost:8080/audioStream',
};
const httpPostData = async data => {
    const response = fetch(config.httpUrl, {
        method: 'POST',
        body: data,
        allowHTTP1ForStreamingUpload: true,
    }).catch(e => {
        postMessage(JSON.stringify(e))
    }).then(()=>{
        postMessage('ok')
    });
}

setInterval(()=>{
    if (arrayBuffer.length >= sampleRate) {
        console.log('good')
    } else {
        console.log('NOT good', arrayBuffer.length)
        httpPostData();
    }
        httpPostData(arrayBuffer.splice(0, sampleRate));

}, 1000)

onmessage = function(ev) {
    if (!config.httpUrl || typeof ev.data === 'string') {
        if (typeof ev.data === 'string') {
            const json = JSON.parse(ev.data)
            if (json.httpUrl) {
                console.log('httppost-worker.js config.httpUrl:',httpUrl, typeof ev.data)
                config.httpUrl = httpUrl;
            }
        } 
    } else {
        try {
            postMessage(arrayBuffer.push(...ev.data));
            //httpPostData(ev.data);
        } catch (e) {
            postMessage(JSON.stringify(e))
        }
    }
 
}