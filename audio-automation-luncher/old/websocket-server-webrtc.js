import { userInfo } from "os";
import { Socket } from "socket.io";


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


/**
 * 
 * @param {Socket} socket 
 */
function appendUser(socket) {
    try {
        const params = socket.handshake.query;
        const extra = params.extra 
            ? (typeof params.extra === 'string') 
                ? JSON.parse(params.extra)
                : params.extra
            : undefined;

        listOfUsers[socket.userid] = {
            socket: socket,
            connectedWith: {},
            extra: extra || {},
            admininfo: {},
            socketMessageEvent: params.socketMessageEvent || '',
            socketCustomEvent: params.socketCustomEvent || ''
        };
    } catch (e) {
        pushLogs('appendUser', e);
    }


}

const scalableBroadcastUsers = {};

class scaleAbleBroadcastUser {
    /**
     * 
     * @param {scaleAbleBroadcastUser} user
     * 
     */
    constructor(user) {
        /** @type {string} */
        this.userid = user.userid; // the socket.id or userSupplyed
        /** @type {string} */
        this.broadcastId = user.broadcastId; // matches a other user.userId 
        /** @type {number} */
        this.maxRelayLimitPerUser = user.maxRelayLimitPerUser;
        /** @type {{ audio: boolean, video: boolean}} */
        this.typeOfStreams = user.typeOfStreams || { audio: true, video: true};
        /** @type {WebSocket} */
        this.socket = user.socket;
        /** @type {boolean} */
        this.isBroadcastInitiator = user.isBroadcastInitiator || false;
        this.relayReceivers = user.relayReceivers || [];
        /** @type {string|null} */
        this.receivingFrom = user.receivingFrom || null;
        /** @type {boolean} */
        this.canRelay = user.canRelay || false;
    }
}

class Broadcast {
    constructor(socket, broadcastId) {
        // Creates a Broadcast 
        socket.join(`broadcast::${broadcastId}`);
        this.socket = socket;
    }
}

class BroadCastListner {
    constructor(socket, broadcastId) {
        // Creates a Broadcast 
        socket.join(`listener::${broadcastId}`);
    }
}

