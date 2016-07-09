/*
Test different status codes
Test no auth and auth including wrong secret
Test content-type headers
Long paths
Wrong number of path separators
100% coverage
Make logging optional somehow?
*/

var http = require('http'),
    crypto = require('crypto'),
    chakram = require('chakram'),
    expect = chakram.expect,
    txf = require('..');

var port = 8700;
var url = 'http://localhost:' + port + '/';

var secrets = {
    foo: {
        sender: '',
        receiver: ''
    },
    prot: {
        sender: 'foobar',
        receiver: 'fred bloggs'
    }
};

describe('txf', function ()
{
    var server;

    before(function (cb)
    {
        server = http.createServer();
        server.listen(port, cb);
        txf(server, secrets);
    });

    after(function (cb)
    {
        server.close(cb);
    });

    function test(description, make_put_url, make_get_url)
    {
    describe(description, function ()
    {
        it('should transfer data', function ()
        {
            var get_response = chakram.get(make_get_url('bar'));
            expect(get_response).to.have.status(200);
            expect(get_response).to.have.json('hello');

            var put_response = chakram.put(make_put_url('bar'), 'hello');
            expect(put_response).to.have.status(200);

            return chakram.wait();
        });

        it('should support multiple transfers at the same time', function ()
        {
            this.timeout(60 * 1000);

            for (var i = 0; i < 1000; i += 1)
            {
                var get_response = chakram.get(make_get_url('bar' + i));
                expect(get_response).to.have.status(200);
                expect(get_response).to.have.json('hello' + i);

                var put_response = chakram.put(make_put_url('bar' + i), 'hello' + i);
                expect(put_response).to.have.status(200);
            }

            return chakram.wait();
        });

        it('should error if get request is in progress', function ()
        {
            var get_response = chakram.get(make_get_url('bar'));
            expect(get_response).to.have.status(200);
            expect(get_response).to.have.json('hello');

            expect(chakram.get(make_get_url('bar'))).to.have.status(409);

            var put_response = chakram.put(make_put_url('bar'), 'hello');
            expect(put_response).to.have.status(200);

            return chakram.wait();
        });

        it('should error if put request is in progress', function ()
        {
            var put_response = chakram.put(make_put_url('bar'), 'hello');
            expect(put_response).to.have.status(200);

            expect(chakram.put(make_put_url('bar'), 'hello')).to.have.status(409);

            var get_response = chakram.get(make_get_url('bar'));
            expect(get_response).to.have.status(200);
            expect(get_response).to.have.json('hello');

            return chakram.wait();
        });

        it('should support large transfers', function ()
        {
            var buf = crypto.randomBytes(1024 * 1024);

            var put_response = chakram.put(make_put_url('bar'), buf, { json: false });
            expect(put_response).to.have.status(200);

            return chakram.all([

            chakram.get(make_get_url('bar'), { encoding: null })
            .then(function (get_response)
            {
                expect(get_response).to.have.status(200);
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
