# 🚀 **Next.js Integration Guide - Image Transformation Service**

## 🎯 **Tổng quan**

Hướng dẫn tích hợp Image Transformation Service vào Next.js project để sử dụng tính năng crop, resize, format, và chất lượng ảnh.

**Base URL**: `https://cdn.zenlove.me`

---

## 📦 **Installation**

### 1. **Cài đặt dependencies**

```bash
npm install sharp
# hoặc
yarn add sharp
```

### 2. **Environment Variables**

Tạo file `.env.local`:

```env
NEXT_PUBLIC_IMAGE_SERVICE_URL=https://cdn.zenlove.me
NEXT_PUBLIC_IMAGE_SERVICE_BUCKET=zenlove-origin
```

---

## 🛠️ **Utility Functions**

### **1. Image Service Helper**

Tạo file `utils/imageService.ts`:

```typescript
interface ImageTransformOptions {
  resize?: string; // "400x300", "800x", "x600"
  crop?: string; // "0,0,100,100"
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  quality?: number; // 1-100
}

interface ImageServiceConfig {
  baseUrl: string;
  defaultFormat?: 'webp' | 'jpeg' | 'png' | 'avif';
  defaultQuality?: number;
}

class ImageService {
  private config: ImageServiceConfig;

  constructor(config: ImageServiceConfig) {
    this.config = {
      defaultFormat: 'webp',
      defaultQuality: 85,
      ...config
    };
  }

  /**
   * Tạo URL cho ảnh đã transform
   */
  transform(imagePath: string, options: ImageTransformOptions = {}): string {
    const url = new URL(imagePath, this.config.baseUrl);
    
    // Add query parameters
    if (options.resize) {
      url.searchParams.set('resize', options.resize);
    }
    
    if (options.crop) {
      url.searchParams.set('crop', options.crop);
    }
    
    if (options.format) {
      url.searchParams.set('format', options.format);
    } else if (this.config.defaultFormat) {
      url.searchParams.set('format', this.config.defaultFormat);
    }
    
    if (options.quality) {
      url.searchParams.set('quality', options.quality.toString());
    } else if (this.config.defaultQuality) {
      url.searchParams.set('quality', this.config.defaultQuality.toString());
    }
    
    return url.toString();
  }

  /**
   * Tạo URL cho ảnh gốc (không transform)
   */
  original(imagePath: string): string {
    return new URL(imagePath, this.config.baseUrl).toString();
  }

  /**
   * Tạo responsive image URLs
   */
  responsive(imagePath: string, sizes: number[], options: Omit<ImageTransformOptions, 'resize'> = {}): string[] {
    return sizes.map(size => 
      this.transform(imagePath, { ...options, resize: `${size}x` })
    );
  }

  /**
   * Tạo srcset cho responsive images
   */
  srcset(imagePath: string, sizes: { width: number; media?: string }[], options: Omit<ImageTransformOptions, 'resize'> = {}): string {
    return sizes
      .map(({ width, media }) => {
        const url = this.transform(imagePath, { ...options, resize: `${width}x` });
        return media ? `${url} ${media}` : `${url} ${width}w`;
      })
      .join(', ');
  }
}

// Export singleton instance
export const imageService = new ImageService({
  baseUrl: process.env.NEXT_PUBLIC_IMAGE_SERVICE_URL || 'https://cdn.zenlove.me',
  defaultFormat: 'webp',
  defaultQuality: 85
});

export default imageService;
```

---

## 🖼️ **React Components**

### **1. Optimized Image Component**

Tạo file `components/OptimizedImage.tsx`:

```typescript
import React from 'react';
import Image from 'next/image';
import { imageService, ImageTransformOptions } from '@/utils/imageService';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  transform?: ImageTransformOptions;
  responsive?: boolean;
  sizes?: string;
  className?: string;
  priority?: boolean;
  fill?: boolean;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  transform = {},
  responsive = false,
  sizes = '100vw',
  className,
  priority = false,
  fill = false,
  ...props
}) => {
  const imageUrl = imageService.transform(src, transform);
  
  return (
    <Image
      src={imageUrl}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      priority={priority}
      fill={fill}
      {...props}
    />
  );
};

export default OptimizedImage;
```

