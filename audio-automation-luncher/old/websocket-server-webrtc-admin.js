const config = { 
    adminUserName: 'admin', 
    adminPassword: 'admin', 
    socketURL: "/",
    dirPath: "",
    homePage: "/demos/index.html",
    socketMessageEvent: "RTCMultiConnection-Message",
    socketCustomEvent: "RTCMultiConnection-Custom-Message",
    port: "9001",
    enableLogs: "false",
    autoRebootServerOnFailure: "false",
    isUseHTTPs: "false",
    sslKey: "./fake-keys/privatekey.pem",
    sslCert: "./fake-keys/certificate.pem",
    sslCabundle: "",
    enableAdmin: "false", 
};
// webRTC Signaling Server
var listOfUsers = {};
var listOfRooms = {};
/** @type {Socket} */
let adminSocket;
// pushLogs is used to write error logs into logs.json
const pushLogs = console.log;

// const strings
const CONST_STRINGS = {
    ROOM_NOT_AVAILABLE: 'Room not available',
    INVALID_PASSWORD: 'Invalid password',
    USERID_NOT_AVAILABLE: 'User ID does not exist',
    ROOM_PERMISSION_DENIED: 'Room permission denied',
    ROOM_FULL: 'Room full',
    DID_NOT_JOIN_ANY_ROOM: 'Did not join any room yet',
    INVALID_SOCKET: 'Invalid socket',
    PUBLIC_IDENTIFIER_MISSING: 'publicRoomIdentifier is required',
    INVALID_ADMIN_CREDENTIAL: 'Invalid username or password attempted'
};
class WebRealTimeConnection {
    /**
     * 
     * @param {Socket} socket 
     */
    constructor(socket) {
        this.socket = socket;
        this.userName = ''
    }
    get isAdmin() {
        const { socket } = this;
        const params = socket.handshake.query
        const { adminUserName, adminPassword } = config;
        const isAuthorized = params.adminUserName === adminUserName && params.adminPassword === adminPassword;
        return isAuthorized;
    }
    get isAdminAuthorized() {
        const { socket, isAdmin } = this;
        if (!isAdmin) {
            socket.emit('admin', { error: 'Invalid admin username or password.' });

            pushLogs('invalid-admin', {
                message: CONST_STRINGS.INVALID_ADMIN_CREDENTIAL,
                stack: 'name: ' + params.adminUserName + '\n' + 'password: ' + params.adminPassword
            });
    
            socket.disconnect();
        }
        
        return isAdmin;
    }
}

/**
 * 
 * @param {Socket} socket 
 * @param {*} params 
 * @returns 
 */
const isAdminAuthorized = function(socket) {
    const params = socket.handshake.query
    const { adminUserName, adminPassword } = config;
    const isAuthorized = params.adminUserName === adminUserName && params.adminPassword === adminPassword;
    socket.emit('admin', { error: 'Invalid admin username or password.' });

        pushLogs('invalid-admin', {
            message: CONST_STRINGS.INVALID_ADMIN_CREDENTIAL,
            stack: 'name: ' + params.adminUserName + '\n' + 'password: ' + params.adminPassword
        });

    socket.disconnect();
    return isAuthorized;
};

/**
 * Update the Admin interface
 * @param {boolean} all if true it includes listOfRooms[] else empty[]
 */
function sendToAdmin(all=false) {
    if (adminSocket) {
        const users = Object.keys(listOfUsers).map(userid=>{

                var item = listOfUsers[userid];
                if (!item) {
                    return; // maybe user just left?
                }

                if (!item.connectedWith) {
                    item.connectedWith = {};
                }

                if (!item.socket) {
                    item.socket = {};
                }

                return {
                    userid: userid,
                    admininfo: item.socket.admininfo || '',
                    connectedWith: Object.keys(item.connectedWith)
                };

        }).filter(x=>x);

        let scalableBroadcastUsers = 0;
        if(ScalableBroadcast._) {
            scalableBroadcastUsers = ScalableBroadcast._.getUsers();
        }

        adminSocket.emit('admin', {
            newUpdates: !all, // if undefined === true
            listOfRooms: !!all ? listOfRooms : [], // if undefined === false []
            listOfUsers: users.length,
            scalableBroadcastUsers
        });
    }
}

/**
 * 
 * @param {Socket} socket 
 * @param {*} params 
 * @returns 
 */
const handleMissingAdminCredentials = (socket) => {
    const params = socket.handshake.query
    if(!params.adminUserName || !params.adminPassword) {
        socket.emit('admin', {
            error: 'Please pass "adminUserName" and "adminPassword" via socket.io parameters.'
        });
        
        pushLogs('invalid-admin', {
            message: CONST_STRINGS.INVALID_ADMIN_CREDENTIAL,
            stack: 'name: ' + params.adminUserName + '\n' + 'password: ' + params.adminPassword
        });

        socket.disconnect(); //disabled admin
        return true;
    }
}

/**
 * 
 * @param {Socket} socket 
 * @param {*} params 
 * @returns 
 */
function handleAdminSocket(socket) {
    if (handleMissingAdminCredentials(socket)) {
        return
    }
    if (!isAdminAuthorized(socket)) {
        return;
    }

    socket.emit('admin', { connected: true });

    adminSocket = socket;
    
    socket.on('admin', function(message, callback = () => {}) {
        if (!isAdminAuthorized(socket)) {
            socket.emit('admin', {
                error: 'Invalid admin username or password.'
            });
            const params = socket.handshake.query
            pushLogs('invalid-admin', {
                message: CONST_STRINGS.INVALID_ADMIN_CREDENTIAL,
                stack: 'name: ' + params.adminUserName + '\n' + 'password: ' + params.adminPassword
            });

            socket.disconnect();
            return;
        }

        if (message.all === true) { 
            sendToAdmin(true); 
        }

        if (message.userinfo === true && message.userid) {
            listOfUsers[message.userid] 
                ? callback(user.socket.admininfo || {}) 
                : callback({ error: CONST_STRINGS.USERID_NOT_AVAILABLE });
        }

        if (message.clearLogs === true) {
            pushLogs('', '', callback); // last callback parameter will force to clear logs
        }

        if (message.deleteUser === true) {
            try {
                var user = listOfUsers[message.userid]?.socket?.disconnect();   
                // delete listOfUsers[message.userid];
                callback(true);
            } catch (e) {
                pushLogs('deleteUser', e);
                callback(false);
            }
        }

        if (message.deleteRoom === true) {
            try {
                const { roomid } = message;
                const room = listOfRooms[roomid];

                if (room) {
                    const { participants } = room;
                    participants.forEach((userid) => listOfUsers[userid]?.socket.disconnect());
                    delete listOfRooms[roomid];
                }
                callback(true);
            } catch (e) {
                pushLogs('deleteRoom', e);
                callback(false);
            }
        }
    });
}

export default (WebSocketServer) => {
    const adminSockets = WebSocketServer.of('/admin')
    adminSockets.on('connection', (stream) => {

    })
    return adminSockets;
}