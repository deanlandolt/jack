var Request = require("./request").Request;

/**
 * Provides Rails-style HTTP method overriding via the _method parameter or X-HTTP-METHOD-OVERRIDE header
 * http://code.google.com/apis/gdata/docs/2.0/basics.html#UpdatingEntry
 */
exports.MethodOverride = function(app) {
    return function(request) {
        if (request.method == "POST") {
            var req = new Request(request),
                method = request.headers[HTTP_METHOD_OVERRIDE_HEADER] || req.POST(METHOD_OVERRIDE_PARAM_KEY);
            if (method && HTTP_METHODS[method.toUpperCase()] === true) {
                request.env.jack.methodoverride.original_method = request.method;
                request.method = method.toUpperCase();
            }
        }
        return app(request);
    }
}

var HTTP_METHODS = {"GET":true, "HEAD":true, "PUT":true, "POST":true, "DELETE":true, "OPTIONS":true};
var METHOD_OVERRIDE_PARAM_KEY = "_method";
var HTTP_METHOD_OVERRIDE_HEADER = "x-http-method-override";
