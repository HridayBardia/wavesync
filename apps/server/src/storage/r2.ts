import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../utils/env";
import { SIGNED_URL_EXPIRY_SECONDS } from "@wavesync/shared";

let s3Client: any = null;

if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_R2_ACCESS_KEY_ID && env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });
}

export const r2Client = {
  async putObject(key: string, body: Buffer, contentType: string) {
    if (!s3Client) throw new Error("R2 Client not configured");
    const command = new PutObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    return s3Client.send(command);
  },

  async getSignedUrl(key: string): Promise<string> {
    if (!s3Client) throw new Error("R2 Client not configured");
    const command = new GetObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET,
      Key: key,
    });
    return getSignedUrl(s3Client, command, { expiresIn: SIGNED_URL_EXPIRY_SECONDS });
  }
};

export async function getSignedUrlForR2(key: string): Promise<string> {
  return r2Client.getSignedUrl(key);
}
