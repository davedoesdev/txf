
var url = require('url'),
    crypto = require('crypto');

var senders = {}, receivers = {};

function check(id)
{
    var sender = senders[id],
        receiver = receivers[id];

    if (sender && receiver)
    {
        receiver.setHeader('Content-Type', sender.headers['content-type'] || 'application/octet-stream');
        sender.pipe(receiver);
    }
}

module.exports = function (server, secrets)
{
    server.on('request', function (request, response)
    {
        console.log(request.method, request.url);

        var pathname = url.parse(request.url).pathname.split('/'),
            namespace,
            digest,
            id;

        if (pathname.length === 4)
        {
            namespace = pathname[1];
            digest = pathname[2];
            id = pathname[3];
        }
        else if (pathname.length === 3)
        {
            namespace = pathname[1];
            id = pathname[2];
        }
        else
        {
            response.writeHead(400);
            return response.end();
        }

        var keys = secrets[namespace];

        if (keys === undefined)
        {
            response.writeHead(403);
            return response.end();
        }

        if (request.method === 'PUT')
        {
            var key = keys.sender;

            if (key === undefined)
            {
                response.writeHead(403);
                return response.end();
            }

            if (key.length > 0)
            {
                var hmac = crypto.createHmac('sha256', key);
                hmac.update(id);
                if (hmac.digest('hex') !== digest)
                {
                    response.writeHead(404);
                    return response.end();
                }
            }

            if (senders[id] !== undefined)
            {
                response.writeHead(409);
                return response.end();
            }

            request.response = response;
            senders[id] = request;

            function sender_done()
            {
                var sender = senders[id];
                if (sender === request)
                {
                    delete senders[id];
                }
            }

            request.on('end', function ()
            {
                response.end();
            });
            request.on('close', sender_done);
            request.on('end', sender_done);

            check(id);
        }
        else if (request.method === 'GET')
        {
            var key = keys.receiver;

            if (key === undefined)
            {
                response.writeHead(403);
                return response.end();
            }

            if (key.length > 0)
            {
                var hmac = crypto.createHmac('sha256', key);
                hmac.update(id);
                if (hmac.digest('hex') !== digest)
                {
                    response.writeHead(404);
                    return response.end();
                }
            }

            if (receivers[id] !== undefined)
            {
                response.writeHead(409);
                return response.end();
            }

            receivers[id] = response;

            function receiver_done()
            {
                var receiver = receivers[id];
                if (receiver === response)
                {
                    delete receivers[id];
                }
            }

            response.on('pipe', function (sender)
            {
                response.on('close', function ()
                {
                    sender.unpipe(response);
                    sender.response.writeHead(504);
                    sender.response.end();
                });
            });
            response.on('close', receiver_done);
            response.on('finish', receiver_done);

            check(id);
        }
        else
        {
            response.writeHead(405);
            return response.end();
        }
    });
};
