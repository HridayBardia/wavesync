import { env } from "../utils/env";
import { logger } from "../utils/logger";
import { r2Client, getSignedUrlForR2 } from "../storage/r2";
import { MAX_UPLOAD_SIZE_BYTES } from "@wavesync/shared";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export class UploadProvider {
  static allowedMimeTypes = [
    "audio/mpeg",       // .mp3
    "audio/mp3",        // .mp3
    "audio/wav",        // .wav
    "audio/wave",       // .wav
    "audio/x-wav",      // .wav
    "audio/flac",       // .flac
    "audio/ogg",        // .ogg
    "video/ogg",        // .ogg
    "audio/mp4",        // .m4a
    "audio/x-m4a",      // .m4a
    "audio/aac",        // .aac
    "audio/x-aac"       // .aac
  ];

  static allowedExtensions = [
    "mp3", "wav", "flac", "ogg", "m4a", "aac"
  ];

  static validateFile(name: string, size: number, mimeType: string): { valid: boolean; error?: string } {
    if (size > MAX_UPLOAD_SIZE_BYTES) {
      return { valid: false, error: "File exceeds maximum size of 200MB" };
    }

    const extension = name.split(".").pop()?.toLowerCase();
    const isValidExtension = extension && this.allowedExtensions.includes(extension);
    const isValidMime = this.allowedMimeTypes.includes(mimeType) || mimeType.startsWith("audio/");

    if (!isValidExtension && !isValidMime) {
      return { valid: false, error: "Invalid audio format. Allowed formats: MP3, WAV, FLAC, OGG, M4A, AAC" };
    }

    return { valid: true };
  }

  static async uploadFile(file: File): Promise<string> {
    const validation = this.validateFile(file.name, file.size, file.type);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "mp3";
    const fileKey = `${crypto.randomUUID()}.${fileExtension}`;

    // Check if Cloudflare R2 is configured
    if (
      env.CLOUDFLARE_ACCOUNT_ID &&
      env.CLOUDFLARE_R2_BUCKET &&
      env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    ) {
      try {
        logger.info({ fileKey }, "Uploading file to Cloudflare R2");
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        await r2Client.putObject(fileKey, buffer, file.type);
        
        // Return signed URL
        const signedUrl = await getSignedUrlForR2(fileKey);
        return signedUrl;
      } catch (err) {
        logger.error({ err }, "Cloudflare R2 upload failed, falling back to local storage");
      }
    }

    // Fallback: local file storage
    logger.info({ fileKey }, "Saving file locally");
    const uploadDir = join(process.cwd(), "uploads");
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = join(uploadDir, fileKey);
    const arrayBuffer = await file.arrayBuffer();
    await Bun.write(filePath, arrayBuffer);

    // Return url pointing to our local server
    return `${env.PUBLIC_SERVER_URL}/uploads/${fileKey}`;
  }
}