function ScalableBroadcast(socket, maxRelayLimitPerUser = 2) {

    try {
        maxRelayLimitPerUser = parseInt(maxRelayLimitPerUser) || 2;
    } catch (e) {
        maxRelayLimitPerUser = 2;
    }

    socket.on('join-broadcast', 
    /**
     * 
     * @param {scaleAbleBroadcastUser} user 
     * @returns 
     */
    function(user) {
        try {
            if (!scalableBroadcastUsers[user.userid]) {
                socket.userid = user.userid;
                socket.isScalableBroadcastSocket = true;

                scalableBroadcastUsers[user.userid] = new scaleAbleBroadcastUser({
                    userid: user.userid,
                    broadcastId: user.broadcastId,
                    isBroadcastInitiator: false,
                    maxRelayLimitPerUser: maxRelayLimitPerUser,
                    relayReceivers: [],
                    receivingFrom: null,
                    canRelay: false,
                    typeOfStreams: user.typeOfStreams || {
                        audio: true,
                        video: true
                    },
                    socket: socket
                });
                
                notifyBroadcasterAboutNumberOfViewers(user.broadcastId);
            }

            var relayUser = getFirstAvailableBroadcaster(user.broadcastId, maxRelayLimitPerUser);

            if (relayUser === 'ask-him-rejoin') {
                socket.emit('rejoin-broadcast', user.broadcastId);
                return;
            }

            if (relayUser && user.userid !== user.broadcastId) {
                var hintsToJoinBroadcast = {
                    typeOfStreams: relayUser.typeOfStreams,
                    userid: relayUser.userid,
                    broadcastId: relayUser.broadcastId
                };

                scalableBroadcastUsers[user.userid].receivingFrom = relayUser.userid;
                scalableBroadcastUsers[relayUser.userid].relayReceivers.push(
                    scalableBroadcastUsers[user.userid]
                );
                scalableBroadcastUsers[user.broadcastId].lastRelayuserid = relayUser.userid;

                socket.emit('join-broadcaster', hintsToJoinBroadcast);

                // logs for current socket
                socket.emit('logs', 'You <' + user.userid + '> are getting data/stream from <' + relayUser.userid + '>');

                // logs for target relaying user
                relayUser.socket.emit('logs', 'You <' + relayUser.userid + '>' + ' are now relaying/forwarding data/stream to <' + user.userid + '>');
            } else {
                scalableBroadcastUsers[user.userid].isBroadcastInitiator = true;
                socket.emit('start-broadcasting', scalableBroadcastUsers[user.userid].typeOfStreams);

                // logs to tell he is now broadcast initiator
                socket.emit('logs', 'You <' + user.userid + '> are now serving the broadcast.');
            }
        } catch (e) {
            pushLogs('join-broadcast', e);
        }
    });

    socket.on('scalable-broadcast-message', function(message) {
        socket.broadcast.emit('scalable-broadcast-message', message);
    });

    socket.on('can-relay-broadcast', function() {
        if (scalableBroadcastUsers[socket.userid]) {
            scalableBroadcastUsers[socket.userid].canRelay = true;
        }
    });

    socket.on('can-not-relay-broadcast', function() {
        if (scalableBroadcastUsers[socket.userid]) {
            scalableBroadcastUsers[socket.userid].canRelay = false;
        }
    });

    socket.on('check-broadcast-presence', function(userid, callback) {
        // we can pass number of viewers as well
        try {
            callback(!!scalableBroadcastUsers[userid] && scalableBroadcastUsers[userid].isBroadcastInitiator === true);
        } catch (e) {
            pushLogs('check-broadcast-presence', e);
        }
    });

    socket.on('get-number-of-users-in-specific-broadcast', function(broadcastId, callback) {
        try {
            if (!broadcastId || !callback) return;

            if (!scalableBroadcastUsers[broadcastId]) {
                callback(0);
                return;
            }

            callback(getNumberOfBroadcastViewers(broadcastId));
        } catch (e) {}
    });

    function getNumberOfBroadcastViewers(broadcastId) {
        try {
            var numberOfUsers = 0;
            Object.keys(scalableBroadcastUsers).forEach(function(uid) {
                var user = scalableBroadcastUsers[uid];
                if (user.broadcastId === broadcastId) {
                    numberOfUsers++;
                }
            });
            return numberOfUsers - 1;
        } catch (e) {
            return 0;
        }
    }

    function notifyBroadcasterAboutNumberOfViewers(broadcastId, userLeft) {
        try {
            if (!broadcastId || !scalableBroadcastUsers[broadcastId] || !scalableBroadcastUsers[broadcastId].socket) return;
            var numberOfBroadcastViewers = getNumberOfBroadcastViewers(broadcastId);

            if (userLeft === true) {
                numberOfBroadcastViewers--;
            }

            scalableBroadcastUsers[broadcastId].socket.emit('number-of-broadcast-viewers-updated', {
                numberOfBroadcastViewers: numberOfBroadcastViewers,
                broadcastId: broadcastId
            });
        } catch (e) {}
    }

    // ScaleableBroadcastDisconnect tearDown
    socket.ondisconnect = function() {
        try {
            if (!socket.isScalableBroadcastSocket) {
                return;
            }

            var user = scalableBroadcastUsers[socket.userid];

            if (!user) return;

            if (user.isBroadcastInitiator === false) {
                notifyBroadcasterAboutNumberOfViewers(user.broadcastId, true);
            }

            if (user.isBroadcastInitiator === true) {
                // need to stop entire broadcast?
                for (var n in scalableBroadcastUsers) {
                    var _user = scalableBroadcastUsers[n];

                    if (_user.broadcastId === user.broadcastId) {
                        _user.socket.emit('broadcast-stopped', user.broadcastId);
                    }
                }

                delete scalableBroadcastUsers[socket.userid];
                return;
            }

            if (user.receivingFrom || user.isBroadcastInitiator === true) {
                var parentUser = scalableBroadcastUsers[user.receivingFrom];

                if (parentUser) {
                    var newArray = [];
                    parentUser.relayReceivers.forEach(function(n) {
                        if (n.userid !== user.userid) {
                            newArray.push(n);
                        }
                    });
                    scalableBroadcastUsers[user.receivingFrom].relayReceivers = newArray;
                }
            }

            if (user.relayReceivers.length && user.isBroadcastInitiator === false) {
                askNestedUsersToRejoin(user.relayReceivers);
            }

            delete scalableBroadcastUsers[socket.userid];
        } catch (e) {
            pushLogs('scalable-broadcast-disconnect', e);
        }
    };
    
    return {
        getUsers: () => Object.keys(scalableBroadcastUsers)
            .map((userid) => scalableBroadcastUsers[userid])
            .filter(x=>x) // Filters out undefined
            .map((user) => ({ 
                ...user, 
                relayReceivers: user.relayReceivers
                    .map(({ userid }) => userid), 
            })),
    };
};

