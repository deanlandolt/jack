// a short url shortener. no persistance.
exports.app=function(e){return e.pathInfo!='/'?{status:301,headers:{'location':d[e.pathInfo.substr(1)]},body:[]}:{status:200,headers:{'content-type':'text/html'},body:[e.queryString?''+(d.push(decodeURIComponent(e.queryString.substr(2)))-1):'<form><input name="u"/></form>']}};d=[]
