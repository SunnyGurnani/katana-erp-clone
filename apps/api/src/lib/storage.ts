import { Client } from 'minio';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

const BUCKET = process.env.MINIO_BUCKET || 'forgeerp';

export async function initStorage() {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    // Set public read policy for the bucket's public/ prefix
    const policy = {
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/public/*`],
      }],
    };
    await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));
  }
  console.log(`✓ MinIO storage ready (bucket: ${BUCKET})`);
}

export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await minioClient.putObject(BUCKET, path, buffer, buffer.length, {
    'Content-Type': contentType,
  });
  return path;
}

export async function getFileUrl(path: string): Promise<string> {
  // For public files, return direct URL
  if (path.startsWith('public/')) {
    const endpoint = process.env.MINIO_PUBLIC_URL ||
      `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`;
    return `${endpoint}/${BUCKET}/${path}`;
  }
  // For private files, generate presigned URL (7 day expiry)
  return await minioClient.presignedGetObject(BUCKET, path, 7 * 24 * 60 * 60);
}

export async function deleteFile(path: string): Promise<void> {
  await minioClient.removeObject(BUCKET, path);
}

export async function listFiles(prefix: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const files: string[] = [];
    const stream = minioClient.listObjects(BUCKET, prefix, true);
    stream.on('data', (obj) => { if (obj.name) files.push(obj.name); });
    stream.on('end', () => resolve(files));
    stream.on('error', reject);
  });
}

export { minioClient, BUCKET };
