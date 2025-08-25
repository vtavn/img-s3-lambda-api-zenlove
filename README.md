# Image Transformation Service

Hệ thống crop/resize ảnh qua URL với kiến trúc **CloudFront → API Gateway → Lambda → S3**.

## Kiến trúc

```
CloudFront (global) → API Gateway (HTTP API v2, ap-southeast-1) → Lambda (Node.js 20 + sharp layer) → S3 (ap-southeast-1)
```

### Tính năng

- **Crop ảnh**: `?crop=left,top,width,height`
- **Resize ảnh**: `?resize=WxH` (hỗ trợ `600x`, `x400`, `600x400`)
- **Format ảnh**: `?format=webp|jpeg|png|avif`
- **Chất lượng**: `?quality=1..100`
- **Cache**: CloudFront cache theo tham số, TTL 1 năm
- **Bảo mật**: S3 private, chỉ CloudFront truy cập qua OAC

#### Bổ sung định dạng

- **GIF**:
  - Không tham số: trả nguyên bản `image/gif`.
  - Có tham số (`crop|resize|format|quality`):
    - GIF động (animated): trả `400` — không hỗ trợ transform, chỉ passthrough khi không có tham số.
    - GIF tĩnh: cho phép transform; không hỗ trợ output `gif` (hãy dùng `webp/jpeg/png/avif`).
- **MP3**: Passthrough (không transform), trả `audio/mpeg` và cache 1 năm.

## Yêu cầu

- AWS CLI đã cấu hình
- Terraform >= 1.0
- Node.js >= 20
- ACM certificate ở us-east-1 cho domain
- Sharp Lambda Layer ARN

## Cài đặt

### 1. Chuẩn bị Sharp Layer

#### Tùy chọn A: Sử dụng public layer (khuyến nghị)

Tìm Sharp layer ARN cho **ap-southeast-1, nodejs20.x**:

