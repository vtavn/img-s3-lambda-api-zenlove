# 🚀 Quick Start Guide

## Tóm tắt dự án

Hệ thống crop/resize ảnh qua URL với kiến trúc:

```
CloudFront → API Gateway → Lambda → S3
```

## 📁 Cấu trúc dự án

```
lambda_docker/
├── infra/           # Terraform infrastructure
├── lambda/          # Lambda function code
├── build.sh         # Script deploy tự động
├── test-lambda.sh   # Script test
└── README.md        # Hướng dẫn chi tiết
```

## ⚡ Deploy nhanh

### 1. Chuẩn bị

```bash
# Cài đặt dependencies
brew install terraform awscli node

# Cấu hình AWS credentials
aws configure
```

### 2. Deploy với quyền admin

```bash
# Set environment variables
export S3_BUCKET_NAME="zenlove-origin"
export ACM_CERTIFICATE_ARN="arn:aws:acm:us-east-1:200776227748:certificate/52d96225-9203-4402-b864-68481632e0ab"
export CDN_ALIASES='["cdn.zenlove.me"]'
export SHARP_LAYER_ARNS='["arn:aws:lambda:ap-southeast-1:200776227748:layer:sharp-node20:1"]'

# Deploy
./build.sh
```

### 3. Test

```bash
# Upload ảnh test
curl -o test.jpg https://picsum.photos/800/600
aws s3 cp test.jpg s3://zenlove-origin/test/test.jpg

# Test API
curl "https://cdn.zenlove.me/img/test/test.jpg?resize=400x&format=webp&quality=90"
```

## 🔧 Nếu không có quyền admin

### Cách 1: Yêu cầu quyền từ admin

- Admin cần cấp thêm quyền IAM, Lambda, API Gateway, CloudFront
- Xem chi tiết trong `DEPLOYMENT_GUIDE.md`

### Cách 2: Sử dụng public Sharp layer

- Tìm Sharp layer ARN có sẵn trong region ap-southeast-1
- Thay thế ARN trong lệnh deploy

### Cách 3: Deploy từng phần

- Tạo Sharp layer trước (cần quyền admin)
- Sau đó deploy infrastructure

## 📊 Tính năng

- ✅ **Crop ảnh**: `?crop=left,top,width,height`
- ✅ **Resize ảnh**: `?resize=WxH` (600x, x400, 600x400)
- ✅ **Format ảnh**: `?format=webp|jpeg|png|avif`
- ✅ **Chất lượng**: `?quality=1..100`
- ✅ **Cache**: CloudFront cache 1 năm
- ✅ **Bảo mật**: S3 private, chỉ CloudFront truy cập

## 🧪 Test cases

```bash
# Resize ảnh
https://cdn.zenlove.me/img/photo.jpg?resize=600x&format=webp&quality=90

# Crop và resize
https://cdn.zenlove.me/img/photo.jpg?crop=100,50,800,600&resize=400x300&format=jpeg&quality=85

# Chỉ đổi format
https://cdn.zenlove.me/img/photo.jpg?format=avif&quality=95
```

## 📈 Monitoring

```bash
# Xem logs
aws logs tail /aws/lambda/img-transformer --follow

# Kiểm tra metrics
aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations
```

## 🆘 Troubleshooting

### Lỗi 403 Access Denied

- Kiểm tra quyền IAM
- Xem `DEPLOYMENT_GUIDE.md`

### Lỗi Sharp Layer

- Verify Sharp layer ARN
- Tạo layer mới nếu cần

### Lỗi S3 bucket

- Bucket đã tồn tại → OK
- Bucket không tồn tại → Tạo mới

## 📚 Tài liệu chi tiết

- `README.md` - Hướng dẫn đầy đủ
- `DEPLOYMENT_GUIDE.md` - Hướng dẫn deploy với quyền
- `infra/` - Terraform infrastructure
- `lambda/` - Lambda function code
