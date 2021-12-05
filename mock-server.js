import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'https';
import { readFileSync } from 'fs';
//proxy_read_timeout 86400s;
//proxy_send_timeout 86400s;
const app = express();
app.use(express.static('src'));

const server = createServer({
   key: readFileSync('server.key'),
   cert: readFileSync('server.cert')
 }, app)


const inputSocket = new WebSocketServer({ server, path: '/input' });
inputSocket.on('connection', (socket) => {
   // mix with finalOutput so output time - mic input delay time;
   // send it over the broadcast socket.
   // this is only needed when we need to mix the mic into the output on the MainStation
   socket.on('message', function message(data, isBinary) {
      console.log(data,isBinary)
      socket.send(data)
   //    inputSocket.clients.forEach(function each(client) {
   //      if (client.readyState === 1) {
   //        client.send(data, { binary: isBinary });
   //      }
   //    });
   });
    socket.on('error', (err)=> console.log(err));
    socket.on('close', (code,reason)=> console.log(code,reason.toString()));
    //return false
   // socket.send('done')
   //   console.log('socket2')
   // ! Importent this gets Mixed into the broadcast Output.
});

inputSocket.on('error',(msg) => console.log(msg))
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

server.listen(8080)