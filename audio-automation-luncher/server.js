const path = require('path');
const express = require('express');
const { createServer: createSecureServer } = require('https');
const { Server: WebSocketServer, Socket } = require('socket.io');

const app = express();
app.get('/favicon.ico', (req) => req.res?.status(204).end());

app.use(express.static('./'));
app.get('/', (req) => req.res?.sendFile(path.join(__dirname, 'index.html')));

const key = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDN+ctDLwQdqXJu5z4ZJU8PRdl2p/MbSplYOOa7pZ7fUuQAdYUXI2uC0DXsN9KhLF/bvS6CpPMc4v6l3yPPrbUaMnYKR1zf/EG8JXYViGKLDGR/kUtIy5DAG6ps25l+oU+EkpEbWKDwGFXrXPpizyea0yNqts3QJJFz/52RE553VWrOuYe73WpGIjTVZYJAs4NaQmaW4rAI9Rwlx72+j+TXPTGJ6AW+WNFaDgNmJ8yVeEhehMWmKHky0hWFrrK8kRqTjVYiZQ0jtEeg0tBXAy5uGa69PZUcdXwFNuHpo3n+B8UceIiUwmdIFDLJUHh0Pw7B0Kyhx9xtVbZ2P1kja/Q9AgMBAAECggEAWbeOQ8s83baq84eh0s4fa6WfHUH2cFLEDFtslRuE4f129oQ53mQ9NhN/CU8fXbi4YDw9AAbdJh3xkUpqjNE66xhDtiJzX9S+xTcEAkkPs0VImRAuXJzehe8HArd8Wl3lBvfYYLLwFuRiuEwde+CDfbqt2JObfigPexlCBqknAw7XZOxqaVwKxqqzS7AwdzAPvt5JMZ2LWJ5uAewA3FNtRCQqwzneYPw8nC90J6krFRx5Qk4AnZpNe2o1S/7FfJq5Rs3bUwDyd6YvzDfzOc/FN7sO1uV5qljuvXDh0+4uzdYPmwAiXtdbzdLFpW930lC+kOfiHURbPjMGfu28/y+DuQKBgQDv6FvHh8kclRA3st0bk1GXbTZax6LvMeR8fO61aq/OY+E0DYfhCXrjnnDlU4cBjZ/LA7amnYa718hN06thqlCnheqSWum7zJc4WdL81u1zzfKUbt82FQ0jNzzSpDtMHwzUDh62fZBtINZ5i4u1+jeHkKsaPaJ9R30lfh0LQ2GNtwKBgQDbysO0a+ju4DXuzPJv5uX+X6zuYKY2ewma50PMXWD6q/PPXCgrNajXgaTmDHttAgClHJwgHQjhMbdt/uv3/SzUG+cU6e8rvby7B0sEyl3gS6wAzTV9d8VjkBVLAi7QOiiu70CSjXw+g7tQ41NSRW+jcbrqW1XP6AAXRjBwO3ANqwKBgQC4FiPWx2qadActtiHTtwc0mqjKn8V2pWId4/+HVYXxaNK1jmxlUVDqt/kI/z7pAjNLJF5TGyz3lmwsy+8F0hpxcWC9TOVtJWAj7UjomkM6SR2KqEi+xwh9rTUOrNaTYoAFd5A5l7/q/PeV7G4YBRf2/htM116HowN0cYD304xXoQKBgEMAGoyDYKyA+K/lFfp6vp2+eK7qE4EEHLd1zDseNBP2GwqZIz2Yy/F1+diO8YkXVS7/+6/mafCMAUisry4XpXS7VMQRU/FXk5LH9FxvfBKFvtc3txiaTDe/kl4dOjwLnp9FG8ARFVDRQ2azBZFMzW1bnAkY8p3AMVbm9Jkh5VSlAoGAWMLLRcWWxvG61YnSvjpdwTbi+nAmfNz+N81uMjTqFON/8YYEuuVC7jGjgTpyv4mWIbU+1MQW8U10rnQCvrCA0k1QCam9zrP5S4gNX6rqzNRm3zDfGGSYoqRMEK+0j6AIgAvV9DJ0rPcz7GA5aFM3ia9oUdmLdf90TPAEy7D75SM=\n-----END PRIVATE KEY-----';
const cert = '-----BEGIN CERTIFICATE-----\nMIIDkzCCAnugAwIBAgIUaxuZYwNCdBsOL8DbYC5vxBnTA3cwDQYJKoZIhvcNAQELBQAwWTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTIxMTEyODA4MjkyMVoXDTIxMTIyODA4MjkyMVowWTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzfnLQy8EHalybuc+GSVPD0XZdqfzG0qZWDjmu6We31LkAHWFFyNrgtA17DfSoSxf270ugqTzHOL+pd8jz621GjJ2Ckdc3/xBvCV2FYhiiwxkf5FLSMuQwBuqbNuZfqFPhJKRG1ig8BhV61z6Ys8nmtMjarbN0CSRc/+dkROed1VqzrmHu91qRiI01WWCQLODWkJmluKwCPUcJce9vo/k1z0xiegFvljRWg4DZifMlXhIXoTFpih5MtIVha6yvJEak41WImUNI7RHoNLQVwMubhmuvT2VHHV8BTbh6aN5/gfFHHiIlMJnSBQyyVB4dD8OwdCsocfcbVW2dj9ZI2v0PQIDAQABo1MwUTAdBgNVHQ4EFgQUH9an2MwjoZAeKtz/x0UkfSrFRfAwHwYDVR0jBBgwFoAUH9an2MwjoZAeKtz/x0UkfSrFRfAwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAm5v8kansSPF/uA5LBqMrNgKgwUdez/AKOgWP8CRVqEomhGc+U6gr0p0gTtNZB73Vtc0Zvag/t0jqRtAJFE61FkCiiouMUw3lGY/NyFLe975eyOo5ay/rNCXUckN29mP+wVdOx6Mo/roK6lxrOts5r5O0F24xwiXqQiXE8JdbGDQ16jst178eUfH74jaItWu74a3kxHMg2qohWg1/gWCjv+okSZ2oaN7IEnxsHQUo6Owurc4EYpw6j5BZXSP4SYVZZLym3COA1qnRtn8eHFrl3GocOz6fohWwK8qC9mZU9FlmCOIe+vInNDuG0yQtk/vskjbop3EetNvCAsr0ubabVQ==\n-----END CERTIFICATE-----';

// ON_HEROKU we use http else https "heroku config:set ON_HEROKU=1 -a <app-name>""
const server = ( process.env.ON_HEROKU 
    ? app 
    : createSecureServer({ key, cert }, app) 
).listen(process.env.PORT || 8080);

const webSocketServer = new WebSocketServer(server);

// stream.broadcast.emit('webrtc'); // to all clients in the current namespace except the sender
// stream.to("room1").emit('webrtc'); // to all clients in room1 except the sende!
// io.to(["room1", "room2"]).except("room3").emit(/* ... */); // to all clients in room1 and/or room2 except those in room3
const WebRTC = webSocketServer.of('/webRTC');
WebRTC.on('connect',  (/** @type {Socket} */ stream) => {
    console.log('connected: ', stream.id);
    stream.on('message', (data) => { console.log(`${stream.id}:message: `, data);  stream.broadcast.emit('message', data); });
});

// @ts-ignore // Detect Running inside NWJS package.json chromium-args insecure https
if (globalThis.nw !== undefined) { 
    
    nw.Window.open( 'https://localhost:8080' /** 'index.html' **/, {}, function(win) {}); 
};