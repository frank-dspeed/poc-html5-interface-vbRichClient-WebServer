var socket = new WebSocket('ws://10.0.0.5:27801/');
async function getMic(){
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
    })
    const $audio = document.getElementById("audio");
    const mediarecorder = new MediaRecorder(stream, {mimeType: "audio/webm; codecs=\"opus\""});
    
    mediarecorder.ondataavailable = function(e) {
    if (e.data && e.data.size > 0) {
        socket.send(e.data);
    }
    }
    mediarecorder.start(1000);

}