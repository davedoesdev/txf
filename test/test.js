var fs = require('fs'),
    path = require('path'),
    https = require('https'),
    crypto = require('crypto'),
    chakram = require('chakram'),
    expect = chakram.expect,
    txf = require('..');

var port = 8700;

var secrets = {
    foo: {
        sender: '',
        receiver: ''
    },
    prot: {
        sender: 'foobar',
        receiver: 'fred bloggs'
    },
    no_keys: {}
};

function make_server(protocol, cb)
{
    var opts;
    if (protocol === 'https')
    {
        opts = {
            key: fs.readFileSync(path.join(__dirname, 'server.key')),
            cert: fs.readFileSync(path.join(__dirname, 'server.pem'))
        };
    }
    var server = require(protocol).createServer(opts);
    server.listen(port, cb);
    return server;
}

function stest(protocol, agent)
{
    var url = protocol + '://localhost:' + port + '/';
describe(protocol, function ()
{

describe('txf', function ()
{
    var server, senders_and_receivers;

    before(function (cb)
    {
        server = make_server(protocol, cb);
        senders_and_receivers = txf(server, secrets);
    });

    after(function (cb)
    {
        server.close(function (err)
        {
            expect(senders_and_receivers.senders.size === 0);
            expect(senders_and_receivers.receivers.size === 0);
            cb(err);
        });
    });

    function test(description, make_put_url, make_get_url)
    {
    describe(description, function ()
    {
        it('should transfer data', function ()
        {
            var get_response = chakram.get(make_get_url('bar'),
                                           { agent: agent });
            expect(get_response).to.have.status(200);
            expect(get_response).to.have.json('hello');
            expect(get_response).to.have.header('content-type', 'application/json');

            var put_response = chakram.put(make_put_url('bar'),
                                           'hello',
                                           { agent: agent });
            expect(put_response).to.have.status(200);

            return chakram.wait();
        });

        it('should support multiple transfers at the same time', function ()
        {
            this.timeout(60 * 1000);

            for (var i = 0; i < 100; i += 1)
            {
                var get_response = chakram.get(make_get_url('bar' + i),
                                               { agent: agent });
                expect(get_response).to.have.status(200);
                expect(get_response).to.have.json('hello' + i);

                var put_response = chakram.put(make_put_url('bar' + i),
                                               'hello' + i,
                                               { agent: agent });
                expect(put_response).to.have.status(200);
            }

            return chakram.wait();
        });

        it('should error if get request is in progress', function ()
        {
            var get_response = chakram.get(make_get_url('bar'),
                                           { agent: agent });
            expect(get_response).to.have.status(200);
            expect(get_response).to.have.json('hello');

            expect(chakram.get(make_get_url('bar'),
                               { agent: agent })).to.have.status(409);

            var put_response = chakram.put(make_put_url('bar'),
                                           'hello',
                                           { agent: agent });
            expect(put_response).to.have.status(200);

            return chakram.wait();
        });

        it('should error if put request is in progress', function ()
        {
            var put_response = chakram.put(make_put_url('bar'),
                                           'hello',
                                           { agent: agent });
            expect(put_response).to.have.status(200);

            expect(chakram.put(make_put_url('bar'),
                               'hello',
                               { agent: agent })).to.have.status(409);

            var get_response = chakram.get(make_get_url('bar'),
                                           { agent: agent });
            expect(get_response).to.have.status(200);
            expect(get_response).to.have.json('hello');

            return chakram.wait();
        });

        it('should support large transfers', function ()
        {
            var buf = crypto.randomBytes(1024 * 1024);

            var put_response = chakram.put(make_put_url('bar'),
                                           buf,
                                           { json: false, agent: agent });
            expect(put_response).to.have.status(200);

            return chakram.all([

            chakram.get(make_get_url('bar'),
                        { encoding: null, agent: agent })
            .then(function (get_response)
            {
                expect(get_response).to.have.status(200);
                expect(get_response).to.have.header('content-type', 'application/octet-stream');
                expect(get_response.body.equals(buf)).to.equal(true);
            }),

            chakram.wait()]);
        });

        it('should error if too many levels in path', function ()
        {
            var get_response = chakram.get(make_get_url('bar/dummy1/dummy2'),
                                           { agent: agent });
            expect(get_response).to.have.status(400);
            return chakram.wait();
        });

        it('should error if namespace unknown', function ()
        {
            var get_response = chakram.get(make_get_url('bar', 'dummy'),
                                           { agent: agent });
            expect(get_response).to.have.status(403);
            return chakram.wait();
        });

        if (description === 'auth')
        {
            it('should error if receiver digest is wrong', function ()
            {
                var get_response = chakram.get(make_put_url('bar'),
                                               { agent: agent });
                expect(get_response).to.have.status(404);
                return chakram.wait();
            });

            it('should error if sender digest is wrong', function ()
            {
                var put_response = chakram.put(make_get_url('bar'),
                                               'hello',
                                               { agent: agent });
                expect(put_response).to.have.status(404);
                return chakram.wait();
            });
        }

        it('should error if namespace has no receiver key', function ()
        {
            var get_response = chakram.get(make_get_url('bar', 'no_keys'),
                                           { agent: agent });
            expect(get_response).to.have.status(403);
            return chakram.wait();
        });

        it('should error if namespace has no sender key', function ()
        {
            var put_response = chakram.put(make_put_url('bar', 'no_keys'),
                                           'hello',
                                           { agent: agent });
            expect(put_response).to.have.status(403);
            return chakram.wait();
        }); 

        it('should error if request is not put or get', function ()
        {
            var head_response = chakram.head(make_get_url('bar'),
                                             { agent: agent });
            expect(head_response).to.have.status(405);
            return chakram.wait();
        });

        it('should cope with close and end events occurring on request', function ()
        {
            server.on('request', function (request, response)
            {
                request.on('end', function ()
                {
                    this.emit('close');
                });

                response.on('finish', function ()
                {
                    this.emit('close');
                });
            });

            var get_response = chakram.get(make_get_url('bar'),
                                           { agent: agent });
            expect(get_response).to.have.status(200);
            expect(get_response).to.have.json('hello');

            var put_response = chakram.put(make_put_url('bar'),
                                           'hello',
                                           { agent: agent });
            expect(put_response).to.have.status(200);

            return chakram.wait();
        });

        it('should pass on content-type', function ()
        {
            var buf = crypto.randomBytes(1024);

            var put_response = chakram.put(make_put_url('bar'), buf,
            {
                json: false,
                headers: { 'Content-Type': 'dummy1/dummy2' },
                agent: agent
            });
            expect(put_response).to.have.status(200);

            return chakram.all([

            chakram.get(make_get_url('bar'),
                        { encoding: null, agent: agent })
            .then(function (get_response)
            {
                expect(get_response).to.have.status(200);
                expect(get_response).to.have.header('content-type', 'dummy1/dummy2');
                expect(get_response.body.equals(buf)).to.equal(true);
            }),

            chakram.wait()]);
        });
    });
    }

    function make_url_no_auth(path, namespace)
    {
        return url + (namespace || 'foo') + '/' + path;
    }

    test('no auth', make_url_no_auth, make_url_no_auth);

    test('auth', function (path, namespace)
    {
        return url +
               (namespace || 'prot') + '/' +
               crypto.createHmac('sha256', secrets.prot.sender)
                   .update(path)
                   .digest('hex') + '/' +
               path;
    }, function (path, namespace)
    {
        return url +
               (namespace || 'prot') + '/' +
               crypto.createHmac('sha256', secrets.prot.receiver)
                   .update(path)
                   .digest('hex') + '/' +
               path;
    });
});

describe('txf-no-secerts', function ()
{
    var server;

    before(function (cb)
    {
        server = make_server(protocol, cb);
        txf(server);
    });

    after(function (cb)
    {
        server.close(cb);
    });

    it('should error when no secrets have been supplied', function ()
    {
        var get_response = chakram.get(url + 'foo/bar', { agent: agent });
        return expect(get_response).to.have.status(403);
    });
});

});
}

stest('http');
stest('https', new https.Agent(
{
    ca: fs.readFileSync(path.join(__dirname, 'ca.pem'))
}));
