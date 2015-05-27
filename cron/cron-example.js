console.log('Loading event');
var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});
var request = require('request');

var jobctl_key_name = "sample/job" // file name to perform the job control
var interval = 30 * 1000 // processing interval.  Here it is running in 30-second intervals.

 // The s3file job control of the status it is update
function change_status(bucket, key, content_type, callback) {
  s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: new Buffer("1", 'binary'), // update running...
      ContentType: content_type
  }, callback);
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
               //console.log('BODY:('+body+')');
               if(body == 0) {
                   console.log('- start')
                   change_status(bucket, key, content_type, function(err){
                     if(err) context.done(err,  "- change_status_error");
                     else    context.done(null, "- running...");
                   });
               } else if(body == 1) {
                   console.log('- runnning...')
                   change_status(bucket, key, content_type, function(err){

                   //////////////////////////////////////////////                     
                   // Put a like process in this area


                     if(err) context.done(err,  "- change_status_error");
                     else    context.done(null, "- running...");
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
