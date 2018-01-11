var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var socketClients = {};
var fiveDesk = [];

io.on('connection', function (socket) {
    var _socketId = socket.id;

    function setError(result) {
        socket.emit('errorResult', result);
    }

    function delDesk(index) {
        fiveDesk.splice(index, 1);
    }

    function getClientByName(name) {
        for (var key in socketClients) {
            var item = socketClients[key];
            if (item.name === name) {
                return item;
            }
        }
    }

    function existsDesk(socketId) {
        for (var item of fiveDesk) {
            if (item.White === socketId || item.Black === socketId) {
                return true;
            }
        }
        return false;
    }


    socket.on('disconnect', () => {
        for (let key in socketClients) {
            if (key === _socketId) {
                delete socketClients[key];
                break;
            }
        }

        for (let i = fiveDesk.length - 1; i >= 0; i--) {
            var desk = fiveDesk[i];
            if (desk.White === _socketId || desk.Black === _socketId) {
                socketClients[desk.White === _socketId ? desk.Black : desk.White].socket.emit('break');
                delDesk(i);
                break;
            }
        }
    });

    socket.on('setName', function (name) {
        if (getClientByName(name)) {
            setError({ Message: '对不起，已存在该名称！' });
            return;
        }

        socketClients[socket.id] = {
            id: socket.id,
            socket: socket,
            name: name
        }
    });

    socket.on('updateClients', function () {
        for (let key in socketClients) {
            var client = socketClients[key];
            var result = [];
            if (!existsDesk(key)) {
                for (let key2 in socketClients) {
                    if (key2 !== key && !existsDesk(key2)) {
                        result.push({
                            id: key2,
                            name: socketClients[key2].name
                        });
                    }
                }
                client.socket.emit('updateClients', result);
            }
        }
    });

    socket.on('applyConnect', function (socketId) {
        var thisClient = socketClients[socket.id];
        if (!socketClients.hasOwnProperty(socketId)) {
            thisClient.socket.emit('errorResult', { IsSuccess: false, Message: '对方不在线' });
            return;
        }

        if (existsDesk(socketId)) {
            thisClient.socket.emit('errorResult', { IsSuccess: false, Message: '对方已加入其它棋局' });
            return;
        }

        var client = socketClients[socketId];
        if (!thisClient || !client)
            return;

        fiveDesk.push({
            White: thisClient.id,
            Black: client.id,
            Result: false
        });
        client.socket.emit('applyConnect', {
            IsSuccess: true,
            Message: thisClient.name,
            DeskId: fiveDesk.length - 1
        });
    });

    socket.on('agreeConnect', function (deskId) {
        if (fiveDesk.length > deskId) {
            var desk = fiveDesk[deskId];
            desk.Result = true;

            socketClients[desk.White].socket.emit('deskBegin', { role: 1, deskId: deskId });
            socketClients[desk.Black].socket.emit('deskBegin', { role: -1, deskId: deskId });
        }
    });

    socket.on('clickPiece', function (data) {
        var deskId = data.deskId;
        if (fiveDesk.length > deskId) {
            var desk = fiveDesk[deskId];
            var socket;
            if (data.role === 1) {
                socket = socketClients[desk.Black].socket;
            } else {
                socket = socketClients[desk.White].socket;
            }

            socket.emit('serverClickPiece', { x: data.x, y: data.y })
        }
    });
});


var server = http.listen(8080, function () {
    console.log('Server is running!');
});
