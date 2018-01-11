require(['vue', 'msg', 'socket'], function (vue, msg, socketio) {
    'use strict';

    var socket = socketio();

    const boardY = 15;
    const boardX = 15;
    var boardRecord = [];
    var handler = {
        initBoard: function () {
            var tempY = [];
            for (var i = 0; i < boardY; i++) {
                var tempX = [];
                for (var z = 0; z < boardX; z++) {
                    tempX.push(0);
                }
                tempY.push(tempX);
            }
            return tempY;
        },
        getRoleName(role) {
            return role === 1 ? '白旗' : '黑旗';
        }
    }

    var v = new vue({
        el: '#app',
        data: {
            IsOver: true,
            Board: handler.initBoard(),
            CurrentPieceRole: 1,
            Timing: {
                Minute: 0,
                Second: 0
            },
            UserName: '',
            Clients: [],
            ServerRole: 0,
            DeskId: -1
        },
        filters: {
            fillZero(figure) {
                return Number(figure) < 10 ? '0' + figure : figure;
            },
            getRoleName(role) {
                return handler.getRoleName(role);
            }
        },
        methods: {
            applyConnect: function (socketId) {
                vueHander.applyConnect(socketId);
            },
            getBoardCellClass: function (y, x) {
                var classStr = [];
                if (x === 0 && y > 0) {
                    classStr.push('left');
                }

                if (x < boardX - 1 && y > 0) {
                    classStr.push('right');
                }

                if (x < boardX - 1 && y < boardY) {
                    classStr.push('bottom');
                }

                return classStr.join(' ');
            },
            getPieceClass: function (y, x) {
                var classStr = ['piece'];
                var val = this.Board[y][x];
                switch (val) {
                    case 1:
                        classStr.push('white');
                        break;
                    case -1:
                        classStr.push('black');
                        break;
                }
                return classStr.join(' ');
            },
            clickPiece: function (y, x) {
                if (this.IsOver) {
                    msg.msg('还未开始');
                    return;
                }

                if (this.ServerRole !== this.CurrentPieceRole) {
                    msg.msg('未到您落子');
                    return;
                }

                if (vueHander.clickPiece(y, x)) {
                    socket.emit('clickPiece', {
                        x: x,
                        y: y,
                        deskId: vueHander.getDeskId(),
                        role: this.ServerRole
                    });
                }
            },
            backBoard() {
                if (boardRecord.length > 0) {
                    var board = boardRecord[boardRecord.length - 1];
                    this.CurrentPieceRole = this.Board[board.y][board.x];
                    this.$set(this.Board[board.y], board.x, 0);
                }
            },
            //重新开始
            reloadBegin() {
                vueHander.reloadBegin();
            },
            verifySuccess(y, x) {
                function getContinuationPieceCount(callback) {
                    var count = 1;
                    for (var i = 1; i < 5; i++ , count++) {
                        if (!callback(i)) {
                            break;
                        }
                    }
                    for (var z = -1; z > -5; z-- , count++) {
                        if (!callback(z)) {
                            break;
                        }
                    }
                    return count === 5;
                }

                function legalY(i) {
                    return i > -1 && i < boardY;
                }

                function legalX(i) {
                    return i > -1 && i < boardX;
                }

                var yAxie = (() => {
                    return getContinuationPieceCount((i) => {
                        return legalY(y + i) && this.Board[y + i][x] === this.CurrentPieceRole;
                    });
                });

                var xAxie = (() => {
                    return getContinuationPieceCount((i) => {
                        return legalX(x + i) && this.Board[y][x + i] === this.CurrentPieceRole;
                    });
                });

                var yxAxie = (() => {
                    return getContinuationPieceCount((i) => {
                        return legalY(y + i) && legalX(x + i) && this.Board[y + i][x + i] === this.CurrentPieceRole;
                    });
                });

                var xyAxie = (() => {
                    return getContinuationPieceCount((i) => {
                        return legalY(y - i) && legalX(x + i) && this.Board[y - i][x + i] === this.CurrentPieceRole;
                    });
                });

                return xAxie() || yAxie() || yxAxie() || xyAxie();
            }
        }
    });

    var vueHander = (function () {
        var deskId;

        msg.prompt('设置你的名称', (name) => {
            if (!name) {
                msg.msg('请填写名称');
                return;
            }

            this.UserName = name;
            socket.emit('setName', this.UserName);
            vueHander.updateClients();
        });


        socket.on('updateClients', (data) => {
            this.Clients = data;
        });

        socket.on('serverClickPiece', function (data) {
            vueHander.clickPiece(data.y, data.x);
        });

        socket.on('applyConnect', function (result) {
            if (confirm('用户 ' + result.Message + ' 请求对战，是否同意？')) {
                deskId = result.DeskId;
                socket.emit('agreeConnect', deskId);
            }
        });

        socket.on('deskBegin', (result) => {
            msg.msg('对战开始');
            setTimeout(() => {
                this.ServerRole = result.role;
                this.DeskId = deskId = result.deskId;
                vueHander.begin();
            }, 500);
        });

        socket.on('break', () => {
            vueHander.breakConnect();
            alert('对方连接已断开');
        });

        socket.on('errorResult', (result) => {
            msg.msg(result.Message);
        });

        return {
            reloadBegin: () => {
                socket.emit('agreeConnect', deskId);
                this.Board = handler.initBoard();
            },
            breakConnect: () => {
                vueHander.over();
                vueHander.updateClients();
                this.DeskId = deskId = -1;
            },
            getDeskId: () => {
                return deskId;
            },
            begin: () => {
                timer.begin();
                this.IsOver = false;
                this.CurrentPieceRole = 1;
                this.Board = handler.initBoard();
            },
            applyConnect: (socketId) => {
                msg.msg('对战请求已发送，等待对方同意请求');
                setTimeout(() => {
                    socket.emit('applyConnect', socketId);
                }, 500);
            },
            updateClients: () => {
                socket.emit('updateClients');
            },
            clickPiece: (y, x) => {
                var currentVal = this.Board[y][x];
                if (!this.IsOver && currentVal === 0) {
                    this.$set(this.Board[y], x, this.CurrentPieceRole);
                    boardRecord.push({
                        y: y,
                        x: x
                    });
                    if (!this.verifySuccess(y, x)) {
                        this.CurrentPieceRole = this.CurrentPieceRole === 1 ? -1 : 1;
                    } else {
                        msg.msg(handler.getRoleName(this.CurrentPieceRole) + '赢了');
                        vueHander.over();
                    }
                    return true;
                }
                return false;
            },
            over: () => {
                boardRecord = [];
                timer.over();

                this.IsOver = true;
                this.CurrentPieceRole = 1;
            }
        }
    }).call(v);


    var timer = (function () {
        var timer;
        var seconds = (function () {
            if (this.Timing.Second >= 59) {
                this.Timing.Second = 0;
                this.Timing.Minute++;
            } else {
                this.Timing.Second++;
            }
        }).bind(this);


        return {
            begin: () => {
                timer = setTimeout(function temp() {
                    seconds();
                    timer = setTimeout(temp, 1000);
                }, 1000);
            },
            over: () => {
                clearTimeout(timer);
                this.Timing.Second = 0;
                this.Timing.Minute = 0;
            }
        }
    }).call(v);


});