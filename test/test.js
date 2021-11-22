var fs = require('fs'),
    path = require('path'),
    https = require('https'),
    crypto = require('crypto'),
    got = require('got'),
    expect = require('chai').expect,
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

function stest(protocol, options)
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
        it('should transfer data', async function ()
        {
            const getP = got(make_get_url('bar'), options);
            const putP = got.put(make_put_url('bar'), {
                ...options,
                json: 'hello'
            });

            const get_response = await getP;
            expect(get_response.statusCode).equal(200);
            expect(get_response.headers['content-type']).to.equal('application/json');
            expect(await getP.json()).to.equal('hello');

            const put_response = await putP;
            expect(put_response.statusCode).to.equal(200);
        });

        it('should support multiple transfers at the same time', async function ()
        {
            this.timeout(60 * 1000);

            for (let i = 0; i < 100; i += 1)
            {
                const getP = got(make_get_url('bar' + i), options);
                const putP = got.put(make_put_url('bar' + i), {
                    ...options,
                    json: {
                        foo: 'hello',
                        num: i,
                    }
                });

                const get_response = await getP;
                expect(get_response.statusCode).to.equal(200);
                expect(await getP.json()).to.deep.equal({
                    foo: 'hello',
                    num: i
                });

                const put_response = await putP;
                expect(put_response.statusCode).to.equal(200);
            }
        });

        it('should error if get request is in progress', async function ()
        {
            const getP = got(make_get_url('bar'), options);

            expect((await got(make_get_url('bar'), {
                ...options,
                throwHttpErrors: false
            })).statusCode).to.equal(409);

            const putP = got.put(make_put_url('bar'), {
                ...options,
                json: 'hello'
            });

            const get_response = await getP;
            expect(get_response.statusCode).to.equal(200);
            expect(await getP.json()).to.equal('hello');

            const put_response = await putP;
            expect(put_response.statusCode).to.equal(200);
        });

        it('should error if put request is in progress', async function ()
        {
            const putP = got.put(make_put_url('bar'), {
                ...options,
                json: 'hello'
            });

            expect((await got.put(make_put_url('bar'), {
                ...options,
                json: 'hello',
                throwHttpErrors: false
            })).statusCode).to.equal(409);

            const getP = got(make_get_url('bar'), options);
            const get_response = await getP;
            expect(get_response.statusCode).to.equal(200);
            expect(await getP.json()).to.equal('hello');

            const put_response = await putP;
            expect(put_response.statusCode).to.equal(200);
        });

        it('should support large transfers', async function ()
        {
            const buf = crypto.randomBytes(1024 * 1024);

            const putP = got.put(make_put_url('bar'), {
                ...options,
                body: buf
            });

            const getP = got(make_get_url('bar'), options);
            const get_response = await getP;
            expect(get_response.statusCode).equal(200);
            expect(get_response.headers['content-type']).to.equal('application/octet-stream');
            expect((await getP.buffer()).equals(buf)).to.equal(true);

            const put_response = await putP;
            expect(put_response.statusCode).to.equal(200);
        });

        it('should error if too many levels in path', async function ()
        {
            expect((await got(make_get_url('bar/dummy1/dummy2'), {
                ...options,
                throwHttpErrors: false
            })).statusCode).to.equal(400);
        });

        it('should error if namespace unknown', async function ()
        {
            expect((await got(make_get_url('bar', 'dummy'), {
                ...options,
                throwHttpErrors: false
            })).statusCode).to.equal(403);
        });

        if (description === 'auth')
        {
            it('should error if receiver digest is wrong', async function ()
            {
                expect((await got(make_put_url('bar'), {
                    ...options,
                    throwHttpErrors: false
                })).statusCode).to.equal(404);
            });

            it('should error if sender digest is wrong', async function ()
            {
                expect((await got.put(make_get_url('bar'), {
                    ...options,
                    json: 'hello',
                    throwHttpErrors: false
                })).statusCode).to.equal(404);
            });
        }

        it('should error if namespace has no receiver key', async function ()
        {
            expect((await got(make_get_url('bar', 'no_keys'), {
                ...options,
                throwHttpErrors: false
            })).statusCode).to.equal(403);
        });

        it('should error if namespace has no sender key', async function ()
        {
            expect((await got.put(make_put_url('bar', 'no_keys'), {
                ...options,
                json: 'hello',
                throwHttpErrors: false
            })).statusCode).to.equal(403);
        }); 

        it('should error if request is not put or get', async function ()
        {
            expect((await got.head(make_get_url('bar'), {
                ...options,
                throwHttpErrors: false
            })).statusCode).to.equal(405);
        });

        it('should cope with close and end events occurring on request', async function ()
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

            const getP = got(make_get_url('bar'), options);
            const putP = got.put(make_put_url('bar'), {
                ...options,
                json: 'hello'
            });

            const get_response = await getP;
            expect(get_response.statusCode).equal(200);
            expect(await getP.json()).to.equal('hello');

            const put_response = await putP;
            expect(put_response.statusCode).to.equal(200);
        });

        it('should pass on content-type', async function ()
        {
            const buf = crypto.randomBytes(1024);

            const putP = got.put(make_put_url('bar'), {
                ...options,
                body: buf,
                headers: {
                    'Content-Type': 'dummy1/dummy2'
                }
            });

            const getP = got(make_get_url('bar'), options);
            const get_response = await getP;
            expect(get_response.statusCode).equal(200);
            expect(get_response.headers['content-type']).to.equal('dummy1/dummy2');
            expect((await getP.buffer()).equals(buf)).to.equal(true);

            const put_response = await putP;
            expect(put_response.statusCode).to.equal(200);
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

    it('should error when no secrets have been supplied', async function ()
    {
        expect((await got(url + 'foo/bar', {
            ...options,
            throwHttpErrors: false
        })).statusCode).to.equal(403);
    });
});

});
}

stest('http');
stest('https', ({
    https: {
        certificateAuthority: fs.readFileSync(path.join(__dirname, 'ca.pem'))
    }
}));
