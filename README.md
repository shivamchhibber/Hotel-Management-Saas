# Hotel Management SaaS

A comprehensive Hotel Management System built with React, Firebase, and Tailwind CSS. This application provides role-based access control for different user types including Super Admin, Hotel Owners, Hotel Staff, and Guests.

## Features

### 🔐 Authentication
- **Google Sign-in** - Quick authentication with Google accounts
- **Email/Password** - Traditional email and password authentication
- **Phone OTP** - SMS-based authentication for Indian phone numbers
- **Role-based Access Control** - Different dashboards based on user roles

### 👥 User Roles

#### Super Admin
- Manage all hotels and hotel owners
- View system-wide analytics and reports
- Activate/deactivate hotels and users
- Monitor overall platform performance

#### Hotel Owner
- Manage their hotel(s) and staff
- View detailed reports and analytics
- Monitor guest check-ins and check-outs
- Track revenue and occupancy rates

#### Hotel Staff
- Simple check-in/check-out interface
- View guest lists and current occupancy
- Manage guest information
- No access to financial data

#### Guest
- View personal stay history
- Manage profile information
- Track booking details and payments

### 🏨 Core Features
- **Real-time Data** - Live updates using Firebase Firestore
- **Responsive Design** - Works on desktop and mobile devices
- **Modern UI** - Built with Tailwind CSS and pre-built components
- **Secure** - Firebase security rules for data protection
- **Scalable** - Cloud-based architecture for easy scaling

## Tech Stack

- **Frontend**: React 19, Tailwind CSS, Chakra UI
- **Backend**: Firebase (Firestore, Auth, Functions)
- **Authentication**: Firebase Auth with multiple providers
- **Database**: Cloud Firestore
- **Deployment**: Firebase Hosting (recommended)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase project with Firestore enabled
- Google Cloud Console project for authentication

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd simple-hotel
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment variables**

   Copy [.env.example](.env.example) to `.env.local` and set `REACT_APP_FIREBASE_*` values from your Firebase project. Set `REACT_APP_FIREBASE_FUNCTIONS_REGION` to match deployed Cloud Functions (default `us-central1`).

4. **Bootstrap roles (greenfield)**

   - **Option A:** Sign up once in the app, then in Firebase Console set `users/{yourAuthUid}.role` to `super_admin`.
   - **Option B:** Run `npm run seed:admin` with `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service account JSON (see [scripts/seed-admin.js](scripts/seed-admin.js)). Change default passwords immediately.

   Self-service sign-up always creates `guest` accounts. A super admin attaches hotels to owners via **Hotel Management** (callable `superAdminCreateHotel`); the owner must already exist in Firebase Authentication.

5. **Cloud Functions (staff & hotels)**

   Deploy functions from the `functions` directory. For staff password reset emails, configure SMTP on the function environment: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_FROM`.

6. **Set up Firebase**
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication with Google, Email/Password, and Phone providers
   - Enable Firestore Database
   - Put web app config in `.env.local` as `REACT_APP_FIREBASE_*` (see `.env.example`). The app falls back to built-in defaults only for local convenience.

7. **Set up Firestore Security Rules**
   - Deploy `firestore.rules` and `firestore.indexes.json` (see `firebase.json`).

8. **Sample data (optional)**
   ```bash
   npm run seed:admin
   ```
   Requires a service account (`GOOGLE_APPLICATION_CREDENTIALS`). The legacy `npm run seed` command is disabled under production-style rules.

9. **Start the development server**
   ```bash
   npm start
   ```

10. **Open your browser**
   Navigate to `http://localhost:3000`

## Sample Data

`npm run seed:admin` (optional) creates Auth users and Firestore documents with these defaults unless you override env vars in `scripts/seed-admin.js`:

- **Super Admin**: admin@hotelmanagement.com
- **Hotel Owner**: owner@luxuryhotel.com
- **Hotel Staff**: staff@luxuryhotel.com
- **Sample Hotel**: Luxury Palace Hotel (document id `hotel-001`)

## Project Structure

```
src/
├── components/          # Reusable UI components
├── contexts/           # React contexts (Auth)
├── firebase/           # Firebase configuration
├── layouts/            # Layout components for different user roles
├── routes/             # Route definitions for each user type
├── scripts/            # Database seeding scripts
├── views/              # Page components
│   ├── super-admin/    # Super admin pages
│   ├── hotel-owner/    # Hotel owner pages
│   ├── hotel-staff/    # Hotel staff pages
│   ├── guest/          # Guest pages
│   └── auth/           # Authentication pages
└── App.jsx            # Main application component
```

## Firebase Collections

- **users** - User accounts with roles and permissions
- **hotels** - Hotel information and settings
- **guests** - Guest information and bookings
- **checkins** - Check-in records
- **checkouts** - Check-out records
- **activity_logs** - System activity tracking

## Security Rules

The application uses Firebase Security Rules to ensure:
- Users can only access data they're authorized to see
- Role-based permissions are enforced at the database level
- Data integrity is maintained across all operations

## Deployment

### Firebase Hosting (Recommended)

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project**
   ```bash
   firebase init hosting
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Deploy to Firebase**
   ```bash
   firebase deploy
   ```

## Environment Variables

For production deployment, consider using environment variables for sensitive configuration:

```bash
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
# ... other Firebase config
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the Firebase documentation for backend issues
- Review the React documentation for frontend issues

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced reporting and analytics
- [ ] Payment integration
- [ ] Multi-language support
- [ ] Advanced booking management
- [ ] Integration with external booking platforms