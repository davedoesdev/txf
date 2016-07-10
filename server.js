// OpenShift runner

var http = require('http'),
    txf = require('./index.js'),
    server = http.createServer();

var ip = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var default_sender_secret = process.env.DEFAULT_SENDER_SECRET || '';
var default_receiver_secret = process.env.DEFAULT_RECEIVER_SECRET || '';

console.log('starting', ip, port);

server.listen(port, ip, function()
{
    console.log('listening on', ip, port);

    server.on('request', function (request)
    {
        console.log(request.method, request.url);
    });

    txf(server, {
        default: { sender: default_sender_secret,
                   receiver: default_receiver_secret } });
});

