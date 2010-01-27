var when = require("promise").whenPreservingType;

var ShowExceptions = exports.ShowExceptions = function(app) {
    return function(request) {
        return when(app(request),
            function(response) {
                return response;
            },
            function(e) {
                var backtrace = "<html><body><pre>" + e.name + ": " + e.message;
                if (e.rhinoException) {
                    //FIXME abstract and move to engines/rhino
                    backtrace += "\n" + e.rhinoException.getScriptStackTrace();
                }
                backtrace += "</body></html>";
                return {
                    status: 500,
                    headers: {"content-type":"text/html", "content-length": backtrace.length + ""},
                    body: [backtrace]
                };
            }
        );
    }
}
