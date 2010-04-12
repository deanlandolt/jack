var FILE = require("file"),
    Utils = require("./utils"),
    MIME = require("./mime");

exports.File = function(root, options) {
    root = FILE.path(root).absolute();
    options = options || {};
    var indexes = options.indexes || [];
    if (typeof indexes === "string")
        indexes = [indexes];

    return function(env) {
        var pathInfo = Utils.unescape(env["PATH_INFO"]);

        if (pathInfo.indexOf("..") >= 0)
            return Utils.responseForStatus(403);

        var path = pathInfo ? root.join(pathInfo) : root;

        try {
            if (path.isFile() && path.isReadable()) {
                return serve(path);
            }
            else if (indexes.length > 0 && path.isDirectory()) {
                for (var i = 0; i < indexes.length; i++) {
                    var indexPath = path.join(indexes[i]);
                    if (indexPath.isFile() && indexPath.isReadable())
                        return serve(indexPath);
                }
            }
        } catch(e) {
            env["jsgi.errors"].print("Jack.File error: " + e);
        }

        return Utils.responseForStatus(404, pathInfo);
    }
}

function serve(path) {
    return {
        status : 200,
        headers : {
            "Content-Type"      : MIME.mimeType(path.extension(), "text/plain"),
            "Content-Length"    : "0"
        },
        body : {
            path: path.toString(),
            forEach: function(c) {
                var f = FILE.open(path.toString(), "b");
                var bytes;
                while(bytes = f.read(null))
                    c(bytes);
                f.close();
            }
        }
    };
}
