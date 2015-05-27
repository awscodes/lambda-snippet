console.log('Loading event');
var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});
var cloudwatch = new aws.CloudWatch();
var request = require('request');

var jobctl_key_name = "sample2_cloudwatch/job"
var interval = 50 * 1000 // 50sec


// put cloudwatch
function put_cloudwatch(count, callback) {
  var params = {
    MetricData: [ /* required */
      {
        MetricName: 'hatebu_count',
        Dimensions: [
          {
            Name: 'Site',
            Value: 'niconico'
          },
        ],
        Timestamp: new Date,
        Unit: 'None',
        Value: Number(count)
      },
    ],
    Namespace: 'CUSTOM/Hatena'
  };
  // put metrics
  cloudwatch.putMetricData(params, callback)
}


// s3file change_status
function change_status(bucket, key, content_type, callback) {
  s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: new Buffer("1", 'binary'), // update running...
      ContentType: content_type
  }, callback);
}

var http = require("http")
// this somewhere at the top of your code:
var rootUri = 'http://api.com/';
var request = require('request').defaults({});
var cache_url = {}
function get_hatebu (callback) {
  request.get(rootUri, function(err, response, body) {
    if (err) {
      console.log(err)
    }
    if (response.statusCode !== 200) {
      console.log("internal error " + response.statusCode)
    }

    // put
    put_cloudwatch(body, callback);
  });
}

// Main Handler
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
                   change_status(bucket, key, content_type, function(err){
                     if(err) {
                       console.log(err)
                       context.done("change_status error", err);
                     } else {
                       context.done(null, "");
                     }
                   });
               } else if(body == 1) {
                   console.log('- runnning...')
                   change_status(bucket, key, content_type, function(err){
                     if(err) {
                       console.log(err)
                       context.done("change_status error", err);
                     } else {
                       get_hatebu(function(err, data){
                         if(err) {
                           console.log(err)
                           context.done("get hatebu error", err);
                         } else {
                           context.done(null, "");
                         }
                       })
                     }
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
