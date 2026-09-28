import { describe, expect, it } from 'vitest';
import { presignGet } from '../storage/presign.ts';

describe('presignGet', () => {
  it('matches the example in the AWS SigV4 query-string documentation', () => {
    /* docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html */
    const url = presignGet({
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      region: 'us-east-1',
      service: 's3',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      now: new Date('2013-05-24T00:00:00Z'),
      expiresIn: 86400,
    });
    expect(url).toContain(
      'X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });
});