function askNestedUsersToRejoin(relayReceivers) {
    try {
        relayReceivers.forEach(function(receiver) {
            if (!!scalableBroadcastUsers[receiver.userid]) {
                scalableBroadcastUsers[receiver.userid].canRelay = false;
                scalableBroadcastUsers[receiver.userid].receivingFrom = null;
                receiver.socket.emit('rejoin-broadcast', receiver.broadcastId);
            }

        });
    } catch (e) {
        pushLogs('askNestedUsersToRejoin', e);
    }
}

function getFirstAvailableBroadcaster(broadcastId, maxRelayLimitPerUser) {
    try {
        var broadcastInitiator = scalableBroadcastUsers[broadcastId];

        // if initiator is capable to receive users
        if (broadcastInitiator && broadcastInitiator.relayReceivers.length < maxRelayLimitPerUser) {
            return broadcastInitiator;
        }

        // otherwise if initiator knows who is current relaying user
        if (broadcastInitiator && broadcastInitiator.lastRelayuserid) {
            var lastRelayUser = scalableBroadcastUsers[broadcastInitiator.lastRelayuserid];
            if (lastRelayUser && lastRelayUser.relayReceivers.length < maxRelayLimitPerUser) {
                return lastRelayUser;
            }
        }

        // otherwise, search for a user who not relayed anything yet
        // todo: why we're using "for-loop" here? it is not safe.
        var userFound;
        for (var n in scalableBroadcastUsers) {
            var user = scalableBroadcastUsers[n];

            if (userFound) {
                continue;
            } else if (user.broadcastId === broadcastId) {
                // if (!user.relayReceivers.length && user.canRelay === true) {
                if (user.relayReceivers.length < maxRelayLimitPerUser && user.canRelay === true) {
                    userFound = user;
                }
            }
        }

        if (userFound) {
            return userFound;
        }

        // need to increase "maxRelayLimitPerUser" in this situation
        // so that each relaying user can distribute the bandwidth
        return broadcastInitiator;
    } catch (e) {
        pushLogs('getFirstAvailableBroadcaster', e);
    }
}

const socketWebRTC = new WeakMap();
/**
 * Create a WebRTC SessionId Via Param 
 * the session id stays (broadcasterId)
 * broadcaster and clients join the broadcast id
 */
