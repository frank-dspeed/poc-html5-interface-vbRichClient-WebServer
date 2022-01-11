const arrayBuffer = []
const sampleRate = 8000 // 1 sec === sampleRate
const httpPostData = async data => {
    const response = fetch(httpUrl='https://localhost:8080/audioStream', {
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
    httpPostData(arrayBuffer.splice(0, sampleRate));
}, 1000)

onmessage = function(ev) {
    try {
        postMessage(arrayBuffer.push(...ev.data));
        //httpPostData(ev.data);
    } catch (e) {
        postMessage(JSON.stringify(e))
    }
    //postMessage(workerResult);
}