### **2. Responsive Image Component**

Tạo file `components/ResponsiveImage.tsx`:

```typescript
import React from 'react';
import { imageService, ImageTransformOptions } from '@/utils/imageService';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  sizes: { width: number; media?: string }[];
  transform?: Omit<ImageTransformOptions, 'resize'>;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  sizes,
  transform = {},
  className,
  loading = 'lazy'
}) => {
  const srcset = imageService.srcset(src, sizes, transform);
  const defaultSrc = imageService.transform(src, { ...transform, resize: `${sizes[0].width}x` });
  
  return (
    <img
      src={defaultSrc}
      srcSet={srcset}
      alt={alt}
      className={className}
      loading={loading}
    />
  );
};

export default ResponsiveImage;
```

---

## 📱 **Usage Examples**

### **1. Basic Usage**

```tsx
import { OptimizedImage } from '@/components/OptimizedImage';

export default function ProductCard({ product }) {
  return (
    <div className="product-card">
      <OptimizedImage
        src={`/products/${product.image}`}
        alt={product.name}
        width={300}
        height={200}
        transform={{
          resize: '300x200',
          format: 'webp',
          quality: 85
        }}
      />
    </div>
  );
}
```

### **2. Responsive Images**

```tsx
import { ResponsiveImage } from '@/components/ResponsiveImage';

export default function HeroImage() {
  return (
    <ResponsiveImage
      src="/hero-banner.jpg"
      alt="Hero Banner"
      sizes={[
        { width: 320, media: '(max-width: 640px)' },
        { width: 768, media: '(max-width: 1024px)' },
        { width: 1200 }
      ]}
      transform={{
        format: 'webp',
        quality: 90
      }}
      className="w-full h-auto"
    />
  );
}
```

### **3. Crop Images**

```tsx
import { OptimizedImage } from '@/components/OptimizedImage';

export default function Avatar({ user }) {
  return (
    <OptimizedImage
      src={`/avatars/${user.avatar}`}
      alt={user.name}
      width={100}
      height={100}
      transform={{
        resize: '100x100',
        crop: '0,0,200,200', // Crop từ 200x200 thành 100x100
        format: 'webp',
        quality: 95
      }}
      className="rounded-full"
    />
  );
}
```

### **4. Dynamic Transformations**

```tsx
import { useState } from 'react';
import { imageService } from '@/utils/imageService';

export default function ImageEditor({ imagePath }) {
  const [transform, setTransform] = useState({
    resize: '800x600',
    format: 'webp',
    quality: 85
  });

  const handleResize = (width: number, height?: number) => {
    setTransform(prev => ({
      ...prev,
      resize: height ? `${width}x${height}` : `${width}x`
    }));
  };

  const handleQuality = (quality: number) => {
    setTransform(prev => ({ ...prev, quality }));
  };

  const imageUrl = imageService.transform(imagePath, transform);

  return (
    <div className="image-editor">
      <img src={imageUrl} alt="Preview" className="preview" />
      
      <div className="controls">
        <button onClick={() => handleResize(400, 300)}>400x300</button>
        <button onClick={() => handleResize(800)}>800px width</button>
        <button onClick={() => handleQuality(95)}>High Quality</button>
        <button onClick={() => handleQuality(60)}>Low Quality</button>
      </div>
    </div>
  );
}
```

---

## 🎨 **Advanced Usage**

### **1. Image Gallery với Lazy Loading**

