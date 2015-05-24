var aws = require('aws-sdk');
var fs = require('fs');
var http = require('http');
var CryptoJS = require("crypto-js");
exports.aws = aws;

var s3;
var tmpDir = "/tmp";
var zipFile = tmpDir+"/archive.zip";
var bucket;
var uuid;
var password;
var ctx;
exports.handler = function(event, context) {
  ctx = context;
  bucket = event.Records[0].s3.bucket.name;
  var key = event.Records[0].s3.object.key;
  var region = event.Records[0].awsRegion;
  var op = event.Records[0].eventName;
  if (op !== "ObjectCreated:Put") {
    context.done(null, 'op');
    return;
  }
  var regexp = /upload\/([0-9a-z\-]*)\/request.json/;
  var match = regexp.exec(key);
  if (match === null) {
    context.done(null, 'except upload');
    return;
  }
  uuid = match[1];
  s3 = new aws.S3({
    region : region
  });
  var prefix = "upload/" + uuid + "/";
  loadAllFiles(createZipFile,bucket, prefix);
};
function createZipFile() {
  var request = JSON.parse(fs.readFileSync(tmpDir+"/request.json"));
  password = request.password;
  var child = require('child_process').spawn('java', [ "-cp", "/var/task:/var/task/*", "Zip",
  zipFile,password,tmpDir,"request.json"]);
  child.stdout.on('data', function(data) {
    console.log("stdout:" + data);
  });
  child.stderr.on('data', function(data) {
    console.log("stderr:" + data);
  });
  child.on('close', function(code) {
    uploadZip();
  });
};
function uploadZip(){
  var body = fs.readFileSync(zipFile);
  var passwordDir = CryptoJS.SHA3(password).toString(CryptoJS.enc.Hex);
  var key = "download/"+uuid+"/"+passwordDir+"/archive.zip";
  console.log("upload:"+key);
  s3.putObject({
    Bucket:bucket,
    Body : body,
    Key:key
  }, function(err) {
     if(err){
       console.log(err);
       ctx.done(null,"create:"+key);
     }else{
       ctx.done(null,"error:"+key);
     }
  });
};
function loadAllFiles(callback, bucket, prefix) {
  s3.listObjects({
    Bucket : bucket,
    Prefix : prefix
  }, function(err, data) {
    if (err) {
      throw err;
    } else {
      var cb = (function(jobNum, callback) {
        var counter = 0;
        return function() {
          if (++counter===jobNum) {
            callback();
          }
        };
      })(data.Contents.length, callback);
      for (var i = 0; i < data.Contents.length; i++) {
        console.log(data.Contents[i].Key);
        loadObject(cb, bucket, data.Contents[i].Key);
      }
    }
  });
};
function loadObject(callback, bucket, key) {
  s3.getObject({
    Bucket : bucket,
    Key : key
  }, function(err, data) {
    if (err) {
      throw err;
    } else {
      console.log("load:" + key);
      if(key.endsWith("/")===false){
        var paths = key.split('/');
        var fileName = paths[paths.length-1];
        console.log(tmpDir + '/' + fileName);
        fs.writeFileSync(tmpDir + '/' + fileName, data.Body);
      }
      callback();
    }
  });
};

String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};
