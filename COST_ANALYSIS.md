# 💰 **AWS Cost Analysis - Image Transformation Service**

## 🎯 **Tổng quan chi phí**

Hệ thống Image Transformation Service của bạn sử dụng:
- **CloudFront** (CDN)
- **API Gateway** (HTTP API v2)
- **Lambda** (Node.js 20 + Sharp)
- **S3** (Storage)

---

## 📊 **Chi phí theo quy mô sử dụng**

### 🟢 **Small Scale** (50K requests/tháng)
- **Storage**: 5 GB
- **Requests**: 50,000
- **Data Transfer**: 25 GB
- **📈 Monthly Cost**: **$4.86**
- **📅 Daily Cost**: **$0.16**

### 🟡 **Medium Scale** (200K requests/tháng)
- **Storage**: 20 GB
- **Requests**: 200,000
- **Data Transfer**: 100 GB
- **📈 Monthly Cost**: **$20.11**
- **📅 Daily Cost**: **$0.67**

### 🟠 **Large Scale** (1M requests/tháng)
- **Storage**: 100 GB
- **Requests**: 1,000,000
- **Data Transfer**: 500 GB
- **📈 Monthly Cost**: **$105.53**
- **📅 Daily Cost**: **$3.52**

### 🔴 **Enterprise Scale** (5M requests/tháng)
- **Storage**: 500 GB
- **Requests**: 5,000,000
- **Data Transfer**: 2,500 GB
- **📈 Monthly Cost**: **$544.33**
- **📅 Daily Cost**: **$18.14**

---

## 🔍 **Chi tiết chi phí theo component**

### 📦 **S3 Storage**
- **Storage**: $0.023/GB/tháng
- **GET Requests**: $0.0004/1,000 requests
- **PUT Requests**: $0.005/1,000 requests

### 🌐 **CloudFront (CDN)**
- **Data Transfer**: $0.085/GB
- **Requests**: $0.0075/10,000 requests
- **Custom Domain**: Miễn phí

### ⚡ **Lambda Function**
- **Requests**: $0.20/1M requests
- **Duration**: $0.0000166667/GB-second
- **Memory**: 1024MB

### 🚪 **API Gateway (HTTP API v2)**
- **Requests**: $1.00/1M requests
- **Data Transfer**: $0.09/GB

---

## 💡 **Tối ưu hóa chi phí**

### 🎯 **Chi phí cao nhất:**
1. **API Gateway Data Transfer** (42-45% tổng chi phí)
2. **CloudFront Data Transfer** (40-42% tổng chi phí)
3. **Lambda Duration** (12-15% tổng chi phí)

### 🔧 **Cách giảm chi phí:**

#### 1. **Tối ưu CloudFront Cache**
- Tăng TTL để giảm requests đến origin
- Sử dụng cache policies hiệu quả
- **Tiết kiệm**: 30-50% chi phí CloudFront

#### 2. **Tối ưu Lambda**
- Giảm memory allocation nếu có thể
- Tối ưu code để giảm execution time
- **Tiết kiệm**: 10-20% chi phí Lambda

#### 3. **Tối ưu API Gateway**
- Sử dụng HTTP API v2 (rẻ hơn REST API)
- Implement caching strategies
- **Tiết kiệm**: 20-30% chi phí API Gateway

#### 4. **Tối ưu S3**
- Sử dụng S3 Intelligent Tiering
- Compress images trước khi upload
- **Tiết kiệm**: 10-15% chi phí S3

---

## 📈 **So sánh với giải pháp khác**

### 🆚 **vs Traditional Server**
- **Traditional**: $200-500/tháng (server + bandwidth)
- **Serverless**: $4-105/tháng (tùy scale)
- **Tiết kiệm**: 80-95%

### 🆚 **vs Managed Image Service**
- **Cloudinary**: $89-224/tháng
- **Imgix**: $75-200/tháng
- **AWS Solution**: $4-105/tháng
- **Tiết kiệm**: 50-90%

---

## 🎯 **Kết luận**

### ✅ **Ưu điểm về chi phí:**
- **Rất rẻ** cho scale nhỏ và vừa
- **Auto-scaling** - chỉ trả tiền khi sử dụng
- **Không có chi phí cố định**
- **Tối ưu cho traffic thấp**

### ⚠️ **Lưu ý:**
- **Chi phí tăng nhanh** với scale lớn
- **Data transfer** là cost driver chính
- **Cần monitoring** để tránh surprise bills

### 🚀 **Khuyến nghị:**
- **Startup/Small**: Hoàn hảo ($4-20/tháng)
- **Medium**: Tốt ($20-100/tháng)
- **Large**: Cần tối ưu ($100+/tháng)

---

## 📊 **Cost Calculator**

Chạy script để tính toán chi phí cho use case cụ thể:

```bash
node cost-calculator.js
```

Hoặc chỉnh sửa giá trị trong `cost-calculator.js` để tính toán cho scenario của bạn.
