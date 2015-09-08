
var http = require('http'),
    relay = require('./index.js'),
    server = http.createServer();

server.listen(8000);

/*
To send:

curl -f -T /tmp/foo http://localhost:8000/default/$(echo -n foo | openssl dgst -sha256 -hmac foobar | awk '{print $2'})/foo

To receive:

curl -f http://localhost:8000/default/$(echo -n foo | openssl dgst -sha256 -hmac wuppy | awk '{print $2}')/foo
*/

relay(server, { default: { sender: 'foobar', receiver: 'wuppy' } });
