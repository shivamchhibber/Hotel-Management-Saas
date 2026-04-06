#!/usr/bin/env bash
# Firebase callable HTTPS functions must allow unauthenticated HTTP access at the
# Cloud IAM layer (OPTIONS preflight + POST). Auth is enforced inside the function
# via the Firebase ID token. Without Cloud Functions Invoker for allUsers, browsers
# see: OPTIONS 403 → "No Access-Control-Allow-Origin" → CORS error.
#
# Prerequisites: gcloud CLI, billing enabled, permission to change IAM.
#   gcloud auth login
#   gcloud config set project YOUR_PROJECT_ID
#
# Usage:
#   GCLOUD_PROJECT=botarmy-hotel-management ./scripts/grant-callable-invoker-public.sh

set -euo pipefail

PROJECT="${GCLOUD_PROJECT:-${GOOGLE_CLOUD_PROJECT:-}}"
REGION="${FIREBASE_FUNCTIONS_REGION:-us-central1}"

if [[ -z "$PROJECT" ]]; then
  echo "Set GCLOUD_PROJECT (or GOOGLE_CLOUD_PROJECT) to your Firebase/GCP project id." >&2
  exit 1
fi

FUNCS=(
  createStaffUser
  staffListRooms
  staffListGuests
  staffListMyStaffActions
  staffUpdateRoom
  staffLookupGuestProfile
  ownerListRooms
  ownerListGuests
  ownerListStays
  superAdminBackfillStayTotals
  deleteStaffUser
  resetStaffPassword
  superAdminCreateHotel
  superAdminListHotels
  superAdminListUsers
)

for f in "${FUNCS[@]}"; do
  echo "Granting roles/cloudfunctions.invoker (allUsers) on ${f} (${REGION})..."
  gcloud functions add-iam-policy-binding "$f" \
    --region="$REGION" \
    --member="allUsers" \
    --role="roles/cloudfunctions.invoker" \
    --project="$PROJECT"
done

echo "Done. Retry the app; OPTIONS should return 204 with CORS headers."
