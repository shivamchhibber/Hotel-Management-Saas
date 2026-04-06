import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Sample data for seeding the database
const seedData = async () => {
    try {
        console.log('Starting to seed database...');

        // 1. Create Super Admin
        const superAdminId = 'super-admin-001';
        await setDoc(doc(db, 'users', superAdminId), {
            uid: superAdminId,
            email: 'admin@hotelmanagement.com',
            displayName: 'Super Admin',
            role: 'super_admin',
            isActive: true,
            createdAt: new Date(),
            phoneNumber: '+919876543210'
        });
        console.log('✅ Super Admin created');

        // 2. Create Hotel Owner
        const hotelOwnerId = 'hotel-owner-001';
        await setDoc(doc(db, 'users', hotelOwnerId), {
            uid: hotelOwnerId,
            email: 'owner@luxuryhotel.com',
            displayName: 'John Smith',
            role: 'hotel_owner',
            isActive: true,
            createdAt: new Date(),
            phoneNumber: '+919876543211'
        });
        console.log('✅ Hotel Owner created');

        // 3. Create Hotel
        const hotelId = 'hotel-001';
        await setDoc(doc(db, 'hotels', hotelId), {
            id: hotelId,
            name: 'Luxury Palace Hotel',
            ownerId: hotelOwnerId,
            ownerName: 'John Smith',
            location: 'Mumbai, Maharashtra',
            phone: '+912234567890',
            email: 'info@luxuryhotel.com',
            address: '123 Marine Drive, Mumbai - 400001',
            totalRooms: 50,
            isActive: true,
            totalRevenue: 0,
            createdAt: new Date()
        });
        console.log('✅ Hotel created');

        // 4. Create Hotel Staff
        const hotelStaffId = 'hotel-staff-001';
        await setDoc(doc(db, 'users', hotelStaffId), {
            uid: hotelStaffId,
            email: 'staff@luxuryhotel.com',
            displayName: 'Sarah Johnson',
            role: 'hotel_staff',
            hotelId: hotelId,
            hotelName: 'Luxury Palace Hotel',
            isActive: true,
            createdAt: new Date(),
            phoneNumber: '+919876543212'
        });
        console.log('✅ Hotel Staff created');

        // 5. Create Guests
        const guests = [
            {
                id: 'guest-001',
                name: 'Alice Johnson',
                email: 'alice.johnson@email.com',
                phoneNumber: '+919876543213',
                hotelId: hotelId,
                hotelName: 'Luxury Palace Hotel',
                roomNumber: '101',
                checkInDate: new Date('2024-01-15'),
                checkOutDate: new Date('2024-01-18'),
                amount: 15000,
                isCheckedIn: false,
                address: '123 Park Street, Kolkata',
                idProof: 'A1234567',
                createdAt: new Date()
            },
            {
                id: 'guest-002',
                name: 'Bob Wilson',
                email: 'bob.wilson@email.com',
                phoneNumber: '+919876543214',
                hotelId: hotelId,
                hotelName: 'Luxury Palace Hotel',
                roomNumber: '102',
                checkInDate: new Date('2024-01-20'),
                checkOutDate: null,
                amount: 12000,
                isCheckedIn: true,
                address: '456 MG Road, Bangalore',
                idProof: 'B2345678',
                createdAt: new Date()
            },
            {
                id: 'guest-003',
                name: 'Carol Davis',
                email: 'carol.davis@email.com',
                phoneNumber: '+919876543215',
                hotelId: hotelId,
                hotelName: 'Luxury Palace Hotel',
                roomNumber: '103',
                checkInDate: new Date('2024-01-22'),
                checkOutDate: null,
                amount: 18000,
                isCheckedIn: true,
                address: '789 Connaught Place, Delhi',
                idProof: 'C3456789',
                createdAt: new Date()
            }
        ];

        for (const guest of guests) {
            await setDoc(doc(db, 'guests', guest.id), guest);
        }
        console.log('✅ Guests created');

        // 6. Create Check-ins
        const checkIns = [
            {
                guestId: 'guest-001',
                hotelId: hotelId,
                guestName: 'Alice Johnson',
                roomNumber: '101',
                checkInDate: new Date('2024-01-15'),
                amount: 15000,
                staffId: hotelStaffId,
                createdAt: new Date()
            },
            {
                guestId: 'guest-002',
                hotelId: hotelId,
                guestName: 'Bob Wilson',
                roomNumber: '102',
                checkInDate: new Date('2024-01-20'),
                amount: 12000,
                staffId: hotelStaffId,
                createdAt: new Date()
            },
            {
                guestId: 'guest-003',
                hotelId: hotelId,
                guestName: 'Carol Davis',
                roomNumber: '103',
                checkInDate: new Date('2024-01-22'),
                amount: 18000,
                staffId: hotelStaffId,
                createdAt: new Date()
            }
        ];

        for (const checkIn of checkIns) {
            await addDoc(collection(db, 'checkins'), checkIn);
        }
        console.log('✅ Check-ins created');

        // 7. Create Check-outs
        const checkOuts = [
            {
                guestId: 'guest-001',
                hotelId: hotelId,
                guestName: 'Alice Johnson',
                roomNumber: '101',
                checkOutDate: new Date('2024-01-18'),
                amount: 15000,
                staffId: hotelStaffId,
                createdAt: new Date()
            }
        ];

        for (const checkOut of checkOuts) {
            await addDoc(collection(db, 'checkouts'), checkOut);
        }
        console.log('✅ Check-outs created');

        // 8. Create Activity Logs
        const activityLogs = [
            {
                hotelId: hotelId,
                action: 'check_in',
                guestName: 'Alice Johnson',
                roomNumber: '101',
                staffId: hotelStaffId,
                timestamp: new Date('2024-01-15T10:00:00')
            },
            {
                hotelId: hotelId,
                action: 'check_out',
                guestName: 'Alice Johnson',
                roomNumber: '101',
                staffId: hotelStaffId,
                timestamp: new Date('2024-01-18T12:00:00')
            },
            {
                hotelId: hotelId,
                action: 'check_in',
                guestName: 'Bob Wilson',
                roomNumber: '102',
                staffId: hotelStaffId,
                timestamp: new Date('2024-01-20T14:00:00')
            },
            {
                hotelId: hotelId,
                action: 'check_in',
                guestName: 'Carol Davis',
                roomNumber: '103',
                staffId: hotelStaffId,
                timestamp: new Date('2024-01-22T16:00:00')
            }
        ];

        for (const log of activityLogs) {
            await addDoc(collection(db, 'activity_logs'), log);
        }
        console.log('✅ Activity logs created');

        // 9. Update hotel revenue
        const totalRevenue = guests.reduce((sum, guest) => sum + guest.amount, 0);
        await setDoc(doc(db, 'hotels', hotelId), {
            totalRevenue: totalRevenue
        }, { merge: true });
        console.log('✅ Hotel revenue updated');

        console.log('🎉 Database seeding completed successfully!');
        console.log('\n📋 Sample Data Summary:');
        console.log('• 1 Super Admin (admin@hotelmanagement.com)');
        console.log('• 1 Hotel Owner (owner@luxuryhotel.com)');
        console.log('• 1 Hotel (Luxury Palace Hotel)');
        console.log('• 1 Hotel Staff (staff@luxuryhotel.com)');
        console.log('• 3 Guests with sample bookings');
        console.log('• Check-in/check-out records');
        console.log('• Activity logs');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
    }
};

// Function to clear all data (for testing)
const clearData = async () => {
    try {
        console.log('⚠️  This will clear all data from the database!');
        console.log('This function should only be used in development.');
        // Note: In production, you would need to implement proper data deletion
        // This is just a placeholder for development purposes
    } catch (error) {
        console.error('❌ Error clearing database:', error);
    }
};

export { seedData, clearData };
