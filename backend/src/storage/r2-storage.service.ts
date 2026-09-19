import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const maximumBytes = 10 * 1024 * 1024;
const creativeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']);

@Injectable()
export class R2StorageService {
  private readonly bucket = process.env.R2_BUCKET_NAME;
  private readonly client = this.createClient();

  private createClient() {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
    return new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      // R2's S3 endpoint addresses buckets as /<bucket>/<key>. Without this,
      // the AWS SDK can generate <bucket>.<account>.r2... URLs that do not
      // resolve and surface in the browser as a 403/CORS-style upload failure.
      forcePathStyle: true,
      // Recent AWS SDK releases add an empty-body CRC32 checksum to presigned
      // PutObject requests by default. The browser subsequently sends the real
      // file body, which R2 rejects because it does not match that checksum.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
  }

  private configured() {
    if (!this.client || !this.bucket) throw new ServiceUnavailableException('Document storage is not configured');
    return { client: this.client, bucket: this.bucket };
  }

  validateFile(contentType: string, sizeBytes: number) {
    if (!allowedTypes.has(contentType)) throw new BadRequestException('Only PDF, JPEG, PNG, and WebP files are accepted');
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > maximumBytes) {
      throw new BadRequestException('Files must be no larger than 10 MB');
    }
  }

  async createUpload(userId: string, input: { filename: string; contentType: string; sizeBytes: number }) {
    this.validateFile(input.contentType, input.sizeBytes);
    const { client, bucket } = this.configured();
    const extension = input.filename.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    const key = `verification/${userId}/${randomUUID()}.${extension}`;
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: bucket, Key: key, ContentType: input.contentType,
    }), { expiresIn: 300 });
    return { key, uploadUrl, expiresIn: 300, headers: { 'Content-Type': input.contentType } };
  }

  async createCampaignUpload(userId: string, campaignId: string, input: { filename: string; contentType: string; sizeBytes: number }) {
    if (!creativeTypes.has(input.contentType)) throw new BadRequestException('Campaign creatives must be JPEG, PNG, WebP, or MP4');
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > 25 * 1024 * 1024) throw new BadRequestException('Campaign creatives must be no larger than 25 MB');
    const { client, bucket } = this.configured();
    const extension = input.filename.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    const key = `campaigns/${userId}/${campaignId}/${randomUUID()}.${extension}`;
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType }), { expiresIn: 300 });
    return { key, uploadUrl, expiresIn: 300, headers: { 'Content-Type': input.contentType } };
  }

  async assertCampaignUpload(userId: string, campaignId: string, key: string, contentType: string, sizeBytes: number) {
    if (!key.startsWith(`campaigns/${userId}/${campaignId}/`)) throw new BadRequestException('Invalid campaign creative key');
    if (!creativeTypes.has(contentType) || sizeBytes > 25 * 1024 * 1024) throw new BadRequestException('Invalid campaign creative');
    const { client, bucket } = this.configured();
    const object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (object.ContentType !== contentType || object.ContentLength !== sizeBytes) throw new BadRequestException('Uploaded creative does not match its declaration');
  }

  async assertUploaded(userId: string, key: string, contentType: string, sizeBytes: number) {
    this.validateFile(contentType, sizeBytes);
    if (!key.startsWith(`verification/${userId}/`)) throw new BadRequestException('Invalid document key');
    const { client, bucket } = this.configured();
    const object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (object.ContentType !== contentType || object.ContentLength !== sizeBytes) {
      throw new BadRequestException('Uploaded file does not match its declaration');
    }
  }

  async createReadUrl(key: string) {
    const { client, bucket } = this.configured();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
  }
}
