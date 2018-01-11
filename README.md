# 利用Vue、Socket.io 实现在线五子棋对战
网上有很多利用前端技术来做五子棋的Dome，所以本人为了学习[socket.io](socket.io) 就自己也撸了一个。

### 游戏状态数据
棋盘由一个个方块组成，棋子落在横竖线的交界处

```html
<table cellpadding="0" cellspacing="0">
	<tr v-for="(itemY,y) in Board">
		<td v-for="(itemX,x) in itemY" :class="getBoardCellClass(y,x)" style="position: relative;">
			<div class="cell"></div>
			<div :class="getPieceClass(y,x)" @click="clickPiece(y,x)"></div>
		</td>
	</tr>
</table>
```

这里我是用`table`和一个二维数组来画的棋盘，`Board[y][x] === 0`表示该位置为空，`Board[y][x] === 1`表示放置白子，`Board[y][x] === -1`表示放置黑子

### 下棋动作
由于给每个横竖交叉点都设置初始化数据，所以加上监听 `clickPiece(y,x)` 方法即可

### 判断输赢
这是五子棋最核心的地方，相对也是最麻烦的地方，每次落子都要从横向、竖向、两个斜向四个方向的其他棋子来判断结果。`this.CurrentPieceRole` 为当前落子角色

```javascript
function verifySuccess(y, x) {
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
```

## 利用 socket.io 进行联机
每个联机的用户都可以作为主机，每个联机的用户都有一个socket.id，可以通过选择在线的用户进行联机。

### 服务端
`let socketClients = {}` 当前在线用户对象，socket.id和socket对象映射关系  id:socket
`let fiveDesk = []` 当前进行的棋局数组 `{ White : id1 , Black : id2 }`

这里主要有两个事件
* 联机
* 落子

#### 联机
监听联机事件，一方请求联机，通过服务器发送请求信息给对手，并新增棋局数据

```javascript
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
    if(!thisClient || !client)
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
```

同意请求之后，双方开始棋局

```javascript
socket.on('agreeConnect', function (deskId) {
    if (fiveDesk.length > deskId) {
        var desk = fiveDesk[deskId];
        desk.Result = true;

        socketClients[desk.White].socket.emit('deskBegin', { role: 1, deskId: deskId });
        socketClients[desk.Black].socket.emit('deskBegin', { role: -1, deskId: deskId });
    }
});
```

#### 落子
监听落子事件，接收坐标和落子信息，并通知给对手

```javascript
socket.on('clickPiece', function (data) {
    var deskId = data.deskId;
    if (fiveDesk.length > deskId) {
        var desk = fiveDesk[deskId];
			if(!desk.Result)
				return;

        var socket;
        if (data.role === 1) {
            socket = socketClients[desk.Black].socket;
        } else {
            socket = socketClients[desk.White].socket;
        }

        socket.emit('serverClickPiece', { x: data.x, y: data.y })
    }
});
```


### 客户端
客户端比较简单，直接贴几个关键的事件

```javascript
socket.emit('applyConnect', socketId); //请求联机

//发送落子信息， this.ServerRole 为当前客户端棋盘角色
socket.emit('clickPiece', {
    x: x,
    y: y,
    deskId: vueHander.getDeskId(),
    role: this.ServerRole
});

//接收对手落子
socket.on('serverClickPiece', function (data) {
    vueHander.clickPiece(data.y, data.x);
});
```


[Demo](http://animebz.com/game/five.html)

> 主要是用来学习socket.io，所以很多细节方面没有处理，bug多了点



