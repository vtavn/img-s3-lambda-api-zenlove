# Hướng dẫn Deploy Image Transformation Service

## Yêu cầu quyền AWS

User `zenlove-storage` cần có các quyền sau để deploy thành công:

### 1. IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PutRolePolicy",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. Lambda Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:AddPermission",
        "lambda:PublishLayerVersion",
        "lambda:GetLayerVersion"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3. API Gateway Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["apigateway:*"],
      "Resource": "*"
    }
  ]
}
```

### 4. CloudFront Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["cloudfront:*"],
      "Resource": "*"
    }
  ]
}
```

### 5. S3 Permissions (đã có)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::zenlove-origin",
        "arn:aws:s3:::zenlove-origin/*"
      ]
    }
  ]
}
```

## Cách 1: Sử dụng Admin User (Khuyến nghị)

1. Tạo một IAM user mới với quyền AdministratorAccess
2. Cấu hình AWS credentials cho user mới
3. Chạy script deploy

```bash
# Tạo user mới
aws iam create-user --user-name img-transformer-admin

# Tạo access key
aws iam create-access-key --user-name img-transformer-admin

# Attach policy
aws iam attach-user-policy --user-name img-transformer-admin --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Cấu hình credentials
aws configure
# Nhập Access Key ID và Secret Access Key của user mới
```

## Cách 2: Sử dụng Public Sharp Layer

Nếu không thể tạo Sharp layer, sử dụng public layer:

### Tìm Public Sharp Layer ARN

1. Truy cập [AWS Lambda Console](https://console.aws.amazon.com/lambda/home)
2. Chọn region `ap-southeast-1`
3. Vào mục "Layers"
4. Tìm layer có tên chứa "sharp" hoặc "image"
5. Copy ARN của layer

Hoặc sử dụng một trong các ARN sau (cần verify):

```
arn:aws:lambda:ap-southeast-1:200776227748:layer:sharp-node20:1
```

### Deploy với Public Layer

```bash
# Set environment variables
export S3_BUCKET_NAME="zenlove-origin"
export ACM_CERTIFICATE_ARN="arn:aws:acm:us-east-1:200776227748:certificate/52d96225-9203-4402-b864-68481632e0ab"
export CDN_ALIASES='["cdn.zenlove.me"]'
export SHARP_LAYER_ARNS='["arn:aws:lambda:ap-southeast-1:200776227748:layer:sharp-node20:1"]'

# Run deployment
./build.sh
```

## Cách 3: Deploy từng phần

### Bước 1: Tạo Sharp Layer (cần quyền admin)

```bash
# Tạo Sharp layer
cd sharp-layer
mkdir -p nodejs && cd nodejs
npm install sharp
cd .. && zip -r sharp-layer.zip nodejs/
aws lambda publish-layer-version \
  --layer-name sharp-node20 \
  --description "Sharp image processing library for Node.js 20" \
  --zip-file fileb://sharp-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region ap-southeast-1
```

### Bước 2: Build Lambda Function

```bash
cd lambda
npm ci --omit=dev
zip -r ../lambda.zip .
cd ..
```

### Bước 3: Deploy Infrastructure

```bash
cd infra
terraform init
terraform apply \
  -var="s3_bucket_name=zenlove-origin" \
  -var="acm_certificate_arn=arn:aws:acm:us-east-1:200776227748:certificate/52d96225-9203-4402-b864-68481632e0ab" \
  -var='cdn_aliases=["cdn.zenlove.me"]' \
  -var='sharp_layer_arns=["arn:aws:lambda:ap-southeast-1:200776227748:layer:sharp-node20:1"]'
```

## Test sau khi deploy

### 1. Upload ảnh test

```bash
# Tạo ảnh test
curl -o test-image.jpg https://picsum.photos/800/600

# Upload lên S3
aws s3 cp test-image.jpg s3://zenlove-origin/test/test-image.jpg
```

### 2. Test API

```bash
# Lấy API endpoint
cd infra && terraform output api_endpoint

# Test resize
curl "https://cdn.zenlove.me/img/test/test-image.jpg?resize=400x&format=webp&quality=90"

# Test crop và resize
curl "https://cdn.zenlove.me/img/test/test-image.jpg?crop=100,50,600,400&resize=300x200&format=jpeg&quality=85"
```

### 3. Kiểm tra logs

```bash
# Xem CloudWatch logs
aws logs tail /aws/lambda/img-transformer --follow
```

## Troubleshooting

### Lỗi 403 Access Denied

- Kiểm tra quyền IAM của user
- Đảm bảo user có đủ quyền cho tất cả services

### Lỗi Sharp Layer không tìm thấy

- Verify Sharp layer ARN
- Tạo Sharp layer mới nếu cần

### Lỗi S3 bucket đã tồn tại

- Sử dụng bucket name khác hoặc
- Import bucket hiện tại vào Terraform state

### Lỗi ACM Certificate

- Đảm bảo certificate ở region us-east-1
- Verify certificate ARN

## Monitoring

### CloudWatch Metrics

- Lambda invocation count/duration
- API Gateway request count
- CloudFront cache hit/miss

### CloudWatch Logs

- Lambda function logs
- API Gateway access logs

### Alerts

- Lambda errors
- API Gateway 5xx errors
- CloudFront cache miss rate cao
