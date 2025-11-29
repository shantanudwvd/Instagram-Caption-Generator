#!/bin/bash

# Deployment script for AWS ECS
# This script builds the Docker image, pushes it to ECR, and updates the ECS service
# Usage: ./deploy.sh [--dry-run]
#   --dry-run: Read-only mode - only performs AWS read operations, logs write operations instead

set -e  # Exit on error

# Check for dry-run flag
DRY_RUN=false
if [[ "$1" == "--dry-run" ]] || [[ "$1" == "--test" ]]; then
    DRY_RUN=true
fi

# Configuration - Auto-detect from AWS CLI if not set
if [ -z "$AWS_REGION" ]; then
    AWS_REGION=$(aws configure get region 2>/dev/null || echo "us-east-1")
    if [ -z "$AWS_REGION" ] || [ "$AWS_REGION" = "None" ]; then
        AWS_REGION="us-east-1"  # Default fallback
    fi
fi
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-YOUR_ACCOUNT_ID}"
ECR_REPOSITORY="${ECR_REPOSITORY:-instagram-caption-backend}"
ECS_CLUSTER="${ECS_CLUSTER:-instagram-caption-backend}"
ECS_SERVICE="${ECS_SERVICE:-instagram-caption-backend-service}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install it first."
    exit 1
fi

# Get AWS account ID automatically from AWS CLI if not set
if [ -z "$AWS_ACCOUNT_ID" ] || [ "$AWS_ACCOUNT_ID" = "YOUR_ACCOUNT_ID" ]; then
    print_info "Getting AWS account ID from AWS CLI..."
    
    # Temporarily disable exit on error for this command
    set +e
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>&1)
    AWS_CLI_EXIT_CODE=$?
    set -e
    
    if [ $AWS_CLI_EXIT_CODE -ne 0 ] || [ -z "$AWS_ACCOUNT_ID" ] || [ "$AWS_ACCOUNT_ID" = "null" ]; then
        print_error "Failed to get AWS account ID from AWS CLI."
        if [ $AWS_CLI_EXIT_CODE -ne 0 ]; then
            print_error "AWS CLI error: $AWS_ACCOUNT_ID"
        fi
        print_error ""
        print_error "Please ensure:"
        print_error "  1. AWS CLI is configured (run 'aws configure')"
        print_error "  2. You have valid AWS credentials"
        print_error "  3. Or set AWS_ACCOUNT_ID environment variable manually"
        print_error ""
        print_error "You can test your AWS credentials with: aws sts get-caller-identity"
    exit 1
fi

    print_info "Using AWS Account ID: $AWS_ACCOUNT_ID"
fi

# ECR repository URI
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"

if [ "$DRY_RUN" = true ]; then
    print_warn "DRY RUN MODE: Read-only operations only"
    print_warn "All write operations will be logged but not executed"
    echo ""
fi

print_info "Starting deployment process..."
print_info "Region: $AWS_REGION"
print_info "Account ID: $AWS_ACCOUNT_ID"
print_info "ECR Repository: $ECR_URI"
print_info "Image Tag: $IMAGE_TAG"

# Step 1: Login to ECR (read operation - get password, but login is a write)
if [ "$DRY_RUN" = true ]; then
    print_info "[DRY RUN] Would login to Amazon ECR: $ECR_URI"
    print_info "[DRY RUN] Would execute: aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI"
else
print_info "Logging in to Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI
fi

# Step 2: Check if ECR repository exists, create if not
print_info "Checking if ECR repository exists: $ECR_REPOSITORY"
set +e
aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION &> /dev/null
REPO_EXISTS=$?
set -e

