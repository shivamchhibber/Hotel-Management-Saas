# Firebase Functions Setup for Staff Creation

## Overview
This setup uses Firebase Functions with Admin SDK to create staff accounts without affecting the owner's login session.

## Setup Instructions

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Initialize Firebase Functions (if not already done)
```bash
firebase init functions
```

### 4. Install Dependencies
```bash
cd functions
npm install
```

### 5. Deploy Functions
```bash
firebase deploy --only functions
```

## How It Works

### Frontend (src/views/hotel-owner/staff-management/index.jsx)
- Calls the `createStaffUser` Firebase Function
- Owner remains logged in as owner
- No authentication session changes

### Backend (functions/index.js)
- Uses Firebase Admin SDK to create users
- Admin SDK can create users without signing them in
- Validates that only hotel owners can create staff
- Creates both Firebase Auth user and Firestore document

## Benefits
✅ Owner stays logged in as owner
✅ Staff accounts created with correct role
✅ No authentication session interference
✅ Secure server-side user creation
✅ Proper role validation

## Testing
1. Deploy the functions: `firebase deploy --only functions`
2. Try creating a staff member from the hotel owner dashboard
3. Verify the owner remains logged in as owner
4. Check that staff appears in the staff management table

## Troubleshooting
- Make sure Firebase Functions are deployed
- Check Firebase Console > Functions for any errors
- Verify the function is callable from the frontend
- Check browser console for any function call errors
