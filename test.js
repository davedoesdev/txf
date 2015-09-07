
var http = require('http'),
    relay = require('./index.js'),
    server = http.createServer();

server.listen(8000);

relay(server, { default: { sender: 'foobar', receiver: 'wuppy' } });