if [ $REPO_EXISTS -ne 0 ]; then
    print_warn "ECR repository '$ECR_REPOSITORY' not found in region $AWS_REGION"
    print_info "Listing existing repositories in $AWS_REGION..."
    set +e
    EXISTING_REPOS=$(aws ecr describe-repositories --region $AWS_REGION --query 'repositories[*].repositoryName' --output text 2>/dev/null)
    set -e
    
    if [ -n "$EXISTING_REPOS" ]; then
        print_info "Existing repositories:"
        for repo in $EXISTING_REPOS; do
            echo "  - $repo"
        done
    else
        print_info "No repositories found in this region"
    fi
    
    if [ "$DRY_RUN" = true ]; then
        print_warn "[DRY RUN] Would create repository: $ECR_REPOSITORY"
        print_info "[DRY RUN] Would execute: aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION"
    else
        print_warn "Creating repository: $ECR_REPOSITORY"
    aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION
    print_info "ECR repository created successfully"
    fi
else
    print_info "ECR repository '$ECR_REPOSITORY' exists"
fi

# Step 3: Build Docker image (local operation, safe in dry-run)
print_info "Building Docker image..."
cd "$(dirname "$0")"
docker build -t ${ECR_REPOSITORY}:${IMAGE_TAG} .
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:latest

# Step 4: Push image to ECR (write operation - skip in dry-run)
if [ "$DRY_RUN" = true ]; then
    print_info "[DRY RUN] Would push image to ECR: ${ECR_URI}:${IMAGE_TAG}"
    print_info "[DRY RUN] Would execute: docker push ${ECR_URI}:${IMAGE_TAG}"
    print_info "[DRY RUN] Would execute: docker push ${ECR_URI}:latest"
    print_info "[DRY RUN] Image built locally but not pushed to ECR"
else
print_info "Pushing image to ECR..."
docker push ${ECR_URI}:${IMAGE_TAG}
docker push ${ECR_URI}:latest
fi

# Step 5: Check and update ECS service (read operation to check, write to update)
print_info "Checking if ECS service exists..."
set +e
ECS_SERVICE_STATUS=$(aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE --region $AWS_REGION --query 'services[0].status' --output text 2>/dev/null)
ECS_SERVICE_EXISTS=$?
set -e

if [ $ECS_SERVICE_EXISTS -eq 0 ] && [ "$ECS_SERVICE_STATUS" = "ACTIVE" ]; then
    print_info "ECS service '$ECS_SERVICE' exists and is ACTIVE"
    if [ "$DRY_RUN" = true ]; then
        print_warn "[DRY RUN] Would update ECS service to use new image"
        print_info "[DRY RUN] Would execute: aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --force-new-deployment --region $AWS_REGION"
        print_info "[DRY RUN] Would wait for deployment to stabilize"
    else
    print_info "Updating ECS service to use new image..."
    aws ecs update-service \
        --cluster $ECS_CLUSTER \
        --service $ECS_SERVICE \
        --force-new-deployment \
        --region $AWS_REGION \
        > /dev/null
    
    print_info "Service update initiated. Waiting for deployment to stabilize..."
    aws ecs wait services-stable \
        --cluster $ECS_CLUSTER \
        --services $ECS_SERVICE \
        --region $AWS_REGION
    
    print_info "Deployment completed successfully!"
    fi
else
    if [ "$DRY_RUN" = true ]; then
        print_warn "ECS service '$ECS_SERVICE' does not exist or is not ACTIVE"
        print_info "[DRY RUN] Image would be ready in ECR but service update would be skipped"
else
    print_warn "ECS service does not exist. Image has been pushed to ECR."
    print_warn "Please create the ECS service manually or use the provided task definition."
fi
fi

if [ "$DRY_RUN" = true ]; then
    print_info ""
    print_info "=== DRY RUN SUMMARY ==="
    print_info "✓ Read operations completed (checked repository, checked ECS service)"
    print_info "✓ Docker image built locally"
    print_info "✗ Write operations logged but not executed:"
    print_info "  - ECR login"
    print_info "  - ECR repository creation (if needed)"
    print_info "  - Docker image push to ECR"
    print_info "  - ECS service update"
    print_info ""
    print_info "To perform actual deployment, run without --dry-run flag"
else
print_info "Deployment process completed!"
fi

