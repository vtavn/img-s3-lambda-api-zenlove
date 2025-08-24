#!/bin/bash

set -e

echo "🚀 Building and deploying Image Transformation Service..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_requirements() {
    echo "📋 Checking requirements..."
    
    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}❌ Terraform not found. Please install Terraform >= 1.0${NC}"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found. Please install Node.js >= 20${NC}"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm not found. Please install npm${NC}"
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not found. Please install and configure AWS CLI${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All requirements met${NC}"
}

# Build Lambda function
build_lambda() {
    echo "🔨 Building Lambda function..."
    
    cd lambda
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    npm ci --omit=dev
    
    # Create zip file
    echo "📦 Creating zip file..."
    zip -r ../lambda.zip . -q
    
    cd ..
    
    echo -e "${GREEN}✅ Lambda function built successfully${NC}"
}

# Deploy infrastructure
deploy_infra() {
    echo "🏗️  Deploying infrastructure..."
    
    cd infra
    
    # Initialize Terraform if needed
    if [ ! -d ".terraform" ]; then
        echo "🔧 Initializing Terraform..."
        terraform init
    fi
    
    # Check if required variables are provided
    if [ -z "$S3_BUCKET_NAME" ]; then
        echo -e "${RED}❌ S3_BUCKET_NAME environment variable is required${NC}"
        echo "Usage: S3_BUCKET_NAME=your-bucket terraform apply ..."
        exit 1
    fi
    
    if [ -z "$ACM_CERTIFICATE_ARN" ]; then
        echo -e "${RED}❌ ACM_CERTIFICATE_ARN environment variable is required${NC}"
        echo "Usage: ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:... terraform apply ..."
        exit 1
    fi
    
    if [ -z "$CDN_ALIASES" ]; then
        echo -e "${RED}❌ CDN_ALIASES environment variable is required${NC}"
        echo "Usage: CDN_ALIASES='[\"cdn.example.com\"]' terraform apply ..."
        exit 1
    fi
    
    if [ -z "$SHARP_LAYER_ARNS" ]; then
        echo -e "${RED}❌ SHARP_LAYER_ARNS environment variable is required${NC}"
        echo "Usage: SHARP_LAYER_ARNS='[\"arn:aws:lambda:ap-southeast-1:...\"]' terraform apply ..."
        exit 1
    fi
    
    # Deploy with variables
    echo "🚀 Deploying with Terraform..."
    terraform apply \
        -var="s3_bucket_name=$S3_BUCKET_NAME" \
        -var="acm_certificate_arn=$ACM_CERTIFICATE_ARN" \
        -var="cdn_aliases=$CDN_ALIASES" \
        -var="sharp_layer_arns=$SHARP_LAYER_ARNS" \
        -auto-approve
    
    cd ..
    
    echo -e "${GREEN}✅ Infrastructure deployed successfully${NC}"
}

# Show outputs
show_outputs() {
    echo "📊 Deployment outputs:"
    cd infra
    terraform output
    cd ..
}

# Main execution
main() {
    check_requirements
    build_lambda
    deploy_infra
    show_outputs
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "1. Upload a test image:"
    echo "   aws s3 cp ./test-image.jpg s3://$S3_BUCKET_NAME/path/to/image.jpg"
    echo ""
    echo "2. Test the service:"
    echo "   curl \"https://$(echo $CDN_ALIASES | jq -r '.[0]')/img/path/to/image.jpg?resize=600x&format=webp\""
    echo ""
    echo "3. Monitor logs:"
    echo "   aws logs tail /aws/lambda/img-transformer --follow"
}

# Run main function
main "$@"
