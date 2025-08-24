import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-1",
});

// Helper functions
const safeInt = (value, defaultValue = null) => {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseResize = (resizeParam) => {
  if (!resizeParam) return { width: null, height: null };

  const match = resizeParam.match(/^(\d+)?x(\d+)?$/);
  if (!match) return { width: null, height: null };

  return {
    width: safeInt(match[1]),
    height: safeInt(match[2]),
  };
};

const parseCrop = (cropParam) => {
  if (!cropParam) return null;

  const parts = cropParam.split(",").map((part) => safeInt(part.trim()));
  if (parts.length !== 4 || parts.some((p) => p === null || p < 0)) {
    return null;
  }

  return {
    left: parts[0],
    top: parts[1],
    width: parts[2],
    height: parts[3],
  };
};

const pickFormat = (formatParam) => {
  const formatMap = {
    jpeg: "jpeg",
    jpg: "jpeg",
    png: "png",
    webp: "webp",
    avif: "avif",
  };

  const format = formatParam?.toLowerCase();
  return formatMap[format] || process.env.DEFAULT_FMT || "webp";
};

const validateLimits = (width, height) => {
  const maxW = parseInt(process.env.MAX_W, 10) || 3000;
  const maxH = parseInt(process.env.MAX_H, 10) || 3000;

  if (width && width > maxW) return false;
  if (height && height > maxH) return false;
  return true;
};

const getContentType = (format) => {
  const typeMap = {
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
  };
  return typeMap[format] || "image/webp";
};

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    // Parse path parameters
    const pathParams = event.pathParameters || {};
    const proxy = pathParams.proxy;

    if (!proxy) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing image path" }),
      };
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const resizeParam = queryParams.resize;
    const cropParam = queryParams.crop;
    const formatParam = queryParams.format;
    const qualityParam = safeInt(
      queryParams.quality,
      parseInt(process.env.DEFAULT_QUAL, 10) || 85
    );

    console.log("Processing image:", {
      key: proxy,
      resize: resizeParam,
      crop: cropParam,
      format: formatParam,
      quality: qualityParam,
    });

    // Parse and validate parameters
    const resize = parseResize(resizeParam);
    const crop = parseCrop(cropParam);
    const format = pickFormat(formatParam);

    // Validate size limits
    if (!validateLimits(resize.width, resize.height)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Image dimensions exceed maximum allowed size",
          maxWidth: process.env.MAX_W,
          maxHeight: process.env.MAX_H,
        }),
      };
    }

    // Get image from S3
    const bucket = process.env.SOURCE_BUCKET;
    console.log(`Fetching image from S3: s3://${bucket}/${proxy}`);

    const getObjectCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: proxy,
    });

    const s3Response = await s3Client.send(getObjectCommand);
    const imageBuffer = await streamToBuffer(s3Response.Body);

    console.log(`Original image size: ${imageBuffer.length} bytes`);

    // If no transformation parameters, return original image
    if (
      !resizeParam &&
      !cropParam &&
      !formatParam &&
      !event.queryStringParameters?.quality
    ) {
      console.log("No transformation parameters, returning original image");
      const originalFormat = getImageFormat(proxy);
      const contentType = getContentType(originalFormat);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": imageBuffer.length.toString(),
        },
        body: imageBuffer.toString("base64"),
        isBase64Encoded: true,
      };
    }

    // Process image with Sharp
    let sharpInstance = sharp(imageBuffer);

    // Apply crop if specified
    if (crop) {
      console.log("Applying crop:", crop);
      sharpInstance = sharpInstance.extract(crop);
    }

    // Apply resize if specified
    if (resize.width || resize.height) {
      console.log("Applying resize:", resize);
      sharpInstance = sharpInstance.resize(resize.width, resize.height, {
        fit: "cover",
        withoutEnlargement: true,
      });
    }

    // Get image metadata
    const metadata = await sharpInstance.metadata();
    console.log("Image metadata:", {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    });

    // Encode image
    let processedBuffer;
    const encodeOptions = { quality: qualityParam };

    switch (format) {
      case "jpeg":
        processedBuffer = await sharpInstance.jpeg(encodeOptions).toBuffer();
        break;
      case "png":
        processedBuffer = await sharpInstance.png().toBuffer();
        break;
      case "webp":
        processedBuffer = await sharpInstance.webp(encodeOptions).toBuffer();
        break;
      case "avif":
        processedBuffer = await sharpInstance.avif(encodeOptions).toBuffer();
        break;
      default:
        processedBuffer = await sharpInstance.webp(encodeOptions).toBuffer();
    }

    console.log(`Processed image size: ${processedBuffer.length} bytes`);

    // Return response
    const contentType = getContentType(format);
    const base64Image = processedBuffer.toString("base64");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": processedBuffer.length.toString(),
      },
      body: base64Image,
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("Error processing image:", error);

    // Handle specific S3 errors
    if (error.name === "NoSuchKey") {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Image not found" }),
      };
    }

    // Handle Sharp errors
    if (
      error.message &&
      error.message.includes("Input buffer contains unsupported image format")
    ) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unsupported image format" }),
      };
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

// Helper function to get image format from filename
const getImageFormat = (filename) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "jpeg";
    case "png":
      return "png";
    case "webp":
      return "webp";
    case "avif":
      return "avif";
    case "gif":
      return "gif";
    default:
      return "jpeg"; // default fallback
  }
};

// Helper function to convert stream to buffer
const streamToBuffer = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
};