- [Public Sharp Layers](https://github.com/umccr/terraform-aws-lambda-layer-sharp/releases)
- Hoặc tìm trên AWS Lambda Console

#### Tùy chọn B: Tự build layer

```bash
# Tạo Docker container Amazon Linux 2023
docker run -it --rm -v $(pwd):/workspace amazonlinux:2023

# Trong container
yum update -y
yum install -y nodejs npm zip
mkdir -p /tmp/sharp-layer/nodejs
cd /tmp/sharp-layer/nodejs
npm install sharp
cd /tmp/sharp-layer
zip -r sharp-layer.zip nodejs/
```

### 2. Build Lambda function

```bash
# Cài đặt dependencies
cd lambda
npm ci --omit=dev

# Tạo zip file
zip -r ../lambda.zip .
cd ..
```

### 3. Deploy Infrastructure

```bash
# Khởi tạo Terraform
cd infra
terraform init

# Deploy với các biến cần thiết
terraform apply \
  -var="s3_bucket_name=your-unique-bucket-name" \
  -var="acm_certificate_arn=arn:aws:acm:us-east-1:123456789012:certificate/xxx" \
  -var='cdn_aliases=["cdn.yourdomain.com"]' \
  -var='sharp_layer_arns=["arn:aws:lambda:ap-southeast-1:123456789012:layer:sharp-node20:1"]'
```

### 4. Upload ảnh test

```bash
# Upload ảnh mẫu
aws s3 cp ./test-image.jpg s3://your-bucket-name/path/to/image.jpg
```

## Sử dụng

### URL Format

```
https://cdn.yourdomain.com/img/path/to/image.jpg?crop=left,top,width,height&resize=WxH&format=webp&quality=85
```

### Ví dụ

```bash
# Resize ảnh thành 600px width
https://cdn.yourdomain.com/img/photo.jpg?resize=600x&format=webp&quality=90

# Crop và resize
https://cdn.yourdomain.com/img/photo.jpg?crop=100,50,800,600&resize=400x300&format=jpeg&quality=85

# Chỉ đổi format
https://cdn.yourdomain.com/img/photo.jpg?format=avif&quality=95

# GIF tĩnh, resize và đổi sang webp
https://cdn.yourdomain.com/img/static.gif?resize=800x&format=webp&quality=80

# MP3 passthrough
https://cdn.yourdomain.com/img/audio/song.mp3
```

### Tham số

| Tham số   | Mô tả                          | Ví dụ                         |
| --------- | ------------------------------ | ----------------------------- |
| `crop`    | Cắt ảnh: left,top,width,height | `100,50,800,600`              |
| `resize`  | Thay đổi kích thước            | `600x`, `x400`, `600x400`     |
| `format`  | Định dạng ảnh                  | `webp`, `jpeg`, `png`, `avif` |
| `quality` | Chất lượng (1-100)             | `85`                          |

Lưu ý:

- `gif` ở output không được hỗ trợ khi transform. Với ảnh nguồn là GIF, nếu cần output giữ nguyên `gif`, bỏ mọi tham số để passthrough.
- MP3 không hỗ trợ các tham số `crop`, `resize`, `format`, `quality`.

## Cấu hình

### Biến môi trường Lambda

| Biến            | Mô tả               | Mặc định |
| --------------- | ------------------- | -------- |
| `SOURCE_BUCKET` | Tên S3 bucket       | -        |
| `MAX_W`         | Chiều rộng tối đa   | 3000     |
| `MAX_H`         | Chiều cao tối đa    | 3000     |
| `DEFAULT_FMT`   | Format mặc định     | webp     |
| `DEFAULT_QUAL`  | Chất lượng mặc định | 85       |

### Terraform Variables

Xem file `infra/variables.tf` để biết tất cả các biến có thể cấu hình.

## Bảo mật

### S3 Bucket

- Private bucket với PublicAccessBlock
- Chỉ CloudFront truy cập qua Origin Access Control (OAC)
- Bucket policy chỉ cho phép CloudFront distribution

### Lambda

- IAM role với quyền tối thiểu (s3:GetObject)
- Timeout 20s, memory 1024MB
- Validation kích thước ảnh đầu vào

### CloudFront

- HTTPS only
- Cache policy với whitelist query parameters
- Response headers policy với CORS và Cache-Control

## Monitoring & Logging

### CloudWatch Logs

Lambda function log chi tiết:

- Thông tin request
- Kích thước ảnh đầu vào/đầu ra
- Thời gian xử lý
- Lỗi chi tiết

### Metrics

- CloudFront cache hit/miss
- Lambda invocation count/duration
- API Gateway request count

## Troubleshooting

### Lỗi thường gặp

1. **403 Forbidden**: Kiểm tra S3 bucket policy và OAC
2. **404 Not Found**: Ảnh không tồn tại trong S3
3. **400 Bad Request**: Tham số không hợp lệ hoặc kích thước quá lớn
4. **500 Internal Server Error**: Lỗi xử lý ảnh, kiểm tra CloudWatch logs

### Debug

```bash
# Xem CloudWatch logs
aws logs tail /aws/lambda/img-transformer --follow

# Test API trực tiếp
curl "https://your-api-id.execute-api.ap-southeast-1.amazonaws.com/prod/img/test.jpg?resize=100x"
```

## Tối ưu hóa

### Performance

- CloudFront cache 1 năm cho ảnh đã xử lý
- Lambda warm start với reserved concurrency
- Sharp layer tối ưu cho Lambda

### Cost

- CloudFront price class 100 (chỉ US/Canada/Europe)
- Lambda timeout 20s
- S3 Intelligent Tiering cho ảnh gốc

### Security

- Bật Signed URLs nếu cần bảo mật cao
- Rate limiting trên API Gateway
- WAF rules cho CloudFront

## Development

### Local Testing

```bash
# Test Lambda function locally
cd lambda
npm install
node -e "
import('./index.mjs').then(m => {
  m.handler({
    pathParameters: { proxy: 'test.jpg' },
    queryStringParameters: { resize: '100x', format: 'webp' }
  }).then(console.log);
});
"
```

### Cập nhật code

```bash
# Rebuild và deploy
cd lambda && npm ci --omit=dev && zip -r ../lambda.zip .
cd ../infra && terraform apply
```

## License

MIT License
