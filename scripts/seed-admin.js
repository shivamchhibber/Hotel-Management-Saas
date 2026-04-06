/**
 * Greenfield seed using Firebase Admin SDK (bypasses Firestore security rules).
 *
 * Prerequisites:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *
 * Optional env overrides:
 *   SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD
 *   SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD
 *   SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD
 *
 * Usage: npm run seed:admin
 */

const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account JSON path.');
    process.exit(1);
}

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

const superEmail = process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@hotelmanagement.com';
const superPass = process.env.SEED_SUPER_ADMIN_PASSWORD || 'ChangeMe!Admin123';
const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@luxuryhotel.com';
const ownerPass = process.env.SEED_OWNER_PASSWORD || 'ChangeMe!Owner123';
const staffEmail = process.env.SEED_STAFF_EMAIL || 'staff@luxuryhotel.com';
const staffPass = process.env.SEED_STAFF_PASSWORD || 'ChangeMe!Staff123';

async function ensureAuthUser(email, password, displayName) {
    try {
        const existing = await auth.getUserByEmail(email);
        return existing.uid;
    } catch (e) {
        if (e.code !== 'auth/user-not-found') throw e;
        const rec = await auth.createUser({ email, password, displayName, emailVerified: true });
        return rec.uid;
    }
}

async function main() {
    const superUid = await ensureAuthUser(superEmail, superPass, 'Super Admin');
    await db.collection('users').doc(superUid).set({
        uid: superUid,
        email: superEmail,
        displayName: 'Super Admin',
        role: 'super_admin',
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('Super admin:', superEmail, 'uid=', superUid);

    const ownerUid = await ensureAuthUser(ownerEmail, ownerPass, 'Hotel Owner');
    const hotelRef = db.collection('hotels').doc('hotel-001');
    await hotelRef.set({
        name: 'Luxury Palace Hotel',
        ownerId: ownerUid,
        ownerName: 'Hotel Owner',
        address: '123 Marine Drive, Mumbai - 400001',
        phone: '+912234567890',
        email: 'info@luxuryhotel.com',
        isActive: true,
        totalRooms: 50,
        availableRooms: 50,
        totalRevenue: 0,
        amenities: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await db.collection('users').doc(ownerUid).set({
        uid: ownerUid,
        email: ownerEmail,
        displayName: 'Hotel Owner',
        role: 'hotel_owner',
        hotelId: 'hotel-001',
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('Hotel owner:', ownerEmail, 'uid=', ownerUid, 'hotel=hotel-001');

    const staffUid = await ensureAuthUser(staffEmail, staffPass, 'Hotel Staff');
    await db.collection('users').doc(staffUid).set({
        uid: staffUid,
        email: staffEmail,
        displayName: 'Hotel Staff',
        role: 'hotel_staff',
        hotelId: 'hotel-001',
        hotelName: 'Luxury Palace Hotel',
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('Staff:', staffEmail, 'uid=', staffUid);

    console.log('\nDone. Change default passwords before production.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
