console.error(`
npm run seed is deprecated: the client SDK cannot satisfy production Firestore rules.

Use one of:
  1) Bootstrap: sign up once, then set users/{yourAuthUid}.role = "super_admin" in Firebase Console.
  2) Admin seed: npm run seed:admin (requires GOOGLE_APPLICATION_CREDENTIALS — see scripts/seed-admin.js).
`);
process.exit(1);
