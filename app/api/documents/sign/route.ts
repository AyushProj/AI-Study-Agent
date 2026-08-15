import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/auth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Returns a signed set of upload params the browser can use to upload
 * directly to Cloudinary. This route's own request/response is tiny (no
 * file bytes involved), so it never hits Vercel's serverless payload cap —
 * only the direct browser->Cloudinary request carries the actual file.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const originalFileName = typeof body.fileName === "string" ? body.fileName : "file";

  const safeName = originalFileName
    .replace(/\.[^/.]+$/, "") // strip extension
    .replace(/[^a-zA-Z0-9_-]/g, "_") // Cloudinary public_ids dislike spaces/special chars
    .slice(0, 80);
  const publicId = `${Date.now()}-${safeName}`;
  const folder = `ai-study-agent/${session.user.id}`;
  const timestamp = Math.round(Date.now() / 1000);

  // Only parameters listed here are part of the signature — any other
  // field sent in the actual upload (like resource_type or the file
  // itself) does not need to be signed.
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, public_id: publicId },
    process.env.CLOUDINARY_API_SECRET as string
  );

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    publicId,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
}