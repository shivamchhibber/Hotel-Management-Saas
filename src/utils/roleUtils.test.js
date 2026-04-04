import { normalizeRole, formatRoleLabel } from './roleUtils';

describe('normalizeRole', () => {
    it('maps hyphens to underscores', () => {
        expect(normalizeRole('hotel-owner')).toBe('hotel_owner');
        expect(normalizeRole('SUPER_ADMIN')).toBe('super_admin');
    });
    it('returns null for empty', () => {
        expect(normalizeRole('')).toBeNull();
        expect(normalizeRole(null)).toBeNull();
    });
});

describe('formatRoleLabel', () => {
    it('formats canonical and legacy strings', () => {
        expect(formatRoleLabel('hotel_owner')).toBe('Hotel Owner');
        expect(formatRoleLabel('hotel-owner')).toBe('Hotel Owner');
    });
});
