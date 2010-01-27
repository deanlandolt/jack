var util = require("util"),
    Request = require("jack/request").Request,
    Response = require("jack/response").Response,
    sha = require("sha");

var loadSession = function(request){
    var options = request.env.jack.session.options,
        key = options.key,
        secret = options.secret;

    var req = new Request(env);
    var cookie = req.cookies()[key];

    if (cookie){
        var parts = decodeURIComponent(cookie).split("--"),
            digest = request.env.jack.session.digest = parts[1],
            sessionData = parts[0];

        if (digest == sha.hash(sessionData + secret).decodeToString(64))  {
            return JSON.parse(sessionData);
        }
    }

    return {};
}

var commitSession = function(request, jackResponse, key, secret){
    var session = request.env.jack.session;

    if (!session) return jackResponse;

    var sessionData = JSON.stringify(session);

    var digest = sha.hash(sessionData + secret).decodeToString(64);

    // do not serialize if the session is not dirty.
    if (digest == request.env.jack.session.digest) return jackResponse;

    sessionData = sessionData + "--" + digest;

    if (sessionData.length > 4096) {
        request.jsgi.errors.write("Session Cookie data size exceeds 4k! Content dropped");
        return jackResponse;
    }
    
    var options = request.env.jack.session.options;

    var cookie = {value: sessionData, path: "/"};
    if (options["expires_after"])
        cookie.expires = new Date() + options["expires_after"];

    var response = new Response(jackResponse.status, jackResponse.headers, jackResponse.body);
    response.setCookie(key, cookie);

    return response;
}

/**
 * Cookie Session Store middleware.
 * Does not implicitly deserialize the session, only serializes the session if
 * dirty.
 */
var Cookie = exports.Cookie = function(app, options) {
    options = options || {};
    util.update(options, /* default options */ {
        key: "jsgi.session",
        domain: null,
        path: "/",
        expire_after: null
    });

    if (!options.secret) throw new Error("Session secret not defined");

    var key = options.key,
        secret = options.secret;

    return function(request) {
        request.env.jack.session.loadSession = loadSession;
        request.env.jack.session.options = options;

        var jackResponse = app(request);

        return commitSession(request, jackResponse, key, secret);
    }
}
