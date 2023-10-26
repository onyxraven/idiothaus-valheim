import * as ftp from "basic-ftp";
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3';
import tmp from 'tmp-promise';
import * as fs from "fs";
import { basename } from "path";

/**
 * A Lambda function that logs the payload received from a CloudWatch scheduled event.
 */
export const scheduledEventLoggerHandler = async (event, context) => {
  // All log statements are written to CloudWatch by default. For more information, see
  // https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-logging.html
  console.info(JSON.stringify(event));
  const ftps = new ftp.Client()
  const s3 = new S3Client({})

  console.log('login to server');
  await ftps.access({
    host: process.env['FTP_HOST'],
    port: process.env['FTP_PORT'],
    user: process.env['FTP_USERNAME'],
    password: process.env['FTP_PASSWORD'],
    secure: true,
    secureOptions: { rejectUnauthorized: false }
  });

  await transfer(ftps, s3, process.env['FTP_PREFIX'] + '/servermaps/1.mapparts.gzip');
  await transfer(ftps, s3, process.env['FTP_PREFIX'] + '/worlds/1.world.gzip');

  await ftps.close();
};

async function transfer(ftps, s3, path) {

  const tmpfile = await tmp.file();

  console.log('initate download ' + path + " to " + tmpfile.path);
  await ftps.downloadTo(tmpfile.path, path);

  console.log('initate upload');
  const uploadS3 = new Upload({
    client: s3,
    params: {
      Bucket: process.env['S3_BUCKET'],
      Key: process.env['S3_PREFIX'] + '/' + basename(path),
      Body: fs.createReadStream(tmpfile.path),
    },
  });

  uploadS3.on("httpUploadProgress", (progress) => {
    console.log(progress);
  });

  await uploadS3.done();
  console.log('complete');

  tmpfile.cleanup();
}