```tsx
import { useState, useEffect } from 'react';
import { OptimizedImage } from '@/components/OptimizedImage';

export default function ImageGallery({ images }) {
  const [visibleImages, setVisibleImages] = useState(6);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.slice(0, visibleImages).map((image, index) => (
        <OptimizedImage
          key={image.id}
          src={image.path}
          alt={image.alt}
          width={300}
          height={200}
          transform={{
            resize: '300x200',
            format: 'webp',
            quality: 80
          }}
          className="rounded-lg shadow-md"
          loading={index < 4 ? 'eager' : 'lazy'}
        />
      ))}
    </div>
  );
}
```

### **2. Progressive Image Loading**

```tsx
import { useState } from 'react';
import { imageService } from '@/utils/imageService';

export default function ProgressiveImage({ src, alt, width, height }) {
  const [isLoaded, setIsLoaded] = useState(false);
  
  const lowQualityUrl = imageService.transform(src, {
    resize: `${width}x${height}`,
    quality: 10,
    format: 'webp'
  });
  
  const highQualityUrl = imageService.transform(src, {
    resize: `${width}x${height}`,
    quality: 85,
    format: 'webp'
  });

  return (
    <div className="relative">
      <img
        src={lowQualityUrl}
        alt={alt}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-0' : 'opacity-100'}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      <img
        src={highQualityUrl}
        alt={alt}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
}
```

---

## 🔧 **Configuration**

### **1. Next.js Config**

Cập nhật `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['cdn.zenlove.me'],
    formats: ['image/webp', 'image/avif'],
  },
  // ... other config
};

module.exports = nextConfig;
```

### **2. TypeScript Types**

Tạo file `types/image.ts`:

```typescript
export interface ImageTransformOptions {
  resize?: string;
  crop?: string;
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  quality?: number;
}

export interface ResponsiveSize {
  width: number;
  media?: string;
}

export interface ImageServiceConfig {
  baseUrl: string;
  defaultFormat?: 'webp' | 'jpeg' | 'png' | 'avif';
  defaultQuality?: number;
}
```

---

## 🚀 **Performance Tips**

### **1. Caching Strategy**

```typescript
// Cache transformed images
const imageCache = new Map();

export function getCachedImageUrl(path: string, options: ImageTransformOptions): string {
  const key = `${path}-${JSON.stringify(options)}`;
  
  if (imageCache.has(key)) {
    return imageCache.get(key);
  }
  
  const url = imageService.transform(path, options);
  imageCache.set(key, url);
  
  return url;
}
```

### **2. Preload Critical Images**

```tsx
import Head from 'next/head';

export default function HomePage() {
  return (
    <>
      <Head>
        <link
          rel="preload"
          href={imageService.transform('/hero.jpg', { resize: '1200x', format: 'webp' })}
          as="image"
        />
      </Head>
      {/* Your content */}
    </>
  );
}
```

---

## 📊 **Monitoring & Analytics**

### **1. Image Load Tracking**

```typescript
export function trackImageLoad(imageUrl: string, loadTime: number) {
  // Send to analytics service
  analytics.track('image_loaded', {
    url: imageUrl,
    loadTime,
    timestamp: Date.now()
  });
}
```

### **2. Error Handling**

```tsx
export function ImageWithFallback({ src, fallback, ...props }) {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return <img src={fallback} {...props} />;
  }
  
  return (
    <img
      src={src}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}
```

---

## 🎯 **Best Practices**

1. **✅ Sử dụng WebP format** cho modern browsers
2. **✅ Implement lazy loading** cho images không critical
3. **✅ Preload critical images** (hero, above-the-fold)
4. **✅ Sử dụng responsive images** với srcset
5. **✅ Cache transformed URLs** để tránh recalculate
6. **✅ Monitor performance** và error rates
7. **✅ Implement fallbacks** cho unsupported formats

---

## 🔗 **Useful Links**

- **Repository**: https://github.com/vtavn/img-s3-lambda-api-zenlove
- **Live Demo**: https://cdn.zenlove.me
- **Cost Calculator**: `node cost-calculator.js`
- **Documentation**: `FINAL_RESULTS.md`
