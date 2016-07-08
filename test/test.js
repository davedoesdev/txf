/*
Test different status codes
Test no auth and auth
Test content-type headers
Long paths
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

describe('txf', function ()
{
    var server;

    before(function (cb)
    {
        server = http.createServer();
        server.listen(port, cb);
        txf(server, { foo: { sender: '', receiver: '' } });
    });

    after(function (cb)
    {
        server.close(cb);
    });

    it('should transfer data', function ()
    {
        var get_response = chakram.get(url + 'foo/bar');
        expect(get_response).to.have.status(200);
        expect(get_response).to.have.json('hello');

        var put_response = chakram.put(url + 'foo/bar', 'hello')
        expect(put_response).to.have.status(200);

        return chakram.wait();
    });

    it('should support multiple transfers at the same time', function ()
    {
        this.timeout(60 * 1000);

        for (var i = 0; i < 1000; i += 1)
        {
            var get_response = chakram.get(url + 'foo/bar' + i);
            expect(get_response).to.have.status(200);
            expect(get_response).to.have.json('hello' + i);

            var put_response = chakram.put(url + 'foo/bar' + i, 'hello' + i);
            expect(put_response).to.have.status(200);
        }

        return chakram.wait();
    });

    it('should error if get request is in progress', function ()
    {
        var get_response = chakram.get(url + 'foo/bar');
        expect(get_response).to.have.status(200);
        expect(get_response).to.have.json('hello');

        expect(chakram.get(url + 'foo/bar')).to.have.status(409);

        var put_response = chakram.put(url + 'foo/bar', 'hello')
        expect(put_response).to.have.status(200);

        return chakram.wait();
    });

    it('should error if put request is in progress', function ()
    {
        var put_response = chakram.put(url + 'foo/bar', 'hello');
        expect(put_response).to.have.status(200);

        expect(chakram.put(url + 'foo/bar', 'hello')).to.have.status(409);

        var get_response = chakram.get(url + 'foo/bar');
        expect(get_response).to.have.status(200);
        expect(get_response).to.have.json('hello');

        return chakram.wait();
    });

    it.only('should support large transfers', function ()
    {
        var buf = crypto.randomBytes(1024 * 1024);

        var put_response = chakram.put(url + 'foo/bar', buf, { json: false });
        expect(put_response).to.have.status(200);

        chakram.get(url + 'foo/bar', { encoding: null })
        .then(function (get_response)
        {
            expect(get_response).to.have.status(200);
            return expect(get_response.body.equals(buf)).to.equal(true);
        });

        return chakram.wait();
    });
});
