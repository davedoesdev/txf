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

Note you can also start the receiver first &mdash; `txf` won't start the
response to the receiver until the sender connects.

## Access Control

Requests to a `txf` service should use paths of the following form:

```
/namespace/[hmac-sha256-hex/]resource
```

The first component in the path we call the `txf` _namespace_.

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

## Status Codes

`txf` can return the following HTTP status codes:

<table>
<thead>
<tr>
<th>
Status Code
</th>
<th>
PUT
</th>
<th>
GET
</th>
</tr>
<tbody>
<tr>
<td>
200
</td>
<td>
All data was forwarded to a receiver. This doesn't mean the receiver has
necessarily received it all.
</td>
<td>
A sender has connected and its data will follow in the response.
</td>
</tr>
<tr>
<td>
400
</td>
<td colspan="2">
Path has fewer than 2 or more than 3 components.
</td>
</tr>
<tr>
<td>
403
</td>
<td colspan="2">
No secrets (empty or otherwise) were supplied for the namespace.
</td>
</tr>
<tr>
<td>
404
</td>
<td colspan="2">
HMAC supplied in the path is incorrect for the resource.
</td>
</tr>
<tr>
<td>
405
</td>
<td colspan="2">
Request method was not PUT or GET.
</td>
</tr>
<tr>
<td>
409
</td>
<td>
A PUT request is already in progress for the resource.
</td>
<td>
A GET request is already in progress for the resource.
</td>
</tr>
<tr>
<td>
504
</td>
<td>
The receiver's connection was closed before all data could be forwarded to it.
</td>
<td>
</td>
</tr>
</tbody>
</table>

## Installation

```shell
npm install txf
```

## Licence

[MIT](LICENCE)

## Test

```shell
grunt test
```

## Lint

```shell
grunt lint
```

## Code Coverage

```shell
grunt coverage
```

[Instanbul](http://gotwarlost.github.io/istanbul/) results are available [here](http://rawgit.davedoesdev.com/davedoesdev/txf/master/coverage/lcov-report/index.html).

Coveralls page is [here](https://coveralls.io/r/davedoesdev/txf).

# API
*/
var url = require('url'),
    crypto = require('crypto');

/**
Create a `txf` service which pipes a PUT request's incoming stream to a GET
request's outgoing stream on the same path. Request paths should be of the form
`/namespace/[hmac-sha256-hex/]resource`. If access control is defined for
`namespace` (see the `secrets` parameter below) then `hmac-sha256-hex` must be
the hex-encoded HMAC-SHA256 of `resource`. Otherwise `hmac-sha256-hex` is
not required.

@param {http.Server|https.Server} server [HTTP](https://nodejs.org/dist/latest-v4.x/docs/api/http.html#http_class_http_server) or [HTTPS](https://nodejs.org/dist/latest-v4.x/docs/api/https.html#https_class_https_server) server which `txf` will use to listen for requests. It's up to the caller to set up the server (e.g. listen on a port). HTTPS servers will need to know about their certificates and keys. See `make_server()` in `test/test.js` for an example.

@param {Object} secrets A dictionary of valid namespaces. Each entry in `secrets` should be a mapping from a namespace to a dictionary of HMAC keys, one for PUT requests (senders) and one for GET requests (receivers).

For example:

```javascript
{ foo: { sender: 'some secret', receiver: 'another secret' } }
```

would mean PUT requests to the `foo` namespace for resource `bar` would have
to use the following path:

```
/foo/c6eb7ab0584d4a8f62d64de6767798e09c9566308533cedb86d14547fcab3211/bar
```

and GET requests to the `foo` namespace for resource `bar` would have to use
the following path:

```
/foo/be83aaf02fb252a1b21f522c95c09f5db563dc6180db034c9c236fb3ffc849ff/bar
```

If you specify empty strings for a namespace's secrets:

```javascript
{ foo: { sender: '', receiver: '' } }
```

then the HMAC-SHA256 is not required. In that case, PUT and GET requests could
use the following path:

```
/foo/bar
```

Requests to a namespace which don't have an entry in `secrets` will be rejected.
*/
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
