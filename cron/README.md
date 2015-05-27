AWS Lambda Cron
---------------
The cron interval is 60 seconds at most. This is because not be timeout setting is only set up to 60 seconds of lambda. By setTimeout in smaller than this number, we have to allow for things like pseudo loop. The setTimeout setting would be better to have a margin about 5-10 seconds so too the last minute it's 60 seconds of max.

* You will leave the (preparation) the timeout setting of Lambda 60 seconds (Max)
* A job is the contents of the file to "0" to upload to S3 (actually "1" I would move any time, because of the log sorting)
* Lambda will enter an infinite loop as long as it is a 0 or 1 to see the contents of the job file
* It will do something any of processing: A job is "9" When you upload it to the S3 to the (OK if other than 0/1), the job is terminated 
