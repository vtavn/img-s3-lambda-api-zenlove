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
    gif: "image/gif",
    mp3: "audio/mpeg",
  };
  return typeMap[format] || (format === "mp3" ? "audio/mpeg" : "image/webp");
};

// Determine if a format is an image that we can process
const isImageFormat = (format) => {
  return ["jpeg", "png", "webp", "avif", "gif"].includes(format);
};

// Best-effort MIME type inference for generic files
const inferMimeFromExt = (filename) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map = {
    // images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
    gif: "image/gif",
    svg: "image/svg+xml",
    // audio
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    oga: "audio/ogg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    flac: "audio/flac",
    // video
    mp4: "video/mp4",
    m4v: "video/x-m4v",
    mov: "video/quicktime",
    webm: "video/webm",
    ogv: "video/ogg",
    mkv: "video/x-matroska",
    // docs
    pdf: "application/pdf",
    txt: "text/plain; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    json: "application/json",
    xml: "application/xml",
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    // web assets
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    mjs: "application/javascript; charset=utf-8",
    // archives
    zip: "application/zip",
    gz: "application/gzip",
    tar: "application/x-tar",
    "7z": "application/x-7z-compressed",
    rar: "application/vnd.rar",
    // fonts
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    // office
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] || "application/octet-stream";
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

    // Determine original format from file extension
    const originalFormat = getImageFormat(proxy);

    // Passthrough for non-image types regardless of query params
    if (!isImageFormat(originalFormat)) {
      const contentType = s3Response.ContentType || inferMimeFromExt(proxy);
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

    // If no transformation parameters, return original image
    if (
      !resizeParam &&
      !cropParam &&
      !formatParam &&
      !event.queryStringParameters?.quality
    ) {
      console.log("No transformation parameters, returning original image");
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

    // Guard and process GIF inputs
    if (
      originalFormat === "gif" &&
      (resizeParam ||
        cropParam ||
        formatParam ||
        event.queryStringParameters?.quality)
    ) {
      if (formatParam && formatParam.toLowerCase() === "gif") {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Output GIF không được hỗ trợ" }),
        };
      }

      // Detect animated GIF and reject if animated when transformation requested
      const gifMeta = await sharp(imageBuffer, { animated: true }).metadata();
      if (gifMeta?.pages && gifMeta.pages > 1) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error:
              "Animated GIF không được hỗ trợ xử lý; chỉ trả về nguyên bản",
          }),
        };
      }
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
      case "gif":
        // Disallow encoding to GIF
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Output GIF không được hỗ trợ" }),
        };
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
    if (
      error?.name === "NoSuchKey" ||
      error?.Code === "NoSuchKey" ||
      error?.code === "NoSuchKey" ||
      error?.$metadata?.httpStatusCode === 404 ||
      (typeof error?.message === "string" &&
        /NoSuchKey|Not ?Found/i.test(error.message))
    ) {
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
      return ext || null; // keep original extension for generic handling
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
