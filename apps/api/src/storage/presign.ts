import { createHash, createHmac } from 'node:crypto';

/**
 * AWS Signature V4 query signing for a GET, done synchronously.
 *
 * aws4fetch (used for uploads) signs asynchronously through WebCrypto. Reads
 * are signed inside projections, which are plain synchronous functions, and a
 * list of forty tickets should not become forty awaits — so this is the
 * handful of HMACs SigV4 needs, written out. Verified against AWS's published
 * example in __tests__/presign.test.ts.
 */
export interface PresignInput {
  host: string;
  /** Already-decoded path, starting with '/'. Each segment is encoded here. */
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  now: Date;
  expiresIn: number;
}

const encode = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data, 'utf8').digest();
const sha256 = (data: string) => createHash('sha256').update(data, 'utf8').digest('hex');

export function presignGet(input: PresignInput): string {
  const amzDate = input.now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${input.region}/${input.service}/aws4_request`;

  const query: [string, string][] = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${input.accessKeyId}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(input.expiresIn)],
    ['X-Amz-SignedHeaders', 'host'],
  ];
  const canonicalQuery = query
    .map(([k, v]) => `${encode(k)}=${encode(v)}`)
    .sort()
    .join('&');
  const canonicalPath = input.path.split('/').map(encode).join('/');

  const canonicalRequest = [
    'GET',
    canonicalPath,
    canonicalQuery,
    `host:${input.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${input.secretAccessKey}`, date);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `https://${input.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
