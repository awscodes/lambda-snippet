var http = require ('http');
exports.handler = function(event, context) {
    console.log('value1 = ' + event.key1);
    http.get("http://www.google.com/index.html", function(res) {
        console.log("Got response: " + res.statusCode);

        res.on("data", function(chunk) {
            context.done(null, chunk);
        });
    }).on('error', function(e) {
        context.done('error', e);
    });
};
