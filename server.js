// OpenShift runner

var http = require('http'),
    txf = require('./index.js'),
    server = http.createServer();

var port = process.env.PORT || 8080;
var default_sender_secret = process.env.DEFAULT_SENDER_SECRET || '';
var default_receiver_secret = process.env.DEFAULT_RECEIVER_SECRET || '';

console.log('starting on port', port);

server.listen(port, function()
{
    console.log('listening on port', port);

    server.on('request', function (request)
    {
        console.log(request.method, request.url);
    });

    txf(server, {
        default: { sender: default_sender_secret,
                   receiver: default_receiver_secret } });
});

