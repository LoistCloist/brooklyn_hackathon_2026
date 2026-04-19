#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="bc-hacks-6434f"
SERVICE="musilearn-api"
REGION="us-east1"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}"

echo "Building and pushing image..."
gcloud builds submit --config cloudbuild.yaml --project "${PROJECT_ID}" .

echo "Deploying to Cloud Run..."
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 120

echo ""
echo "Service URL:"
gcloud run services describe "${SERVICE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format "value(status.url)"
