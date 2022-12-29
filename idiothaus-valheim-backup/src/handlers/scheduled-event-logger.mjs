import Client from 'ssh2-sftp-client';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3';
import tmp from 'tmp-promise';
import * as fs from "fs";

/**
 * A Lambda function that logs the payload received from a CloudWatch scheduled event.
 */
export const scheduledEventLoggerHandler = async (event, context) => {
  // All log statements are written to CloudWatch by default. For more information, see
  // https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-logging.html
  console.info(JSON.stringify(event));
  const sftp = new Client()
  const s3 = new S3Client({})

  console.log('login to server');
  await sftp.connect({
    host: process.env['SFTP_HOST'],
    port: process.env['SFTP_PORT'],
    username: process.env['SFTP_USERNAME'],
    password: process.env['SFTP_PASSWORD'],
  });

  await transfer(sftp, s3, '.db');
  await transfer(sftp, s3, '.fwl');

  await sftp.end();
};

async function transfer(sftp, s3, ext) {

  const tmpfile = await tmp.file();

  console.log('initate download ' + ext + " to " + tmpfile.path);
  await sftp.fastGet(process.env['SFTP_PATH'] + ext, tmpfile.path, {concurrency: 2});

  console.log('initate upload');
  const parallelUploads3 = new Upload({
    client: s3,
    params: {
      Bucket: process.env['S3_BUCKET'],
      Key: process.env['S3_KEY'] + ext,
      Body: fs.createReadStream(tmpfile.path),
    },
  });

  parallelUploads3.on("httpUploadProgress", (progress) => {
    console.log(progress);
  });

  await parallelUploads3.done();
  console.log('complete');

  tmpfile.cleanup();
}
