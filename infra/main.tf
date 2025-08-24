terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.50"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# S3 Bucket for images
resource "aws_s3_bucket" "images" {
  bucket = var.s3_bucket_name
}

resource "aws_s3_bucket_ownership_controls" "images" {
  bucket = aws_s3_bucket.images.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "images" {
  bucket = aws_s3_bucket.images.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Policy for OAC
resource "aws_s3_bucket_policy" "images" {
  bucket = aws_s3_bucket.images.id
  policy = templatefile("${path.module}/policies/s3-oac-policy.json.tmpl", {
    bucket_arn = aws_s3_bucket.images.arn
    cloudfront_distribution_arn = aws_cloudfront_distribution.main.arn
  })
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "img-transformer-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_s3" {
  name = "lambda-s3-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.images.arn,
          "${aws_s3_bucket.images.arn}/*"
        ]
      }
    ]
  })
}

# Lambda Function
resource "aws_lambda_function" "img_transformer" {
  filename         = var.lambda_zip_path
  function_name    = "img-transformer"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 20
  memory_size     = 1024
  layers          = var.sharp_layer_arns

  environment {
    variables = {
      SOURCE_BUCKET = aws_s3_bucket.images.bucket
      MAX_W         = var.max_width
      MAX_H         = var.max_height
      DEFAULT_FMT   = var.default_format
      DEFAULT_QUAL  = var.default_quality
    }
  }
}

# API Gateway HTTP API v2
resource "aws_apigatewayv2_api" "main" {
  name          = "img-transformer-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id = aws_apigatewayv2_api.main.id
  name   = "prod"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.img_transformer.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "img_proxy" {
  api_id = aws_apigatewayv2_api.main.id
  route_key = "GET /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.img_transformer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "s3-oac"
  description                       = "OAC for S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Cache Policy
resource "aws_cloudfront_cache_policy" "img_query_cache" {
  name        = "Img-Query-Cache"
  comment     = "Cache policy for image transformation queries"
  default_ttl = var.cache_default_ttl
  min_ttl     = var.cache_min_ttl
  max_ttl     = var.cache_max_ttl

  parameters_in_cache_key_and_forwarded_to_origin {
    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings {
        items = ["crop", "resize", "format", "quality"]
      }
    }
    headers_config {
      header_behavior = var.cache_include_accept ? "whitelist" : "none"
      dynamic "headers" {
        for_each = var.cache_include_accept ? ["Accept"] : []
        content {
          items = headers.value
        }
      }
    }
    cookies_config {
      cookie_behavior = "none"
    }
    enable_accept_encoding_gzip = true
    enable_accept_encoding_brotli = true
  }
}

# CloudFront Origin Request Policy
resource "aws_cloudfront_origin_request_policy" "img_query_forward" {
  name    = "Img-Query-Forward"
  comment = "Forward all query strings for image transformation"

  query_strings_config {
    query_string_behavior = "all"
  }

  headers_config {
    header_behavior = var.cache_include_accept ? "whitelist" : "none"
    dynamic "headers" {
      for_each = var.cache_include_accept ? ["Accept"] : []
      content {
        items = headers.value
      }
    }
  }

  cookies_config {
    cookie_behavior = "none"
  }
}

# CloudFront Response Headers Policy
resource "aws_cloudfront_response_headers_policy" "img_headers" {
  name    = "Img-Response-Headers"
  comment = "Response headers for image transformation"

  cors_config {
    access_control_allow_credentials = false
    access_control_allow_headers {
      items = ["*"]
    }
    access_control_allow_methods {
      items = ["GET", "HEAD"]
    }
    access_control_allow_origins {
      items = var.cors_allowed_origins
    }
    access_control_expose_headers {
      items = ["ETag"]
    }
    access_control_max_age_sec = 600
    origin_override = true
  }

  custom_headers_config {
    items {
      header   = "Cache-Control"
      override = true
      value    = "public, max-age=31536000, immutable"
    }
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = var.price_class
  aliases             = ["cdn.zenlove.me"]

  origin {
    domain_name              = aws_s3_bucket.images.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
    origin_id                = "s3-origin"
  }

  origin {
    domain_name = replace(replace(aws_apigatewayv2_stage.prod.invoke_url, "https://", ""), "/prod", "")
    origin_id   = "api-origin"
    origin_path = "/prod"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "api-origin"

    cache_policy_id            = aws_cloudfront_cache_policy.img_query_cache.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.img_query_forward.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.img_headers.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
