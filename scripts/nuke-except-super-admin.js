/**
 * Wipe Firestore and optionally Firebase Auth.
 *
 * Credentials (first match wins):
 *   1) GOOGLE_APPLICATION_CREDENTIALS if set (path must exist)
 *   2) scripts/firebase-service-account.local.json  (gitignored)
 *   3) Application Default Credentials (e.g. gcloud auth application-default login)
 *
 * Service account needs Firebase Authentication Admin + Cloud Datastore access.
 *
 * --- Mode A: NUKE_ALL=yes (empty everything) ---
 *   - Deletes every document in every root Firestore collection (via listCollections).
 *   - Deletes every Firebase Auth user.
 *   Afterward you have no logins: create a user in Authentication, then Firestore
 *   users/{thatAuthUid} with role "super_admin" (and uid, email, isActive), or run npm run seed:admin.
 *
 *   DRY_RUN=1 NUKE_ALL=yes node scripts/nuke-except-super-admin.js
 *   CONFIRM_NUKE=yes NUKE_ALL=yes node scripts/nuke-except-super-admin.js
 *
 * --- Mode B: default (keep super admin) ---
 *   Preserves: SUPER_ADMIN_UID / SUPER_ADMIN_EMAIL / users.*.role === super_admin
 *
 *   CONFIRM_NUKE=yes node scripts/nuke-except-super-admin.js
 *
 * Safety: CONFIRM_NUKE=yes required for any destructive run (not for DRY_RUN=1).
 *
 * Project id: scripts/firebase-project-id.txt (or FIREBASE_PROJECT_ID / service JSON project_id)
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const LOCAL_CREDENTIALS_FILE = path.join(__dirname, 'firebase-service-account.local.json');
const PROJECT_ID_FILE = path.join(__dirname, 'firebase-project-id.txt');

function normalizeRole(value) {
    if (value == null || value === '') return null;
    return String(value).trim().toLowerCase().replace(/-/g, '_');
}

function isSuperAdminRole(value) {
    return normalizeRole(value) === 'super_admin';
}

function parseUidList(raw) {
    if (!raw) return [];
    return String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

async function buildPreserveUidSet(db, auth) {
    const preserve = new Set();

    for (const uid of parseUidList(process.env.SUPER_ADMIN_UID)) {
        preserve.add(uid);
    }

    const email = process.env.SUPER_ADMIN_EMAIL && String(process.env.SUPER_ADMIN_EMAIL).trim();
    if (email) {
        try {
            const rec = await auth.getUserByEmail(email);
            preserve.add(rec.uid);
            console.log(`Preserve from SUPER_ADMIN_EMAIL: ${email} → ${rec.uid}`);
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                console.warn(`SUPER_ADMIN_EMAIL not found in Auth: ${email}`);
            } else {
                throw e;
            }
        }
    }

    const usersSnap = await db.collection('users').get();
    usersSnap.docs.forEach((d) => {
        if (isSuperAdminRole(d.data().role)) {
            preserve.add(d.id);
        }
    });

    return preserve;
}

async function wipeCollection(db, name, dryRun) {
    if (dryRun) {
        try {
            const agg = await db.collection(name).count().get();
            const n = agg.data().count;
            console.log(`[dry-run] "${name}": ${n} document(s)`);
        } catch (e) {
            console.log(`[dry-run] "${name}": could not count (${e.message || e})`);
        }
        return;
    }
    let deleted = 0;
    for (;;) {
        const snap = await db.collection(name).limit(400).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        deleted += snap.size;
    }
    if (deleted > 0) {
        console.log(`Deleted ${deleted} document(s) from "${name}"`);
    }
}

async function deleteFirestoreUsersExcept(db, preserve, dryRun) {
    const snap = await db.collection('users').get();
    const toDelete = snap.docs.filter((d) => !preserve.has(d.id));
    console.log(
        `Firestore users: preserving ${preserve.size} UID(s), deleting ${toDelete.length} user document(s)`,
    );
    if (dryRun) {
        toDelete.slice(0, 20).forEach((d) => console.log(`[dry-run] Would delete users/${d.id}`));
        if (toDelete.length > 20) console.log(`[dry-run] … and ${toDelete.length - 20} more`);
        return;
    }
    for (let i = 0; i < toDelete.length; i += 400) {
        const batch = db.batch();
        toDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
}

async function listRootCollectionIds(db) {
    const refs = await db.listCollections();
    return refs.map((r) => r.id);
}

async function deleteAuthUsersExcept(auth, preserve, dryRun) {
    let pageToken;
    let wouldDelete = 0;
    let deleted = 0;
    do {
        const page = await auth.listUsers(1000, pageToken);
        for (const u of page.users) {
            if (preserve.has(u.uid)) continue;
            if (dryRun) {
                wouldDelete += 1;
                console.log(`[dry-run] Would delete Auth user ${u.uid} (${u.email || 'no email'})`);
            } else {
                await auth.deleteUser(u.uid);
                deleted += 1;
                console.log(`Deleted Auth user ${u.uid} (${u.email || 'no email'})`);
            }
        }
        pageToken = page.pageToken;
    } while (pageToken);
    if (!dryRun) {
        console.log(`Auth: deleted ${deleted} user(s) total`);
    } else {
        console.log(`[dry-run] Auth: would delete ${wouldDelete} user(s)`);
    }
}

function resolveFirebaseProjectId(credPath) {
    if (credPath && fs.existsSync(credPath)) {
        try {
            const j = JSON.parse(fs.readFileSync(credPath, 'utf8'));
            if (j.project_id) {
                return j.project_id;
            }
        } catch (_) {
            /* ignore */
        }
    }
    if (process.env.FIREBASE_PROJECT_ID) {
        return process.env.FIREBASE_PROJECT_ID.trim();
    }
    if (process.env.GCLOUD_PROJECT) {
        return process.env.GCLOUD_PROJECT.trim();
    }
    if (fs.existsSync(PROJECT_ID_FILE)) {
        const line = fs.readFileSync(PROJECT_ID_FILE, 'utf8').trim().split(/\r?\n/)[0].trim();
        if (line) {
            return line;
        }
    }
    return null;
}

