var fs = require("promised-io/fs"),
    defer = require("promised-io/promise").defer,
    when = require("promised-io/promise").when,
    mime = require("./mime");

exports.Static = function(options, nextApp){
    options = options || {};
    var urls = options["urls"] || ["/favicon.ico"],
        roots = options["roots"] || [""];

    return function(request) {
        var path = request.pathInfo;
        for (var i = 0; i < urls.length; i++) {
            if (path.indexOf(urls[i]) === 0) {
                var rootIndex = 0;
                var responseDeferred = defer();
                checkNextRoot();
                return responseDeferred.promise;
            }
        }
        return {
            status: 404,
            headers: {},
            body: [path + " not found"]
        };
        function checkNextRoot(){
            if(rootIndex >= roots.length){
                responseDeferred.resolve(nextApp ? nextApp(request) :
                {
                    status: 404,
                    headers: {},
                    body: [path + " not found"]
                });
                return;
            }
            var file = roots[rootIndex] + path;
            rootIndex++;
            when(fs.stat(file), function (stat) {
                    if (stat.isFile()) {
                        // file exists.
                        print('wtf', stat.toSource())
                        fs.open(file, process.O_RDONLY, 0666)
                            .then(function (file) {
                                var extension = path.match(/\.[^\.]+$/);
                                extension = extension && extension[0];
                                var bodyDeferred = defer();
                                var write;
                                file.encoding = "binary";
                                responseDeferred.resolve({
                                    status: 200,
                                    headers: {
                                        "content-length": stat.size,
                                        "content-type": extension && mime.mimeType(extension)
                                    },
                                    body: file
                                });
                            }, checkNextRoot);
                    }
                    else{
                        checkNextRoot();
                    }
            }, checkNextRoot);
        }
    };
};
