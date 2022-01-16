// initialize your app
const express = require('express');
const ws = require('ws');
const WebSocketServer = ws.WebSocketServer;
const http = require('http');
const createServer = http.createServer;

const httpProxy = require('http-proxy');
const fs = require('fs');
const readFileSync = fs.readFileSync;
//proxy_read_timeout 86400s;
//proxy_send_timeout 86400s;
const app = express();
app.use(express.static('src'));

const server = createServer(app);

//var portAudio = require('naudiodon');

// console.log(portAudio.getDevices());
// console.log(portAudio.getHostAPIs());

// var ao = new portAudio.AudioOutput({
//     channelCount: 2,
//     sampleFormat: portAudio.SampleFormat32Bit,
//     sampleRate: 48000,
//     deviceId : -1, // Use -1 or omit the deviceId to select the default device
//     closeOnError: true
// });

const debug = console.log;
const { Duplex } = require('stream');
const assert = require('assert');
const codes = {
    "DATA": 0,
    "ACK": 1,
    "END": 2
  }

const { DATA, ACK, END } = codes;

class WebSocketStream extends Duplex {
    constructor (socket, options) {
      super(options)
  
      assert(socket, 'You must provide a socket')
  
      this.socket = socket
      socket.binaryType = 'arraybuffer'
  
      // You can provide a socket name for debugging purposes. Shh, that's a secret!
      socket._name = socket._name || Math.random().toString(36).slice(2, 7)
  
      // When the first message is received it becomes true
      this._started = false
  
      this.on('finish', () => {
        debug(`${this.socket._name}: I'm done`)
        this._send(END)
      })
  
      // Buffer data until connection is established
      if (socket.readyState !== socket.OPEN) {
        this.cork()
      }
        
  
      socket.onopen = () => {
        this.emit('open');
        this.uncork();
        
      }
  
      socket.onclose = (code, msg) => {
        this.emit('close', code, msg)
      }
  
      socket.onerror = (err) => {
        debug(`${this.socket._name}: uh oh, error!`)
        this.emit('error', err)
      }
  
      socket.onmessage = (msg) => {
        let data = Buffer.from(msg.data)
        switch (data[0]) {
          case DATA:
            this._started = true
            if (!this.push(data.slice(1))) {
              // Note that this will execute after
              // all callbacks on 'readable' and 'data' events.
              debug(`${this.socket._name}: ouch, I'm full...`)
            }
            break
          case ACK:
            this._cb()
            break
          case END:
            debug(`${this.socket._name}: okay, bye`)
            this.push(null)
            break
          default:
            throw new Error('Unsupported message type')
        }
      }
    }
  
    _writev (chunks, callback) {
      debug(`${this.socket._name}: hey, I'm sending you all buffered data`)
      let chunk = chunks.reduce((prev, next) =>
        Buffer.concat([prev.chunk, next.chunk].filter((b) => b)))
      this._send(DATA, chunk)
      this._cb = callback
    }
  
    _write (chunk, encoding, callback) {
      debug(`${this.socket._name}: hey, I'm sending you data`)
      this._send(DATA, chunk)
      this._cb = callback
    }
  
    _read (size) {
      // Let's not send the first ACK, since it's redundant
      if (this._started) {
        debug(`${this.socket._name}: go ahead, send some more`)
        this._send(ACK)
      }
    }
  
    _send (code, data) {
      if (this.socket.readyState === this.socket.OPEN) {
        let type = Buffer.from([code])
        this.socket.send(data ? Buffer.concat([type, data]) : type)
      }
    }
  }

const inputSocket = new WebSocketServer({ server, path: '/input' });
inputSocket.on('connection', (socket) => {
   // mix with finalOutput so output time - mic input delay time;
   // send it over the broadcast socket.
   // this is only needed when we need to mix the mic into the output on the MainStation
  
   const stream = new WebSocketStream(socket, { highWaterMark: 1024 });
   stream.pipe(ao)
  
//    socket.on('message', function message(data, isBinary) {
  
//     inputSocket.clients.forEach(function each(client) {
//       if (client.readyState === 1) {
//         client.send(data, { binary: isBinary });
//       }
//     });
//   });
//   socket.on('open', ()=> console.log('open'));
//   socket.on('error', (err)=> console.log(err));
//   socket.on('close', (code,reason)=> console.log(code,reason.toString()));
});

inputSocket.on('error',(msg) => console.log(msg))

//server.listen(8080)
server.listen(8009, () => {
  // Create the HTTPS proxy server in front of a HTTP server
  httpProxy.createServer({
    target: 'http://localhost:8009',
    secure: false,
    ws: true,
    ssl: {
      key:  readFileSync('server.key', 'utf8'),
      cert: readFileSync('server.cert', 'utf8')
    }
  }).listen(8080);
})


// and ...

const p = document.createElement('p')
p.innerHTML = ' hi'

document.body.append(p);
const thegui = require('nw.gui');
thegui.App.clearCache()
var win = thegui.Window.get();
// win.on("devtools-opened", function(url) {
//     document.getElementById('devtools').src = url;
// });

win.showDevTools();

// import debug from 'debug'; // NPM
// import { Transform } from 'stream'; // NodeJS >Core or NPM readable-stream

// /**
//  * 
//  * @param {string | function} name as String or debug instance
//  * @returns 
//  */
// export const debugTransform = (name) => {
    
//   let enabled = false;
  
//   try {
//     enabled = !!(process.env.DEBUG || localStorage.debug)
//   } catch (e) {
//     return 
//   }
//   /**
//    * @returns {Transform}
//    */
//   return (...args) => {
//     //var args = arguments.length && Array.prototype.slice.call(arguments)
//     const d = typeof name === 'function' ? name : debug(name) ;
//     const run = args 
//       ? (line='') => d(args.concat(line))
//       : d;
    
//     if (enabled) {
//       return new Transform({
//         transform(chunk, enc, callback) {
//           run(chunk)
//           callback(null, chunk)
//         }
//       });    
//     }
//     // passThrough
//     return new Transform({ transform(chunk, enc, callback) { callback(null, chunk); } });
//   }
  
// }

// export default debugTransform;

