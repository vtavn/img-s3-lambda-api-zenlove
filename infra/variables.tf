variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-southeast-1"
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket for storing images"
  type        = string
}

variable "lambda_zip_path" {
  description = "Path to the Lambda function zip file"
  type        = string
  default     = "../lambda.zip"
}

variable "sharp_layer_arns" {
  description = "List of Sharp Lambda Layer ARNs"
  type        = list(string)
}

variable "cdn_aliases" {
  description = "List of CloudFront aliases (custom domains)"
  type        = list(string)
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate in us-east-1 region"
  type        = string
}

variable "cache_default_ttl" {
  description = "Default TTL for CloudFront cache"
  type        = number
  default     = 31536000
}

variable "cache_min_ttl" {
  description = "Minimum TTL for CloudFront cache"
  type        = number
  default     = 60
}

variable "cache_max_ttl" {
  description = "Maximum TTL for CloudFront cache"
  type        = number
  default     = 31536000
}

variable "cache_include_accept" {
  description = "Whether to include Accept header in cache key"
  type        = bool
  default     = false
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
}

variable "cors_allowed_origins" {
  description = "List of allowed origins for CORS"
  type        = list(string)
  default     = ["*"]
}

variable "max_width" {
  description = "Maximum allowed image width"
  type        = number
  default     = 3000
}

variable "max_height" {
  description = "Maximum allowed image height"
  type        = number
  default     = 3000
}

variable "default_format" {
  description = "Default image format"
  type        = string
  default     = "webp"
}

variable "default_quality" {
  description = "Default image quality (1-100)"
  type        = number
  default     = 85
}
