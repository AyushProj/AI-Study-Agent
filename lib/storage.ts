import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  storageKey: string; // public_id, used to delete later
  storageUrl: string; // secure_url, used to fetch the file
}

/**
 * Uploads a file buffer to Cloudinary under a per-user folder, so files
 * are namespaced by userId and never collide across users.
 */
export async function uploadFile(
  buffer: Buffer,
  userId: string,
  originalFileName: string
): Promise<UploadResult> {
  const safeName = originalFileName.replace(/\.[^/.]+$/, ""); // strip extension for public_id

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw", // required for non-image/video files like PDF/DOCX/TXT
        folder: `ai-study-agent/${userId}`,
        public_id: `${Date.now()}-${safeName}`,
        use_filename: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Upload failed"));
          return;
        }
        resolve({
          storageKey: result.public_id,
          storageUrl: result.secure_url,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

export async function deleteFile(storageKey: string): Promise<void> {
  await cloudinary.uploader.destroy(storageKey, { resource_type: "raw" });
}