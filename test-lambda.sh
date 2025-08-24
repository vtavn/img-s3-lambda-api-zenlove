#!/bin/bash

echo "🧪 Testing Lambda function locally..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test cases
test_cases=(
    "resize=600x&format=webp&quality=90"
    "resize=400x300&format=jpeg&quality=85"
    "crop=100,50,600,400&resize=300x200&format=png"
    "format=avif&quality=95"
    "resize=1000x&quality=75"
)

echo -e "${YELLOW}Testing Lambda function with different parameters...${NC}"

for i in "${!test_cases[@]}"; do
    echo -e "\n${GREEN}Test case $((i+1)): ${test_cases[$i]}${NC}"
    
    # Create test event
    cat > test-event.json << EOF
{
  "pathParameters": {
    "proxy": "test-image.jpg"
  },
  "queryStringParameters": {
    $(echo "${test_cases[$i]}" | sed 's/&/", "/g' | sed 's/=/": "/g' | sed 's/^/"/' | sed 's/$/"/' | sed 's/", "/", "/g')
  },
  "requestContext": {
    "http": {
      "method": "GET"
    }
  }
}
EOF

    echo "Event:"
    cat test-event.json | jq .
    
    echo -e "\n${YELLOW}Expected behavior:${NC}"
    echo "- Parse parameters correctly"
    echo "- Return appropriate response"
    echo "- Log processing details"
done

echo -e "\n${GREEN}✅ Test cases prepared!${NC}"
echo -e "${YELLOW}To run actual tests:${NC}"
echo "1. Deploy Lambda function first"
echo "2. Upload test image to S3"
echo "3. Test via API Gateway or CloudFront"
echo ""
echo "Example test commands:"
echo "curl \"https://cdn.zenlove.me/img/test-image.jpg?resize=600x&format=webp&quality=90\""
echo "curl \"https://cdn.zenlove.me/img/test-image.jpg?crop=100,50,600,400&resize=300x200&format=jpeg&quality=85\""

# Cleanup
rm -f test-event.json
