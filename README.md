# GymPro – Gym Membership & Check-In System

GymPro is a full-stack gym management application that allows users to purchase gym memberships, generate a barcode for entry, and check in to gym branches using a mobile app. The system includes a React Native mobile frontend and a Node.js/Express backend API connected to a PostgreSQL database.

This project demonstrates a complete membership management workflow including authentication, payments, membership validation, and check-in tracking.

---

# Tech Stack

### Frontend
- React Native (Expo)
- JavaScript
- React Navigation
- AsyncStorage

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT Authentication
- Stripe API

---

# Features

### User Authentication
- User registration
- Secure login
- JWT token authentication

### Membership System
- Purchase membership plans
- Stripe payment integration
- Automatic membership activation
- Membership expiry tracking

### Gym Check-In
- Barcode generation for members
- Scan barcode for entry
- Check-in history tracking

### Branch Access Control
- Restrict access to specific gym branches
- Support multi-branch memberships

### Class Booking
- View available classes
- Book or cancel sessions

### Admin Features
- Manage members
- Manage gym branches
- Monitor check-ins

---

# Project Structure


VYAY
│
├── frontend
│ ├── App.js
│ ├── screens/
│ ├── components/
│ ├── assets/
│ ├── api.js
│ └── package.json
│
├── backend
│ ├── server.js
│ ├── routes/
│ │ ├── auth.js
│ │ ├── billing.js
│ │ ├── branches.js
│ │ ├── checkin.js
│ │ └── classes.js
│ │
│ ├── middleware/
│ │ ├── authMiddleware.js
│ │ ├── requireAdmin.js
│ │ └── roleMiddleware.js
│ │
│ ├── db.js
│ ├── stripeWebhook.js
│ └── package.json
│
└── README.md


---

# Installation

## 1. Clone Repository


git clone https://github.com/Kidder0/VYAY.git

cd VYAY


---

# Backend Setup


cd backend
npm install
npm start


Server will run on:


http://localhost:5000


---

# Frontend Setup


cd frontend
npm install
npx expo start


Scan the QR code using the **Expo Go app** to run the mobile application.

---

# Environment Variables

Create a `.env` file inside the backend folder.

Example:


PORT=5000
DATABASE_URL=your_database_url
JWT_SECRET=your_secret
STRIPE_SECRET_KEY=your_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret


---

# API Endpoints

Example endpoints:


POST /api/auth/register
POST /api/auth/login
GET /api/membership
POST /api/checkin
GET /api/classes
POST /api/billing/create-checkout-session


---

# Future Improvements

- Admin dashboard
- Push notifications
- Attendance analytics
- Mobile UI improvements
- Membership renewal reminders

---

# Author

Rakesh Reddy Jammuladinne

University of North Texas  
Master's in Cybersecurity
