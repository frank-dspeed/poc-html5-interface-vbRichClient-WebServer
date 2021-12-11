import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer as createSecureServer } from 'https';
//import httpProxy from 'http-proxy';
import { readFileSync, promises } from 'fs';
//proxy_read_timeout 86400s;
//proxy_send_timeout 86400s;
const { writeFile } = promises;

//speaker.write(float32Array())
/* signed: true }); */
  

const app = express();
app.post('/audioStream', (req, res) => {
   console.log(req.headers)
   req.on('data', (chunk) => console.log(chunk))
   req.on('data', (chunk) => console.log(chunk))
   //res.writeHead(200, { 'Content-Type': 'text/plain' });    
})

app.use(express.static('src'));

//const server = createServer(app);
const server = createSecureServer({
   key: readFileSync('server.key'),
   cert: readFileSync('server.cert')
}, app)


const inputSocket = new WebSocketServer({ server, path: '/input' });
inputSocket.on('connection', (audioChannel) => {
   audioChannel.on('message', 
   /**
    * Does Something with the recived Audio
    * @param {Float32Array} data length 128 Float32Array(128)
    * non-interleaved IEEE754 32-bit linear PCM 
    * with a nominal range between -1 and +1, 
    * with each sample between -1.0 and 1.0.
    * the sample rate depends on the audioContext and is variable  
    * @param {boolean} isBinary 
    */
   (data, isBinary) => {
      console.log(data,isBinary)
      /**
       * EXAMPLE 1: Echo the Data without any changes to replay it in the
       * browser. see:
       * src/components/radio-station-interface/client/play-raw-lpcm.js
       */
      //audioChannel.send(data)
      
      /**
       * EXAMPLE 2: Replay it on the local soundcard output
       * note sampleRate comes from the input channel
       * rest is default and should work well
       * see: play-raw.js
       */
      //import Speaker from 'speaker';
      //const speaker = new Speaker({ channels: 1, bitDepth: 32, sampleRate: 8000, float: true });
      //speaker.write(data)

      /**
       * Wite to file in append only mode
       * remember that you need to create a wav header to replay that
       * in higher level software
       * or use the speaker npm package speaker.write(readFileSync('./audio.raw')) 
       * see example above. see: play-raw.js
       */
      writeFile('./audio.raw',data,{ flag: "a+" })
      
      /**
       * Fan Out the Data to all Connections
       * Or Remix the Input of all Connections
       */
      //    inputaudioChannel.clients.forEach(function each(client) {
      //      if (client.readyState === 1) {
      //        client.send(data, { binary: isBinary });
      //      }
      //    });

      // mix with finalOutput so output time - mic input delay time;
      // send it over the broadcast audioChannel.
      // this is only needed when we need to mix the mic into the output on the MainStation
   });
    
   audioChannel.on('error', (err)=> console.log(err));
   audioChannel.on('close', (code,reason)=> console.log(code,reason.toString()));
});

//inputSocket.on('error',(msg) => console.log(msg))


server.listen(8080)

/**
 * alternativ Proxy Implementation
 */

// server.listen(8009)
// // Create the HTTPS proxy server in front of a HTTP server

// httpProxy.createServer({
//    target: {
//      host: 'localhost',
//      port: 8009
//    },
//    secure: false,
//    ws: true,
//    ssl: {
//      key:  readFileSync('server.key', 'utf8'),
//      cert: readFileSync('server.cert', 'utf8')
//    }
//  }).listen(8080);

/*
// Monitors the Radio Output before it gets mixed with the input
const outputSocket = new WebSocketServer({ server, path: '/output' });
outputSocket.on("connection", function(connection, request){
   // Start sending audio output before broadcasting broadcastSocket
   // so play the play list x sec (mic input mix delay) before the broadcast.
   // Allows pre Mixing voice and Audio with correct time in the
   // Main Station Code
});

const apiSocket = new WebSocketServer({ server, path: '/api' });
apiSocket.on("connection", function(connection){
   // commands back and for
   console.log('H')
   console.log(msg);
   apiSocket.send('HI');
});

apiSocket.on('message', (data) => {

})

const broadcastSocket = new WebSocketServer({ server, path: '/broadcast' });
broadcastSocket.on("connection", function(socket, request){
    // The FinalOutput is the mix result of output time - mic input delay time.
    // I think a total roundtrip time of 1 min or 30 sec is total fine.
    // Pre Mixing Processing the Broadcast is required to garantie broadcast time
    // as also garantie that there is sound data even in live mode when it gets disconnected
 socket.on('message', function message(data, isBinary) {
      inputSocket.clients.forEach(function each(client) {
        if (client.readyState === 1) {
          client.send(data, { binary: isBinary });
        }
      });
   });
    socket.on('error', (err)=> console.log(err));
    socket.on('close', (code,reason)=> console.log(code,reason.toString()));
    return false
});
*/

// const channels = {
//    input: new WebSocketServer({ noServer: true }),
//    output: new WebSocketServer({ noServer: true }),
//    broadcast: new WebSocketServer({ noServer: true }),
//    command: new WebSocketServer({ noServer: true }),
// }


// server.on('upgrade', function upgrade(request, socket, head) {
//    const { pathname } = new URL(request.url);
//    const channelName = pathname.split('/').pop(); 
//    if (channelName && channels[channelName]) {
//       const connection = channels[channel]
//       connection.handleUpgrade(request, socket, head, (ws) => {
//          connection.emit('connection', ws, request);
//       });
//    }
   
//    if (pathname === '/input') {
     
//      inputSocket.handleUpgrade(request, socket, head, (ws) => {
//        inputSocket.emit('connection', ws, request);
//      });
   
//    } else if (pathname === '/output') {
//      outputSocket.handleUpgrade(request, socket, head, (ws) => {
//        outputSocket.emit('connection', ws, request);
//      });
//    } else if (pathname === '/api') {
//       apiSocket.handleUpgrade(request, socket, head, (ws) => {
//          apiSocket.emit('connection', ws, request);
//        });
//    } else if (pathname === '/api') {
//       broadcastSocket.handleUpgrade(request, socket, head, (ws) => {
//          broadcastSocket.emit('connection', ws, request);
//       });
//    } else {
//      socket.destroy();
//    }
//  });