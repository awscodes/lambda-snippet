console.log('Loading event');
var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});
var ets = new aws.ElasticTranscoder({apiVersion: '2012-09-25', region: 'us-east-1'});

exports.handler = function(event, context) {
   console.log('Received event:');
   console.log(JSON.stringify(event, null, '  '));
   var bucket = event.Records[0].s3.bucket.name;
   var key = event.Records[0].s3.object.key;
   var pipelineId = key.split('/')[0];
   var presetId = key.split('/')[1];
   var fileName = (key.split('/')[2]).split('.')[0];
   s3.getObject({Bucket:bucket, Key:key},
      function(err,data) {
        if (err) {
           console.log('error getting object ' + key + ' from bucket ' + bucket +
               '. Make sure they exist and your bucket is in the same region as this function.');
           context.done('error','error getting file'+err);
        } else {
            console.log("### JOB KEY ### " + key);
            ets.createJob({
                PipelineId: pipelineId,
                OutputKeyPrefix: 'demo/',
                Input: {
                    Key: key,
                    FrameRate: 'auto',
                    Resolution: 'auto',
                    AspectRatio: 'auto',
                    Interlaced: 'auto',
                    Container: 'auto',
                },
                Output: {
                    Key: fileName + '.mp4',
                    ThumbnailPattern: fileName + '-thumbs-{count}',
                    PresetId: presetId,
                    Rotate: 'auto'
                }
            }, function(error, data) {
                if(error) {
                    console.log(error);
                } else {
                    console.log('Job submitted');
                }
            });
           context.done(null,'');
        }
      }
    );
};
