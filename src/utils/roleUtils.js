/**
 * Canonical Firestore roles use underscores: super_admin, hotel_owner, hotel_staff, guest.
 */
export function normalizeRole(role) {
    if (role == null || role === '') return null;
    return String(role).trim().toLowerCase().replace(/-/g, '_');
}

export function formatRoleLabel(role) {
    const r = normalizeRole(role);
    switch (r) {
        case 'super_admin':
            return 'Super Admin';
        case 'hotel_owner':
            return 'Hotel Owner';
        case 'hotel_staff':
            return 'Hotel Staff';
        case 'guest':
            return 'Guest';
        default:
            return role ? String(role) : '';
    }
}