inputWebRTC.on('connection', (/** @type {Socket} */socket) => {
    

    
    // Read Params and map users TODO: Replace with socket.io room and namespace logic
    //onConnection(socket);

    // to secure your socket.io usage: (via: docs/tips-tricks.md)
    // io.set('origins', 'https://domain.com');
    
    //function onConnection(socket) {
    const params = socket.handshake.query;

    if(!params.userid) {
        params.userid = (Math.random() * 100).toString().replace('.', '');
    }

    if(!params.sessionid) {
        params.sessionid = (Math.random() * 100).toString().replace('.', '');
    }

    if (params.extra) {
        try {
            params.extra = JSON.parse(params.extra);
        } catch (e) {
            params.extra = {};
        }
    } else {
        params.extra = {};
    }

    // for admin's record
    params.socketMessageEvent = params.msgEvent || 'RTCMultiConnection-Message';
    var socketMessageEvent = params.socketMessageEvent;
    var autoCloseEntireSession = params.autoCloseEntireSession === true;
    var sessionid = params.sessionid;
    var maxParticipantsAllowed = parseInt(params.maxParticipantsAllowed || 1000) || 1000;
    var enableScalableBroadcast = params.enableScalableBroadcast === true;

    // do not allow to override userid
    if (!!listOfUsers[params.userid]) {
        var useridAlreadyTaken = params.userid;
        params.userid = (Math.random() * 1000).toString().replace('.', '');
        socket.emit('userid-already-taken', useridAlreadyTaken, params.userid);
        return;
    }

    //socket.userid = params.userid;
    const userid = params.userid;

    if (userid === config.adminUserName) {
        handleAdminSocket(socket);
        return;
    }

    if (enableScalableBroadcast === true) {
        try {
            ScalableBroadcast._ = ScalableBroadcast(socket, params.maxRelayLimitPerUser);
        } catch (e) {
            pushLogs('ScalableBroadcast', e);
        }
    }
    appendUser(socket);
    sendToAdmin();
    socket.on('extra-data-updated', (extra) => {
        try {
            if (!listOfUsers[socket.userid]) return;

            if (listOfUsers[socket.userid].socket.admininfo) {
                listOfUsers[socket.userid].socket.admininfo.extra = extra;
            }

            // todo: use "admininfo.extra" instead of below one
            listOfUsers[socket.userid].extra = extra;

            try {
                for (var user in listOfUsers[socket.userid].connectedWith) {
                    try {
                        listOfUsers[user].socket.emit('extra-data-updated', socket.userid, extra);
                    } catch (e) {
                        pushLogs('extra-data-updated.connectedWith', e);
                    }
                }
            } catch (e) {
                pushLogs('extra-data-updated.connectedWith', e);
            }

            // sent alert to all room participants
            if (!socket.admininfo) {
                sendToAdmin();
                return;
            }

            var roomid = socket.admininfo.sessionid;
            if (roomid && listOfRooms[roomid]) {
                if (socket.userid == listOfRooms[roomid].owner) {
                    // room's extra must match owner's extra
                    listOfRooms[roomid].extra = extra;
                }
                listOfRooms[roomid].participants.forEach(function(pid) {
                    try {
                        var user = listOfUsers[pid];
                        if (!user) {
                            // todo: remove this user from participants list
                            return;
                        }

                        user.socket.emit('extra-data-updated', socket.userid, extra);
                    } catch (e) {
                        pushLogs('extra-data-updated.participants', e);
                    }
                });
            }

            sendToAdmin();
        } catch (e) {
            pushLogs('extra-data-updated', e);
        }
    });

    socket.on('get-remote-user-extra-data', function(remoteUserId, callback) {
        callback = callback || function() {};
        if (!remoteUserId || !listOfUsers[remoteUserId]) {
            callback(CONST_STRINGS.USERID_NOT_AVAILABLE);
            return;
        }
        callback(listOfUsers[remoteUserId].extra);
    });

    var dontDuplicateListeners = {};
    socket.on('set-custom-socket-event-listener', function(customEvent) {
        if (dontDuplicateListeners[customEvent]) return;
        dontDuplicateListeners[customEvent] = customEvent;

        socket.on(customEvent, function(message) {
            try {
                socket.broadcast.emit(customEvent, message);
            } catch (e) {}
        });
    });

    socket.on('changed-uuid', function(newUserId, callback) {
        callback = callback || function() {};

        try {
            const isCurrentSocket = listOfUsers[userid] && listOfUsers[userid].socket === socket;
            if (isCurrentSocket) {
                if (newUserId === userid) {
                    return
                };

                // do not allow to override userid
                if (!!listOfUsers[newUserId]) {
                    const useridAlreadyTaken = newUserId;
                    newUserId = (Math.random() * 1000).toString().replace('.', '');
                    socket.emit('userid-already-taken', useridAlreadyTaken, newUserId);
                    return;
                }



                var oldUserId = userid;
                listOfUsers[newUserId] = listOfUsers[oldUserId];
                delete listOfUsers[oldUserId];

                userid = newUserId;

                if (userid === config.adminUserName) {
                    handleAdminSocket(socket);
                }

                callback();
                return;
            }

            socket.userid = newUserId;
            appendUser(socket);
            sendToAdmin();
            callback();
        } catch (e) {
            pushLogs('changed-uuid', e);
        }
    });

    socket.on('set-password', function(password, callback) {
        try {
            callback = callback || function() {};

            if (!socket.admininfo) {
                callback(null, null, CONST_STRINGS.DID_NOT_JOIN_ANY_ROOM);
                return;
            }

            var roomid = socket.admininfo.sessionid;

            if (listOfRooms[roomid] && listOfRooms[roomid].owner == socket.userid) {
                listOfRooms[roomid].password = password;
                callback(true, roomid, null);
            }
            else {
                callback(false, roomid, CONST_STRINGS.ROOM_PERMISSION_DENIED);
            }
        } catch (e) {
            pushLogs('set-password', e);
        }
    });

    socket.on('disconnect-with', function(remoteUserId, callback) {
        try {
            if (listOfUsers[socket.userid] && listOfUsers[socket.userid].connectedWith[remoteUserId]) {
                delete listOfUsers[socket.userid].connectedWith[remoteUserId];
                socket.emit('user-disconnected', remoteUserId);
                sendToAdmin();
            }

            if (!listOfUsers[remoteUserId]) return callback();

            if (listOfUsers[remoteUserId].connectedWith[socket.userid]) {
                delete listOfUsers[remoteUserId].connectedWith[socket.userid];
                listOfUsers[remoteUserId].socket.emit('user-disconnected', socket.userid);
                sendToAdmin();
            }
            callback();
        } catch (e) {
            pushLogs('disconnect-with', e);
        }
    });

    socket.on('close-entire-session', function(callback) {
        try {
            if(!callback || typeof callback !== 'function') {
                callback = function() {};
            }

            var user = listOfUsers[socket.userid];

            if(!user) return callback(false, CONST_STRINGS.USERID_NOT_AVAILABLE);
            if(!user.roomid) return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
            if(!socket.admininfo) return callback(false, CONST_STRINGS.INVALID_SOCKET);

            var room = listOfRooms[user.roomid];
            if(!room) return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
            if(room.owner !== user.userid) return callback(false, CONST_STRINGS.ROOM_PERMISSION_DENIED);
            
            autoCloseEntireSession = true;
            closeOrShiftRoom();

            callback(true);
        } catch (e) {
            pushLogs('close-entire-session', e);
        }
    });

    socket.on('check-presence', function(roomid, callback) {
        try {
            if (!listOfRooms[roomid] || !listOfRooms[roomid].participants.length) {
                callback(false, roomid, {
                    _room: {
                        isFull: false,
                        isPasswordProtected: false
                    }
                });
            } else {
                var extra = listOfRooms[roomid].extra;
                if(typeof extra !== 'object' || !extra) {
                    extra = {
                        value: extra
                    };
                }
                extra._room = {
                    isFull: listOfRooms[roomid].participants.length >= listOfRooms[roomid].maxParticipantsAllowed,
                    isPasswordProtected: listOfRooms[roomid].password && listOfRooms[roomid].password.toString().replace(/ /g, '').length
                };
                callback(true, roomid, extra);
            }
        } catch (e) {
            pushLogs('check-presence', e);
        }
    });

    function onMessageCallback(message) {
        try {
            if (!listOfUsers[message.sender]) {
                socket.emit('user-not-found', message.sender);
                return;
            }

            // we don't need "connectedWith" anymore
            // todo: remove all these redundant codes
            // fire "onUserStatusChanged" for room-participants instead of individual users
            // rename "user-connected" to "user-status-changed"
            if (!message.message.userLeft && !listOfUsers[message.sender].connectedWith[message.remoteUserId] && !!listOfUsers[message.remoteUserId]) {
                listOfUsers[message.sender].connectedWith[message.remoteUserId] = listOfUsers[message.remoteUserId].socket;
                listOfUsers[message.sender].socket.emit('user-connected', message.remoteUserId);

                if (!listOfUsers[message.remoteUserId]) {
                    listOfUsers[message.remoteUserId] = {
                        socket: null,
                        connectedWith: {},
                        extra: {},
                        admininfo: {}
                    };
                }

                listOfUsers[message.remoteUserId].connectedWith[message.sender] = socket;

                if (listOfUsers[message.remoteUserId].socket) {
                    listOfUsers[message.remoteUserId].socket.emit('user-connected', message.sender);
                }

                sendToAdmin();
            }

            if (listOfUsers[message.sender] && listOfUsers[message.sender].connectedWith[message.remoteUserId] && listOfUsers[socket.userid]) {
                message.extra = listOfUsers[socket.userid].extra;
                listOfUsers[message.sender].connectedWith[message.remoteUserId].emit(socketMessageEvent, message);

                sendToAdmin();
            }
        } catch (e) {
            pushLogs('onMessageCallback', e);
        }
    }

    function joinARoom(message) {
        try {
            if (!socket.admininfo || !socket.admininfo.sessionid) return;

            // var roomid = message.remoteUserId;
            var roomid = socket.admininfo.sessionid;

            if (!listOfRooms[roomid]) return; // find a solution?

            if (listOfRooms[roomid].participants.length >= listOfRooms[roomid].maxParticipantsAllowed && listOfRooms[roomid].participants.indexOf(socket.userid) === -1) {
                // room is full
                // todo: how to tell user that room is full?
                // do not fire "room-full" event
                // find something else
                return;
            }

            if (listOfRooms[roomid].session && (listOfRooms[roomid].session.oneway === true || listOfRooms[roomid].session.broadcast === true)) {
                var owner = listOfRooms[roomid].owner;
                if (listOfUsers[owner]) {
                    message.remoteUserId = owner;

                    if (enableScalableBroadcast === false) {
                        // only send to owner i.e. only connect with room owner
                        listOfUsers[owner].socket.emit(socketMessageEvent, message);
                    }
                }
                return;
            }

            // redundant?
            // appendToRoom(roomid, socket.userid);

            if (enableScalableBroadcast === false) {
                // connect with all participants
                listOfRooms[roomid].participants.forEach(function(pid) {
                    if (pid === socket.userid || !listOfUsers[pid]) return;

                    var user = listOfUsers[pid];
                    message.remoteUserId = pid;
                    user.socket.emit(socketMessageEvent, message);
                });
            }
        } catch (e) {
            pushLogs('joinARoom', e);
        }

        sendToAdmin();
    }

    function appendToRoom(roomid, userid) {
        try {
            if (!listOfRooms[roomid]) {
                listOfRooms[roomid] = {
                    maxParticipantsAllowed: parseInt(params.maxParticipantsAllowed || 1000) || 1000,
                    owner: userid, // this can change if owner leaves and if control shifts
                    participants: [userid],
                    extra: {}, // usually owner's extra-data
                    socketMessageEvent: '',
                    socketCustomEvent: '',
                    identifier: '',
                    session: {
                        audio: true,
                        video: true
                    }
                };
            }

            if (listOfRooms[roomid].participants.indexOf(userid) !== -1) return;
            listOfRooms[roomid].participants.push(userid);
        } catch (e) {
            pushLogs('appendToRoom', e);
        }
    }

    function closeOrShiftRoom() {
        try {
            if (!socket.admininfo) {
                return;
            }

            var roomid = socket.admininfo.sessionid;

            if (roomid && listOfRooms[roomid]) {
                if (socket.userid === listOfRooms[roomid].owner) {
                    if (autoCloseEntireSession === false && listOfRooms[roomid].participants.length > 1) {
                        var firstParticipant;
                        listOfRooms[roomid].participants.forEach(function(pid) {
                            if (firstParticipant || pid === socket.userid) return;
                            if (!listOfUsers[pid]) return;
                            firstParticipant = listOfUsers[pid];
                        });

                        if (firstParticipant) {
                            // reset owner priviliges
                            listOfRooms[roomid].owner = firstParticipant.socket.userid;

                            // redundant?
                            firstParticipant.socket.emit('set-isInitiator-true', roomid);

                            // remove from room's participants list
                            var newParticipantsList = [];
                            listOfRooms[roomid].participants.forEach(function(pid) {
                                if (pid != socket.userid) {
                                    newParticipantsList.push(pid);
                                }
                            });
                            listOfRooms[roomid].participants = newParticipantsList;
                        } else {
                            delete listOfRooms[roomid];
                        }
                    } else {
                        delete listOfRooms[roomid];
                    }
                } else {
                    var newParticipantsList = [];
                    listOfRooms[roomid].participants.forEach(function(pid) {
                        if (pid && pid != socket.userid && listOfUsers[pid]) {
                            newParticipantsList.push(pid);
                        }
                    });
                    listOfRooms[roomid].participants = newParticipantsList;
                }
            }
        } catch (e) {
            pushLogs('closeOrShiftRoom', e);
        }
    }

    socket.on(socketMessageEvent, function(message, callback) {
        if (message.remoteUserId && message.remoteUserId === socket.userid) {
            // remoteUserId MUST be unique
            return;
        }

        try {
            if (message.remoteUserId && message.remoteUserId != 'system' && message.message.newParticipationRequest) {
                if (enableScalableBroadcast === true) {
                    var user = listOfUsers[message.remoteUserId];
                    if (user) {
                        user.socket.emit(socketMessageEvent, message);
                    }

                    if (listOfUsers[socket.userid] && listOfUsers[socket.userid].extra.broadcastId) {
                        // for /admin/ page
                        appendToRoom(listOfUsers[socket.userid].extra.broadcastId, socket.userid);
                    }
                } else if (listOfRooms[message.remoteUserId]) {
                    joinARoom(message);
                    return;
                }
            }

            // for v3 backward compatibility; >v3.3.3 no more uses below block
            if (message.remoteUserId == 'system') {
                if (message.message.detectPresence) {
                    if (message.message.userid === socket.userid) {
                        callback(false, socket.userid);
                        return;
                    }

                    callback(!!listOfUsers[message.message.userid], message.message.userid);
                    return;
                }
            }

            if (!listOfUsers[message.sender]) {
                listOfUsers[message.sender] = {
                    socket: socket,
                    connectedWith: {},
                    extra: {},
                    admininfo: {}
                };
            }

            // if someone tries to join a person who is absent
            // -------------------------------------- DISABLED
            if (false && message.message.newParticipationRequest) {
                var waitFor = 60 * 10; // 10 minutes
                var invokedTimes = 0;
                (function repeater() {
                    if (typeof socket == 'undefined' || !listOfUsers[socket.userid]) {
                        return;
                    }

                    invokedTimes++;
                    if (invokedTimes > waitFor) {
                        socket.emit('user-not-found', message.remoteUserId);
                        return;
                    }

                    // if user just come online
                    if (listOfUsers[message.remoteUserId] && listOfUsers[message.remoteUserId].socket) {
                        joinARoom(message);
                        return;
                    }

                    setTimeout(repeater, 1000);
                })();

                return;
            }

            onMessageCallback(message);
        } catch (e) {
            pushLogs('on-socketMessageEvent', e);
        }
    });

    socket.on('is-valid-password', function(password, roomid, callback) {
        try {
            callback = callback || function() {};
            
            if(!password || !password.toString().replace(/ /g, '').length) {
                callback(false, roomid, 'You did not enter the password.');
                return;
            }

            if(!roomid || !roomid.toString().replace(/ /g, '').length) {
                callback(false, roomid, 'You did not enter the room-id.');
                return;
            }

            if(!listOfRooms[roomid]) {
                callback(false, roomid, CONST_STRINGS.ROOM_NOT_AVAILABLE);
                return;
            }

            if(!listOfRooms[roomid].password) {
                callback(false, roomid, 'This room do not have any password.');
                return;
            }

            if(listOfRooms[roomid].password === password) {
                callback(true, roomid, false);
            }
            else {
                callback(false, roomid, CONST_STRINGS.INVALID_PASSWORD);
            }
        }
        catch(e) {
            pushLogs('is-valid-password', e);
        }
    });

    socket.on('get-public-rooms', function(identifier, callback) {
        try {
            if(!identifier || !identifier.replace(/ /g, '').length) {
                callback(null, CONST_STRINGS.PUBLIC_IDENTIFIER_MISSING);
                return;
            }
            
            callback(Object.keys(listOfRooms)
                .filter(key =>
                    listOfRooms[key] 
                        && (listOfRooms[key] 
                        && listOfRooms[key].identifier 
                        && listOfRooms[key].identifier === identifier)
                ).map(key=>{
                    const room = listOfRooms[key];
                    return {
                        maxParticipantsAllowed: room.maxParticipantsAllowed,
                        owner: room.owner,
                        participants: room.participants,
                        extra: room.extra,
                        session: room.session,
                        sessionid: key,
                        isRoomFull: room.participants.length >= room.maxParticipantsAllowed,
                        isPasswordProtected: !!room.password && room.password.replace(/ /g, '').length > 0
                    };
                }));
            } catch(e) {
                pushLogs('get-public-rooms', e);
            }
        });

    socket.on('open-room', function(arg, callback) {
        callback = callback || function() {};

        try {
            // if already joined a room, either leave or close it
            closeOrShiftRoom();

            if (listOfRooms[arg.sessionid] && listOfRooms[arg.sessionid].participants.length) {
                callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
                return;
            }

            if (enableScalableBroadcast === true) {
                arg.session.scalable = true;
                arg.sessionid = arg.extra.broadcastId;
            }

            // maybe redundant?
            if (!listOfUsers[socket.userid]) {
                listOfUsers[socket.userid] = {
                    socket: socket,
                    connectedWith: {},
                    extra: arg.extra,
                    admininfo: {},
                    socketMessageEvent: params.socketMessageEvent || '',
                    socketCustomEvent: params.socketCustomEvent || ''
                };
            }
            listOfUsers[socket.userid].extra = arg.extra;

            if (arg.session && (arg.session.oneway === true || arg.session.broadcast === true)) {
                autoCloseEntireSession = true;
            }
        } catch (e) {
            pushLogs('open-room', e);
        }

        // append this user into participants list
        appendToRoom(arg.sessionid, socket.userid);

        try {
            // override owner & session
            if (enableScalableBroadcast === true) {
                if (Object.keys(listOfRooms[arg.sessionid]).length == 1) {
                    listOfRooms[arg.sessionid].owner = socket.userid;
                    listOfRooms[arg.sessionid].session = arg.session;
                }
            } else {
                // for non-scalable-broadcast demos
                listOfRooms[arg.sessionid].owner = socket.userid;
                listOfRooms[arg.sessionid].session = arg.session;
                listOfRooms[arg.sessionid].extra = arg.extra || {};
                listOfRooms[arg.sessionid].socketMessageEvent = listOfUsers[socket.userid].socketMessageEvent;
                listOfRooms[arg.sessionid].socketCustomEvent = listOfUsers[socket.userid].socketCustomEvent;
                listOfRooms[arg.sessionid].maxParticipantsAllowed = parseInt(params.maxParticipantsAllowed || 1000) || 1000;

                if(arg.identifier && arg.identifier.toString().length) {
                    listOfRooms[arg.sessionid].identifier = arg.identifier;
                }

                try {
                    if (typeof arg.password !== 'undefined' && arg.password.toString().length) {
                        // password protected room?
                        listOfRooms[arg.sessionid].password = arg.password;
                    }
                } catch (e) {
                    pushLogs('open-room.password', e);
                }
            }

            // admin info are shared only with /admin/
            listOfUsers[socket.userid].socket.admininfo = {
                sessionid: arg.sessionid,
                session: arg.session,
                mediaConstraints: arg.mediaConstraints,
                sdpConstraints: arg.sdpConstraints,
                streams: arg.streams,
                extra: arg.extra
            };
        } catch (e) {
            pushLogs('open-room', e);
        }

        sendToAdmin();

        try {
            callback(true);
        } catch (e) {
            pushLogs('open-room', e);
        }
    });

    socket.on('join-room', function(arg, callback) {
        callback = callback || function() {};

        try {
            // if already joined a room, either leave or close it
            closeOrShiftRoom();

            if (enableScalableBroadcast === true) {
                arg.session.scalable = true;
                arg.sessionid = arg.extra.broadcastId;
            }

            // maybe redundant?
            if (!listOfUsers[socket.userid]) {
                listOfUsers[socket.userid] = {
                    socket: socket,
                    connectedWith: {},
                    extra: arg.extra,
                    admininfo: {},
                    socketMessageEvent: params.socketMessageEvent || '',
                    socketCustomEvent: params.socketCustomEvent || ''
                };
            }
            listOfUsers[socket.userid].extra = arg.extra;
        } catch (e) {
            pushLogs('join-room', e);
        }

        try {
            if (!listOfRooms[arg.sessionid]) {
                callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
                return;
            }
        } catch (e) {
            pushLogs('join-room', e);
        }

        try {
            if (listOfRooms[arg.sessionid].password && listOfRooms[arg.sessionid].password != arg.password) {
                callback(false, CONST_STRINGS.INVALID_PASSWORD);
                return;
            }
        } catch (e) {
            pushLogs('join-room.password', e);
        }

        try {
            if (listOfRooms[arg.sessionid].participants.length >= listOfRooms[arg.sessionid].maxParticipantsAllowed) {
                callback(false, CONST_STRINGS.ROOM_FULL);
                return;
            }
        } catch (e) {
            pushLogs('join-room.ROOM_FULL', e);
        }

        // append this user into participants list
        appendToRoom(arg.sessionid, socket.userid);

        try {
            // admin info are shared only with /admin/
            listOfUsers[socket.userid].socket.admininfo = {
                sessionid: arg.sessionid,
                session: arg.session,
                mediaConstraints: arg.mediaConstraints,
                sdpConstraints: arg.sdpConstraints,
                streams: arg.streams,
                extra: arg.extra
            };
        } catch (e) {
            pushLogs('join-room', e);
        }

        sendToAdmin();

        try {
            callback(true);
        } catch (e) {
            pushLogs('join-room', e);
        }
    });

    socket.on('disconnect', function() {
        try {
            if (socket && socket.namespace && socket.namespace.sockets) {
                delete socket.namespace.sockets[this.id];
            }
        } catch (e) {
            pushLogs('disconnect', e);
        }

        try {
            // inform all connected users
            if (listOfUsers[socket.userid]) {
                for (var s in listOfUsers[socket.userid].connectedWith) {
                    listOfUsers[socket.userid].connectedWith[s].emit('user-disconnected', socket.userid);

                    // sending duplicate message to same socket?
                    if (listOfUsers[s] && listOfUsers[s].connectedWith[socket.userid]) {
                        delete listOfUsers[s].connectedWith[socket.userid];
                        listOfUsers[s].socket.emit('user-disconnected', socket.userid);
                    }
                }
            }
        } catch (e) {
            pushLogs('disconnect', e);
        }

        closeOrShiftRoom();

        delete listOfUsers[socket.userid];

        if (socket.ondisconnect) {
            try {
                // scalable-broadcast.js
                socket.ondisconnect();
            }
            catch(e) {
                pushLogs('socket.ondisconnect', e);
            }
        }

        sendToAdmin();
    });
//    }
    
    // ----------------------
    // below code is optional

    //const params = socket.handshake.query;

    if (!params.socketCustomEvent) {
        params.socketCustomEvent = 'custom-message';
    }

    socket.on(params.socketCustomEvent, function(message) {
        socket.broadcast.emit(params.socketCustomEvent, message);
    });


})
