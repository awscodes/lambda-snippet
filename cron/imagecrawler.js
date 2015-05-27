console.log('Loading event');
var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});
var request = require('request');
var fs = require('fs');

var jobctl_key_name = "sample1_aggregate/job"
var interval = 30 * 1000 // 30sec
var dest_bucket = "crawl"

// s3file change_status
function change_status(bucket, key, content_type, callback) {
  s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: new Buffer("1", 'binary'), // update running...
      ContentType: content_type
  }, callback);
}

// s3file upload
function s3_upload (bucket, key, body) {
  s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: body,
  }, function(err, res) {
      if (err) {
        console.error(err);
        context.done('error putting object', err);
      } else {
        console.log('upload ok');
        console.log(JSON.stringify(res, null, 2));
        context.done(null, "success putting object");
      }
  });
}

function shuffle(x){
  x = x || []
  for(var i = 0, y = [], len = x.length; i < len; i++)
    y.push( x.splice( Math.random() * x.length | 0, 1)[0]);
  return y;
}

var http = require("http")
var acctKey = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';  // bing Key
var rootUri = 'https://api.datamarket.azure.com/Bing/Search';
var auth    = new Buffer([ acctKey, acctKey ].join(':')).toString('base64');
var option = {
  headers : {
    'Authorization' : 'Basic ' + auth
  }
};
var request = require('request').defaults(option);
var cache_url = {}
function bing_api (bucket, callback) {
  var service_op  = "Image";
  var query       = "san francisco"; // search keyword
  request.get({
    url : rootUri + '/' + service_op,
    qs  : {
      $format : 'json',
      Query   : "'" + query + "'", // the single quotes are required!
    }
  }, function(err, response, body) {
    if (err) {
      console.log(err)
    }
    if (response.statusCode !== 200) {
      console.log("internal error " + response.statusCode)
    }
    var results = JSON.parse(response.body);
    var sresult = shuffle(results.d.results)
    var len = (sresult.length >= 10) ? 10 : sresult.length
    var plen = 0;
    
    // Up to a maximum of 10 (which according to the number of maximum outbound?)
    for(var i=0;i<len;i++) {
      var row = sresult[i];
      var media_url = row.MediaUrl
      var enc_media_url = encodeURIComponent(media_url)
      // Treated URL Skip
      if(cache_url[enc_media_url]) {
        plen++
        continue;
      }
      // To process only HTTP (negligence)
      if(!media_url.match(/^http:\/\//)) {
        plen++
        continue;
      }

      var file_name = "/tmp/" + enc_media_url;
      var file = fs.createWriteStream(file_name);
      // get image
      http.get(media_url, function(res) {
        res.on('data', function(data) {
              file.write(data);
          }).on('end', function() {
              file.end();
              console.log(' downloaded to ' + file_name);
              cache_url[enc_media_url] = true;
              var body = fs.readFileSync(file_name);
              s3_upload(dest_bucket, enc_media_url, body);
              plen++
          });
      }).on('error', function(e) {
        plen++
        console.log(e)
      });
    }

    // check
    var timer = setInterval(function(){
      // 全処理終了後にcallback
      if(plen >= len) {
        clearInterval(timer)
        return callback()
      }
    }, 1000);
  });
}

 // Main handler
exports.handler = function(event, context) {
   console.log('Received event:' + Date.now());
   console.log(JSON.stringify(event, null, '  '));
   // Get the object from the event and show its content type
   var bucket = event.Records[0].s3.bucket.name;
   var key = event.Records[0].s3.object.key;
   // set timeout
   setTimeout(function() {
     if(key == jobctl_key_name) {
       s3.getObject({Bucket:bucket, Key:key},
          function(err,data) {
            if (err) {
               console.log('error getting object ' + key + ' from bucket ' + bucket +
                   '. Make sure they exist and your bucket is in the same region as this function.');
               context.done('error','error getting file'+err);
            }
            else {
               var content_type = data.ContentType;
               var body = data.Body.toString("utf-8");
               if(body == 0) {
                   console.log('- start')
                   change_status(bucket, key, content_type, function(err) {
                     if(err) context.done(err, "- change status error");

                     bing_api(bucket, function(){
                       context.done(null, "");
                     })
                   });
               } else if(body == 1) {
                   console.log('- runnning...')
                   change_status(bucket, key, content_type, function(err){
                     if(err) context.done(err, "- change status error");

                     bing_api(bucket, function(){
                       context.done(null, "");
                     })
                   });
               } else {
                   console.log('- finish')
                   context.done(null, "- finish");
               }
            }
          }
       );
     } else {
        context.done(null, "");
     }
   }, interval);
};
