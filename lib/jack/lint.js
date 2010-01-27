var utils = require("./utils");

var Lint = exports.Lint = function(app) {
    return function(request) {
        return (new Lint.Context(app)).run(request);
    }
}

Lint.Context = function(app) {
    this.app = app;
}

Lint.Context.prototype.run = function(request) {
    if (!request)
        throw new Error("No request object given");
    
    this.checkRequest(request);
    
    var response = this.app(request);
    
    this.body = response.body;
    
    if (typeof this.body === "string")
        throw new Error("Body must implement forEach.");

    this.checkStatus(response.status);
    this.checkHeaders(response.headers);
    this.checkContentType(response);
    this.checkContentLength(response.status, response.headers, request);
    
    return {
        status : response.status,
        headers : response.headers,
        body : this
    };
}

Lint.Context.prototype.forEach = function(block) {
    return this.body.forEach(function(part) {
        if (part === null || part === undefined || typeof part.toByteString !== "function")
            throw new Error("Body yielded value that can't be converted to ByteString ("+(typeof part)+","+(typeof part.toByteString)+"): " + part);
        block(part);
    });
}

Lint.Context.prototype.close = function() {
    if (this.body.close)
        return this.body.close();
}

Lint.Context.prototype.checkRequest = function(request) {
    if (request && typeof request !== "object" || request.constructor !== Object)
        throw new Error("request is not an object");
    
    // The request environment must not contain the keys
    // <tt>contentType</tt> or <tt>contentLength</tt>
    // (they should be in <tt>headers</tt> instead).
    ["contentType", "contentLength"].forEach(function(key) {
        if (request[key] !== undefined)
            throw new Error("request contains " + key + ", should be in headers object");
    });
    
    /* DL: NOT ANYMORE...
    // The CGI keys (named without a period) must have String values.
    for (var key in request)
        if (key.indexOf(".") == -1)
            if (typeof request[key] !== "string")
                throw new Error("request variable " + key + " has non-string value " + request[key]);
    */
    
    // * <tt>jsgi.version</tt> must be an array of Integers.
    if (typeof request.jsgi.version !== "object" && !Array.isArray(request.jsgi.version))
        throw new Error("jsgi.version must be an Array, was " + request.jsgi.version);
        
    // * <tt>scheme</tt> must either be +http+ or +https+.
    if (request.scheme !== "http" && request.scheme !== "https")
        throw new Error("scheme unknown: " + request.scheme);
    
    // * There must be a valid input stream in <tt>input</tt>.
    this.checkInput(request.input);
    // * There must be a valid error stream in <tt>jsgi.errors</tt>.
    this.checkError(request.jsgi.errors);
    
    // * The <tt>REQUEST_METHOD</tt> must be a valid token.
    if (!(/^[0-9A-Za-z!\#$%&'*+.^_`|~-]+$/).test(request.method))
        throw new Error("method unknown: " + request.method);

    // * The <tt>scriptName</tt>, if non-empty, must start with <tt>/</tt>
    if (request.scriptName && request.scriptName.charAt(0) !== "/")
        throw new Error("scriptName must start with /");
    
    // * The <tt>pathInfo</tt>, if non-empty, must start with <tt>/</tt>
    if (request.pathInfo && request.pathInfo.charAt(0) !== "/")
        throw new Error("pathInfo must start with /");
    
    // * The <tt>headers["content-length"]</tt>, if given, must consist of digits only.
    if (request.headers["content-length"] !== undefined && !(/^\d+$/).test(request.headers["content-length"]))
        throw new Error("Invalid content-length header: " + request.headers["content-length"]);

    // * One of <tt>scriptName</tt> or <tt>pathInfo</tt> must be
    //   set.  <tt>pathInfo</tt> should be <tt>/</tt> if
    //   <tt>scriptName</tt> is empty.
    if (request.scriptName === undefined && request.pathInfo === undefined)
        throw new Error("One of scriptname or pathInfo must be set (make pathInfo '/' if scriptName is empty)")
        
    //   <tt>scriptName</tt> never should be <tt>/</tt>, but instead be empty.
    if (request.scriptName === "/")
        throw new Error("scriptName cannot be '/', make it '' and pathInfo '/'")
}
Lint.Context.prototype.checkInput = function(input) {
    // FIXME:
    /*["gets", "forEach", "read"].forEach(function(method) {
        if (typeof input[method] !== "function")
            throw new Error("jsgi.input " + input + " does not respond to " + method);
    });*/
}
Lint.Context.prototype.checkError = function(error) {
    ["print", "write", "flush"].forEach(function(method) {
        if (typeof error[method] !== "function")
            throw new Error("jack.error " + error + " does not respond to " + method);
    });
}
Lint.Context.prototype.checkStatus = function(status) {
    if (!(parseInt(status) >= 100))
        throw new Error("Status must be >=100 seen as integer");
}
Lint.Context.prototype.checkHeaders = function(headers) {
    for (var key in headers) {
        var value = headers[key];
        // The header keys must be Strings.
        if (typeof key !== "string")
            throw new Error("header key must be a string, was " + key);
            
        // The header must not contain a +Status+ key,
        if (key.toLowerCase() === "status")
            throw new Error("header must not contain Status");
        // contain keys with <tt>:</tt> or newlines in their name,
        if ((/[:\n]/).test(key))
            throw new Error("header names must not contain : or \\n");
        // contain keys names that end in <tt>-</tt> or <tt>_</tt>,
        if ((/[-_]$/).test(key))
            throw new Error("header names must not end in - or _");
        // but only contain keys that consist of
        // letters, digits, <tt>_</tt> or <tt>-</tt> and start with a letter.
        if (!(/^[a-zA-Z][a-zA-Z0-9_-]*$/).test(key))
            throw new Error("invalid header name: " + key);
        // The values of the header must respond to #forEach.
        if (typeof value !== "string")
            throw new Error("header values must be strings, but the value of '" + key + "' isn't: " + value + "(" + (typeof value) + ")")
            
        value.split("\n").forEach(function(item) {
            // must not contain characters below 037.
            if ((/[\000-\037]/).test(item))
                throw new Error("invalid header value " + key + ": " + item);
        });
    }
}
Lint.Context.prototype.checkContentType = function(response) {
    var contentType = !!response.headers["content-type"],
        noBody = utils.STATUS_WITH_NO_ENTITY_BODY(parseInt(response.status));
    
    if (noBody && contentType)
        throw new Error("content-type header found in " + response.status + " response, not allowed");
    if (!noBody && !contentType)
        throw new Error("No content-type header found");
}
Lint.Context.prototype.checkContentLength = function(status, headers, request) {
    var chunkedResponse = headers["transfer-encoding"] && headers["transfer-encoding"] !== 'identity';
    
    var value = headers["content-length"];
    if (value) {
        // There must be a <tt>Content-Length</tt>, except when the
        // +Status+ is 1xx, 204 or 304, in which case there must be none
        // given.
        if (utils.STATUS_WITH_NO_ENTITY_BODY(parseInt(status, 10)))
            throw new Error("content-length header found in " + status + " response, not allowed");
        
        if (chunkedResponse)
            throw new Error('The content-length header should not be used if body is chunked');
        
        var bytes = 0,
            stringBody = true;
        
        this.body.forEach(function(part) {
            if (typeof part !== "string")
                stringBody = false;
            bytes += (part && part.length) ? part.length : 0;
        });
        
        if (request.method === "HEAD")
        {
            if (bytes !== 0)
                throw new Error("Response body was given for HEAD request, but should be empty");
        }
        else if (stringBody)
        {
            if (value !== bytes.toString())
                throw new Error("The content-length header was " + value + ", but should be " + bytes);
        }
    }
    else {
        if (!chunkedResponse && (typeof this.body === "string" || Array.isArray(this.body)))
            if (!utils.STATUS_WITH_NO_ENTITY_BODY(parseInt(status, 10)))
                throw new Error('No content-length header found');
    }
}
