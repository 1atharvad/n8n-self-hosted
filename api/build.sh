#!/bin/bash
cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="ghcr.io/1atharvad/mediasynth:latest"
BUILD_ARGS=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --push|-p)
      PUSH=true
      shift
      ;;
    --no-cache)
      BUILD_ARGS="$BUILD_ARGS --no-cache"
      shift
      ;;
    --tag|-t)
      IMAGE_NAME="$2"
      shift 2
      ;;
    --clean)
      CLEAN=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --push, -p        Push image to registry after building"
      echo "  --no-cache        Build without using cache"
      echo "  --tag, -t TAG     Use custom image tag"
      echo "  --clean           Remove dangling images after build"
      echo "  --help, -h        Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Clean up before build
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}Cleaning up dangling images...${NC}"
    docker image prune -f
fi

# Build the image
echo -e "${GREEN}Building image: $IMAGE_NAME${NC}"
if docker build $BUILD_ARGS --platform linux/amd64,linux/arm64 -t "$IMAGE_NAME" .; then
    echo -e "${GREEN}✓ Build successful!${NC}"
else
    echo -e "${RED}✗ Build failed!${NC}"
    exit 1
fi

# Push if requested
if [ "$PUSH" = true ]; then
    echo -e "${YELLOW}Pushing to registry...${NC}"
    if docker push "$IMAGE_NAME"; then
        echo -e "${GREEN}✓ Push successful!${NC}"
    else
        echo -e "${RED}✗ Push failed!${NC}"
        exit 1
    fi
fi

# Show image info
echo -e "${GREEN}Image details:${NC}"
docker images "$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo -e "${GREEN}Done!${NC}"