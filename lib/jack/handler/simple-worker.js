var IO = require("io").IO,
    ByteArray = require("binary").ByteArray,
    file = require("file"),
    when = require("promise").when,
    Promise = require("promise").Promise,
    HTTP_STATUS_CODES = require("../utils").HTTP_STATUS_CODES,
    jackup = require("jackup"),
    URI = require("uri").URI;

onstart = function(options) {
    jackup.start(options);
};
exports.run = function(app, options) {
    onrequest = function(servletRequest, servletResponse) {
        var request = {headers:{}};
	
        // copy HTTP headers over, converting where appropriate
        for (var e = servletRequest.getNames().iterator(); e.hasNext();) {
            var name = e.next() + "",
                key = name.toLowerCase();
	    
	    // TODO handle multiple header values, but servletRequest.getValues is broken
	    /*for (var f = servletRequest.getValues(name).iterator(); f.hasNext();) {
		var value = f.next() + "";
		if (request.headers[key]) {
		    if (typeof request.headers[key] === "string") {
			request.headers[key] = [request.headers[key]];
		    }
		    request.headers[key].push(value);
		}
		else {
		    request.headers[key] = value;
		}
	    }*/
	    request.headers[key] = servletRequest.getValue(name) + "";
        }
	
	// FIXME do this at all? if so should it be after getDomain, getPort?
        if (request.headers.host) {
            var parts = request.headers.host.split(":");
            if (parts.length === 2) {
                request.host = parts[0];
                request.port = parseInt(parts[1], 10);
            }
        }
	
        var address = servletRequest.getAddress();
        var uri = URI.parse(String(servletRequest.getTarget()));
	
        request.scheme = String(address.getScheme() || "http");
        request.host = request.host || String(address.getDomain() || "");
        request.port = request.port || String(address.getPort() || "");
	
        request.scriptName = "";
        request.pathInfo = uri.path || "/"; // FIXME should default to "/" right?
	
        request.method = String(servletRequest.getMethod() || "");
        request.queryString = uri.query || "";
        request.version = [servletRequest.getMajor(), servletRequest.getMinor()];

        var cAddr, addr;
        if (cAddr = servletRequest.getClientAddress())
            request.remoteHost = String(cAddr.getHostName() || cAddr.getAddress() || "");
	
	// changes request.input stream to request.body forEachable
        request.body = {
	    forEach: function(write) {
		// TODO can this be done async?
		var reader = new java.io.InputStreamReader(servletRequest.getInputStream()),
		    ba = new ByteArray(),
		    b;
		while ((b = reader.read()) > -1) {
		    ba.push(b);
		    if (ba.length >= 1024) {
			write(ba);
			ba.length = 0;
		    }
		}
		if (ba.length > 0) write(ba);
		request.input.close();
		
		// if we could do this async we would would a promise
	    }
	};
	
        request.jsgi = {
	    version: [0,3],
            errors: system.stderr,
            multithread: false,
            multiprocess: true,
            async: true,
            runOnce: false
	};
	
	request.env = {};
	
        // efficiently serve files if the server supports it
        request.headers["x-sendfile"] = "yes";
        
	// call the app
        var responsePromise = app(request);
        var output, responseStarted = false;
	
        // use the promise manager to determine when the app is done
        // in a normal sync request, it will just execute the fulfill
        // immediately
        when(responsePromise, function(response) {
                // success handler
                try {
		    handleResponse(response);
		}
		catch(e) {
		    servletResponse.getOutputStream().write(e);
		}
	    }, function(error) {
		// unhandled error
		handleResponse({status:500, headers:{}, body:[error.message]});
	    }
	);
	
        function handleResponse(response) {
	    if (!responseStarted) {
		responseStarted = true;
		// set the status
		servletResponse.setCode(response.status);
		servletResponse.setText(HTTP_STATUS_CODES[response.status]);
		
		// check to see if X-Sendfile was used, remove the header
		var sendfilePath = null;
		if (response.headers["x-sendfile"]) {
		    sendfilePath = response.headers["x-sendfile"];
		    delete response.headers["x-sendfile"];
		    response.headers["content-length"] = file.size(sendfilePath) + "";
		}
		
		// set the headers
		for (var key in response.headers) {
		    var headerValue = response.headers[key];
		    if (typeof headerValue === "string") headerValue = [headerValue];
		    headerValue.forEach(function(value) {
			servletResponse.add(key, value);
		    });
		}
		
		// determine if the response should be chunked (FIXME: need a better way?)
		var chunked = response.headers["transfer-encoding"] && response.headers["transfer-encoding"] !== 'identity';
		
		output = new IO(null, servletResponse.getOutputStream());
		
		// X-Sendfile send
		if (sendfilePath) {
		    var cIn  = new java.io.FileInputStream(sendfilePath).getChannel(),
			cOut = servletResponse.getByteChannel();
		    
		    cIn.transferTo(0, cIn.size(), cOut);
		    
		    cIn.close();
		    cOut.close();
		}
		
		try {
		    if (typeof response.body.forEach !== "function")
			throw new Error("The body does not have a forEach function");
		    
		    var forEachResult = response.body.forEach(function(chunk) {
			if (!sendfilePath) {
			    output.write(chunk);
			    if (chunked) output.flush();
			}
		    });
		    
		    if (forEachResult && typeof forEachResult.then === "function") {
			// called when response.body.forEach promise resolves
			forEachResult.then(function() {
			    responseFinish();
			});
		    }
		    else {
			responseFinish();
		    }
		}
		catch (e) {
		    output.write(String((e.rhinoException && e.rhinoException.printStackTrace()) || (e.name + ": " + e.message)));
		    if (chunked){
			output.flush();
		    }
		}
	    }
	    
	    function responseFinish() {
		if (typeof response.body.close === "function")
		    response.body.close();
		servletResponse.getOutputStream().close();
	    }
	};
    }
};