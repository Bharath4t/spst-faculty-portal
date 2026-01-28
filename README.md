# SPST Faculty Portal (Geo-Fenced Attendance System)

A full-stack Progressive Web App (PWA) for managing faculty attendance and leave requests, featuring GPS-based geofencing and role-based access control.

**Live Demo:** https://dainty-kleicha-a75de9.netlify.app/

## 🚀 Key Features

### 1. Smart Attendance (Geo-Fencing)

- **GPS Validation:** Faculty can only mark attendance if they are within **200 meters** of the college campus.
- **One-Tap Check-in:** Prevents duplicate entries for the same day.
- **Real-Time Status:** Admin sees "Present" count update instantly without refreshing.

### 2. Leave Management "Wallet"

- **Credit System:** Each faculty has a specific balance of leaves (CL, SL, OD, etc.).
- **Auto-Deduction:** When Admin approves a 2-day leave, 2 credits are automatically subtracted from the faculty's balance.
- **Conflict Resolution:** If a user marks "Present" but is later approved for "Sick Leave", the system automatically overwrites their status to "On Leave" to ensure data accuracy.

### 3. Role-Based Dashboards

- **Faculty View:** Mobile-first interface to mark attendance, check leave balance, and view request history.
- **Admin (HOD) View:** Interactive dashboard to filter staff by status (Present/Absent/Pending), manage leave balances, and approve requests.

## 🛠️ Tech Stack

- **Frontend:** React.js + Vite + Tailwind CSS
- **Backend:** Firebase (Firestore NoSQL Database)
- **Auth:** Firebase Authentication
- **Deployment:** Netlify (CI/CD)

## 📸 How It Works

1. **Authentication:** Users log in as either "Staff" or "Admin".
2. **Location Check:** The browser requests GPS access. Haversine formula calculates distance to stored College Coordinates.
3. **Data Sync:** All actions (Attendance, Leaves) are synced in real-time using Firestore `onSnapshot` listeners.

## 🔮 Future Improvements

- [ ] Biometric Integration
- [ ] Monthly Report PDF Generation
