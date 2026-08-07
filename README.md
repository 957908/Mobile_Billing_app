# 🚀 LotusERP - Smart Home Furnishing & decor ERP

LotusERP is a production-ready, enterprise-grade business management and billing platform designed specifically for home furnishing, mattress, decor, curtains, wallpaper, and manufacturing operations. It integrates standard accounting ledgers, point-of-sale (POS) billing, fabric roll tracking, manufacturing batch control, and secure OTP verification delivery models.

---

## 🏗️ Core Modules & Architecture

The application is built on a decoupled architecture consisting of a **FastAPI backend** backed by **MongoDB**, and a universal cross-platform **Expo Router frontend** optimized for mobile viewports.

### 🔑 1. Authentication & Role-Based Access Control (RBAC)
- **Security**: JWT token-based authentication with cryptographically hashed passwords.
- **Roles & Guards**: Endpoints and features are strictly protected using role-based guards:
  - `Owner` & `Manager`: Full administrative access (Products CRUD, Expenses deletion, Rolls deletion).
  - `Accountant`: Financial ledgers, Parties ledger CRUD, Expenses CRUD, and financial CSV exports.
  - `Sales`: POS Billing, Custom Orders creation, and status updates.
  - `Warehouse`: Fabric Roll creation/consumption, Manufacturing batch registry, and Delivery assignments.

### 📦 2. Inventory & POS Billing
- **Line Items**: Supports barcode scanning (with instant web-fallback), customizable units, and tax calculation.
- **Stock Validation**: 
  - **Backend**: Strict database-level checks block sales of out-of-stock items (returns HTTP 400).
  - **Frontend**: Live warning toasts appear when checkout quantities exceed current stock limits.

### 📊 3. Indian GST & Financial Auditing
- **Reports**: Instant dashboards for Profit & Loss (P&L), GST rate-wise summaries (CGST + SGST), and Sales Registers.
- **CSV Export**: Dedicated download buttons allowing direct export of audit tables (GST, P&L, Sales) to CSV for seamless integration with Chartered Accountant (CA) software.

### 🧵 4. Fabric Rolls & Manufacturing
- **Roll Lifecycle**: Supports roll registration, length tracking, consumption logging, and auto-computed remaining length.
- **Manufacturing**: Batch creation (`BATCH-XXXXX`), raw materials consumption math, labor costs, wastage margins, and automatic finished-product stock increment.

### 🚚 5. Secure OTP Deliveries
- **Timeline**: Assigned → Out for Delivery → Delivered.
- **Security**: Secure 4-digit numeric OTP matching. Deliveries require the correct customer OTP code, and capture coordinates (latitude/longitude), timestamp, and base64 delivery proof photos on checkout.

---

## ⚡ Quick Start: Backend Setup

### Prerequisites
- Python 3.10+
- MongoDB instance (Local or Atlas)

### Installation
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # macOS/Linux
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend` folder:
   ```env
   MONGO_URL=mongodb://localhost:27017/lotuserp
   DB_NAME=lotuserp
   JWT_SECRET=supersecretjwtkeychangeinproduction
   JWT_ALG=HS256
   ```
5. Start the FastAPI server locally:
   ```bash
   python -m uvicorn server:app --port 8000 --reload
   ```

---

## 📱 Quick Start: Frontend Setup

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node modules:
   ```bash
   npm install
   ```
3. Create a `.env` or `.env.local` file in the `frontend` folder:
   ```env
   EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
   ```
4. Launch the bundler:
   ```bash
   npx expo start
   ```
5. Run on your physical device using the **Expo Go** application (available on Google Play Store and iOS App Store) by scanning the displayed QR code.

---

## 🛠️ Standalone Android APK Generation

You can build a standalone release APK of the application locally using Gradle:

1. Generate the native Android folder:
   ```bash
   npx expo prebuild --platform android
   ```
2. Navigate to the generated native Android project directory:
   ```bash
   cd android
   ```
3. Run the Gradle build task:
   ```bash
   # Windows
   .\gradlew assembleRelease
   # macOS/Linux
   ./gradlew assembleRelease
   ```
4. The generated release APK will be saved at:
   `frontend/android/app/build/outputs/apk/release/app-release.apk`
