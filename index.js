
var url = require('url'),
    crypto = require('crypto');

var senders = {}, receivers = {};

function check(id)
{
    var sender = senders[id],
        receiver = receivers[id];

    if (sender && receiver)
    {
        sender.request.on('end', function ()
        {
            sender.response.end();
        });
        sender.request.pipe(receiver.response);
    }
}

module.exports = function (server, secrets)
{
    server.on('request', function (request, response)
    {
        var pathname = url.parse(request.url).pathname.split('/');

        if (pathname.length !== 4)
        {
            response.writeHead(400);
            return response.end();
        }

        var namespace = pathname[1],
            id = pathname[2],
            digest = pathname[3],
            keys = secrets[namespace];

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

            senders[id] = { request: request, response: response };

            function sender_done()
            {
                var sender = senders[id];
                if (sender && sender.request === request)
                {
                    delete senders[id];
                }
            }

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

            receivers[id] = { request: request, response: response };

            function receiver_done()
            {
                var receiver = receivers[id];
                if (receiver && receiver.response === response)
                {
                    delete receivers[id];
                }
            }

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