function resolveCredentialsPath() {
    const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (envPath) {
        if (!fs.existsSync(envPath)) {
            console.error(`GOOGLE_APPLICATION_CREDENTIALS file not found: ${envPath}`);
            process.exit(1);
        }
        return envPath;
    }
    if (fs.existsSync(LOCAL_CREDENTIALS_FILE)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = LOCAL_CREDENTIALS_FILE;
        return LOCAL_CREDENTIALS_FILE;
    }
    return null;
}

async function main() {
    const credPath = resolveCredentialsPath();
    if (credPath) {
        console.log(`Using credentials file: ${credPath}`);
    } else {
        console.log(
            `No env or ${LOCAL_CREDENTIALS_FILE} — using Application Default Credentials.`,
        );
    }

    const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
    const nukeAll = process.env.NUKE_ALL === 'yes' || process.env.NUKE_ALL === 'true';
    if (!dryRun && process.env.CONFIRM_NUKE !== 'yes') {
        console.error('Refusing to run: set CONFIRM_NUKE=yes (or DRY_RUN=1 for a preview).');
        process.exit(1);
    }

    const projectId = resolveFirebaseProjectId(credPath);
    if (!projectId) {
        console.error(
            'Could not determine Firebase project id. Set FIREBASE_PROJECT_ID, or add project id to',
            PROJECT_ID_FILE,
        );
        process.exit(1);
    }
    console.log(`Firebase project: ${projectId}`);
    admin.initializeApp({ projectId });
    const db = admin.firestore();
    const auth = admin.auth();

    if (nukeAll) {
        console.log(
            '\nNUKE_ALL — all root Firestore collections and all Auth users will be removed (nothing preserved).\n',
        );
    }
    console.log(dryRun ? 'DRY RUN — no data will be deleted.\n' : 'DESTRUCTIVE RUN — deleting data…\n');

    if (nukeAll) {
        const collectionIds = await listRootCollectionIds(db);
        console.log(
            `Root collections (${collectionIds.length}): ${collectionIds.length ? collectionIds.join(', ') : '(none)'}`,
        );
        for (const c of collectionIds) {
            await wipeCollection(db, c, dryRun);
        }
        await deleteAuthUsersExcept(auth, new Set(), dryRun);
        console.log(
            dryRun
                ? '\nDry run finished.'
                : '\nDone. Next: Firebase Console → Authentication → Add user with email/password. Then Firestore → users → document ID = that user’s UID, fields e.g. uid, email, displayName, role: "super_admin", isActive: true. Or run npm run seed:admin with GOOGLE_APPLICATION_CREDENTIALS set.',
        );
        return;
    }

    const preserve = await buildPreserveUidSet(db, auth);
    if (preserve.size === 0) {
        console.error(
            'No super admin UID to preserve. Set SUPER_ADMIN_EMAIL or SUPER_ADMIN_UID, ensure users/{uid}.role is "super_admin", or use NUKE_ALL=yes to wipe everything.',
        );
        process.exit(1);
    }

    console.log('\nPreserving these Auth UIDs (and matching users/{uid} docs):');
    for (const uid of preserve) {
        try {
            const u = await auth.getUser(uid);
            console.log(`  ${uid}  ${u.email || ''}`);
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                console.log(`  ${uid}  (no Auth user — keeping Firestore users/${uid} if it exists)`);
            } else {
                throw e;
            }
        }
    }

    const collections = [
        'checkins',
        'checkouts',
        'guests',
        'staff_actions',
        'activity_logs',
        'activityLogs',
        'rooms',
        'hotels',
    ];

    for (const c of collections) {
        await wipeCollection(db, c, dryRun);
    }

    await deleteFirestoreUsersExcept(db, preserve, dryRun);
    await deleteAuthUsersExcept(auth, preserve, dryRun);

    console.log(dryRun ? '\nDry run finished.' : '\nDone. Sign in as your super admin and recreate hotels/owners from Hotel Management.');
}

main().catch((err) => {
    const msg = err && err.message ? String(err.message) : String(err);
    if (msg.includes('Could not load the default credentials')) {
        console.error(
            `\nNo credentials found. Download a private key from Firebase Console → Project settings →`,
            `Service accounts, then save it as:\n  ${LOCAL_CREDENTIALS_FILE}\n`,
        );
    }
    console.error(err);
    process.exit(1);
});
