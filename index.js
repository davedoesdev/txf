/*
# txf&nbsp;&nbsp;&nbsp;[![Build Status](https://travis-ci.org/davedoesdev/txf.png)](https://travis-ci.org/davedoesdev/txf) [![Coverage Status](https://coveralls.io/repos/davedoesdev/txf/badge.png?branch=master&service=github)](https://coveralls.io/r/davedoesdev/txf?branch=master) [![NPM version](https://badge.fury.io/js/txf.png)](http://badge.fury.io/js/txf)

File transfer service which pipes PUT requests to matching GET requests.

- Uses shared secrets to make request paths unguessable.
- Doesn't store data.

The API is described [here](#api).

## Example

Create a `txf` service on port 8000:

```javascript
var server = require('http').createServer();
server.listen(8000);
require('txf')(server, { test: { sender: '', receiver: '' } });
```

Send data to the service:

```shell
$ echo 'some data' | curl -T - http://localhost:8000/test/hello
```

Receive data from the service:

```shell
$ curl http://localhost:8000/test/hello
some data
```

## Access Control

The first component in the URL's path we call the `txf` _namespace_.
When creating the service, specify secrets for each namespace you want to
support; one secret for senders (PUT requests) and one for receivers
(GET requests).

If a namespace's secrets are empty strings then no access control is applied.
Anyone can PUT or GET files to the namespace. In this case, the second component
in the path we call the `txf` resource.

If the secrets aren't empty strings then they're used to apply access control
to the namespace. In this case, the third component of the path must be the
resource. The second component must be the hex-encoded HMAC-SHA256 of the
resource, calculated using one of the secrets (depending on the request type)
as the key.

Here's the same example as above but with access control. First the service:

```javascript
var server = require('http').createServer();
server.listen(8000);
require('txf')(server, { test: { sender: 'secret1', receiver: 'secret2' } });
```

Send data to the service:

```shell
$ echo 'some data' | curl -T - http://localhost:8000/test/$(echo -n hello | openssl dgst -sha256 -hmac secret1 | awk '{print $2}')/hello
```

Receive data from the service:

```shell
$ curl http://localhost:8000/test/$(echo -n hello | openssl dgst -sha256 -hmac secret2 | awk '{print $2}')/hello
some data
```






*/
var url = require('url'),
    crypto = require('crypto');

module.exports = function (server, secrets)
{
    var senders = new Map(),
        receivers = new Map();

    function check(id)
    {
        var sender = senders.get(id),
            receiver = receivers.get(id);

        if (sender && receiver)
        {
            receiver.setHeader('Content-Type', sender.headers['content-type'] || 'application/octet-stream');
            sender.pipe(receiver);
        }
    }

    server.on('request', function (request, response)
    {
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

        if (!secrets)
        {
            response.writeHead(403);
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
            var sender_key = keys.sender;

            if (sender_key === undefined)
            {
                response.writeHead(403);
                return response.end();
            }

            if (sender_key.length > 0)
            {
                var sender_hmac = crypto.createHmac('sha256', sender_key);
                sender_hmac.update(id);
                if (sender_hmac.digest('hex') !== digest)
                {
                    response.writeHead(404);
                    return response.end();
                }
            }

            if (senders.has(id))
            {
                response.writeHead(409);
                return response.end();
            }

            request.response = response;
            senders.set(id, request);

            var sender_done = function ()
            {
                var sender = senders.get(id);
                if (sender === request)
                {
                    senders.delete(id);
                }
            };

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
            var receiver_key = keys.receiver;

            if (receiver_key === undefined)
            {
                response.writeHead(403);
                return response.end();
            }

            if (receiver_key.length > 0)
            {
                var receiver_hmac = crypto.createHmac('sha256', receiver_key);
                receiver_hmac.update(id);
                if (receiver_hmac.digest('hex') !== digest)
                {
                    response.writeHead(404);
                    return response.end();
                }
            }

            if (receivers.has(id))
            {
                response.writeHead(409);
                return response.end();
            }

            receivers.set(id, response);

            var receiver_done = function ()
            {
                var receiver = receivers.get(id);
                if (receiver === response)
                {
                    receivers.delete(id);
                }
            };

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

    return { senders: senders, receivers: receivers }; // for testing
};
