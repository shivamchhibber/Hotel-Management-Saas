const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, addDoc } = require('firebase/firestore');

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCmbBgb9jd97dZykUbIDzD4Oo6FkXh00xA",
    authDomain: "botarmy-hotel-management.firebaseapp.com",
    projectId: "botarmy-hotel-management",
    storageBucket: "botarmy-hotel-management.firebasestorage.app",
    messagingSenderId: "1012001482685",
    appId: "1:1012001482685:web:07ecea858a21336caed4d4",
    measurementId: "G-C2SV5Z2GKZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function populateDatabase() {
    try {
        console.log('🚀 Starting to populate Firestore database...');

        // 1. Create Users Collection
        console.log('📝 Creating users...');

        // Super Admin
        await setDoc(doc(db, 'users', 'super-admin-001'), {
            uid: 'super-admin-001',
            email: 'admin@test.com',
            displayName: 'Super Admin',
            role: 'super-admin',
            isActive: true,
            createdAt: new Date(),
            phoneNumber: '+919876543210'
        });
        console.log('✅ Super Admin created');

        // Hotel Owner
        await setDoc(doc(db, 'users', 'hotel-owner-001'), {
            uid: 'hotel-owner-001',
            email: 'owner@test.com',
            displayName: 'Hotel Owner',
            role: 'hotel-owner',
            isActive: true,
            createdAt: new Date(),
            phoneNumber: '+919876543211'
        });
        console.log('✅ Hotel Owner created');

        // Hotel Staff
        await setDoc(doc(db, 'users', 'hotel-staff-001'), {
            uid: 'hotel-staff-001',
            email: 'staff@test.com',
            displayName: 'Hotel Staff',
            role: 'hotel-staff',
            isActive: true,
            createdAt: new Date(),
            phoneNumber: '+919876543212'
        });
        console.log('✅ Hotel Staff created');

        // Guest
        await setDoc(doc(db, 'users', 'guest-001'), {
            uid: 'guest-001',
            email: 'guest@test.com',
            displayName: 'Guest User',
            role: 'guest',
            isActive: true,
            createdAt: new Date(),
            phoneNumber: '+919876543213'
        });
        console.log('✅ Guest created');

        // 2. Create Hotels Collection
        console.log('🏨 Creating hotels...');

        await setDoc(doc(db, 'hotels', 'hotel-001'), {
            id: 'hotel-001',
            name: 'Grand Palace Hotel',
            address: '123 Main Street, Mumbai, India',
            phone: '+91-22-12345678',
            email: 'info@grandpalace.com',
            ownerId: 'hotel-owner-001',
            isActive: true,
            createdAt: new Date(),
            totalRooms: 100,
            availableRooms: 85,
            rating: 4.5,
            amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Gym']
        });
        console.log('✅ Hotel created');

        // 3. Create Guests Collection
        console.log('👥 Creating guests...');

        await setDoc(doc(db, 'guests', 'guest-001'), {
            id: 'guest-001',
            name: 'John Doe',
            email: 'guest@test.com',
            phone: '+919876543213',
            address: '456 Guest Street, Delhi, India',
            createdAt: new Date(),
            isActive: true
        });
        console.log('✅ Guest profile created');

        // 4. Create Check-ins Collection
        console.log('📋 Creating check-ins...');

        await addDoc(collection(db, 'checkins'), {
            guestId: 'guest-001',
            hotelId: 'hotel-001',
            roomNumber: '101',
            checkInDate: new Date('2024-01-15'),
            checkOutDate: new Date('2024-01-17'),
            status: 'checked-out',
            totalAmount: 5000,
            createdAt: new Date(),
            createdBy: 'hotel-staff-001'
        });
        console.log('✅ Check-in created');

        // 5. Create Activity Logs Collection
        console.log('📊 Creating activity logs...');

        await addDoc(collection(db, 'activityLogs'), {
            userId: 'super-admin-001',
            action: 'user_created',
            description: 'Super Admin account created',
            timestamp: new Date(),
            metadata: {
                targetUserId: 'super-admin-001',
                targetUserRole: 'super-admin'
            }
        });
        console.log('✅ Activity log created');

        console.log('🎉 Database populated successfully!');
        console.log('\n📋 Test Credentials:');
        console.log('Super Admin: admin@test.com / password123');
        console.log('Hotel Owner: owner@test.com / password123');
        console.log('Hotel Staff: staff@test.com / password123');
        console.log('Guest: guest@test.com / password123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error populating database:', error);
        process.exit(1);
    }
}

populateDatabase();
