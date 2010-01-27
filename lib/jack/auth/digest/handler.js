/*
 * Copyright Neville Burnell
 * See http://github.com/cloudwork/jack/lib/jack/auth/README.md for license
 *
 * Acknowledgements:
 * Inspired by Rack::Auth
 * http://github.com/rack/rack
 */

var update = require('hash').Hash.update,
    md5 = require('md5'),
    base16 = require("base16"),
    AbstractHandler = require('jack/auth/abstract/handler').Handler,
    DigestRequest = require("jack/auth/digest/request").Request,
    DigestParams = require('jack/auth/digest/params'),
    DigestNonce = require('jack/auth/digest/nonce');

/////////////////
// Digest helpers
/////////////////

var base16md5 = exports.base16md5 = function(s) {
    return base16.encode(md5.hash(s));
};

var H = base16md5;

var qopSupported = ['auth']; // 'auth-int' is only implemented by Opera and Konquerer,

var A1 = function(req, password) {
    return [req.username, req.realm, password].join(':');
};

var A2 = function(req) {
    return [req.method, req.uri].join(':');
};

var digest = exports.digest = function(req, password) {
    return H([H(A1(req, password)), req.nonce, req.nc, req.cnonce, req.qop, H(A2(req))].join(':'));
};

/////////////////
// Digest handler
/////////////////

var Handler = exports.Handler = function(params) {
    AbstractHandler.call(this, params);
}

Handler.prototype = update(Object.create(AbstractHandler.prototype), {

    // generate() returns a Digest Auth JSGI handler for the app
    generate: function(app) {

        var self = this;

        return function(request) {

            var req = new DigestRequest(request);

            if (!req.authorizationKey()) return self.Unauthorized();
            if (!req.isDigest()) return self.BadRequest;
            if (!req.isCorrectUri()) return self.BadRequest;

            if (!self.isValidQOP(req)) return self.BadRequest;
            if (!self.isValidOpaque(req)) return self.Unauthorized();
            if (!self.isValidDigest(req)) return self.Unauthorized();

            if (!req.decodeNonce().isValid()) return self.Unauthorized();
            if (!req.decodeNonce().isFresh()) return self.Unauthorized(self.issueChallenge({stale: true}));

            request.remoteUser = req.username;
            return app(request);
        }
    },

    params: function(options) {
        return update(options || {}, {
            realm: this.realm,
            nonce: new DigestNonce.Nonce().toString(),
            opaque: H(this.opaque),
            qop: qopSupported.join(',')
        });
    },

    issueChallenge: function(options) {
        return "Digest " + DigestParams.toString(this.params(options));
    },

    isValidQOP: function(req) {
        return qopSupported.indexOf(req.qop) != -1;
    },

    isValidOpaque: function(req) {
        return H(this.opaque) == req.opaque;
    },

    isValidDigest: function(req) {
        return digest(req, this.getPassword(req.username)) == req.response;
    }
});

/********************************************************
 *  Digest Auth Middleware
 ********************************************************/

exports.Middleware = function(app, options) {
    return new Handler(options).generate(app);
};