import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// attendance/<production|dev>/<employeeCode>/<yyyy-mm-dd>-<in|out>-<timestamp>
// APP_ENV wins; otherwise Vercel's production deployment counts as production, everything else as dev.
const envName =
  process.env.APP_ENV || (process.env.VERCEL_ENV === "production" ? "production" : "dev");

export function uploadPhoto(buffer, employeeCode, kind) {
  const code = String(employeeCode).replace(/[^\w.-]/g, "_");
  const day = new Date().toISOString().slice(0, 10);
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: `attendance/${envName}/${code}`,
          public_id: `${day}-${kind}-${Date.now()}`,
          resource_type: "image",
        },
        (err, result) => (err ? reject(err) : resolve(result.secure_url)),
      )
      .end(buffer);
  });
}
