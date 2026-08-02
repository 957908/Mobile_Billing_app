# LotusERP — Product Requirements Document (v1 MVP)

## Overview
LotusERP is a premium mobile ERP app for Home Furnishing, Home Decor, Mattress, Curtain, Sofa Fabric & Interior retail/wholesale businesses in India. It replaces manual registers, Excel and legacy accounting with a modern Apple-style, GST-ready experience.

## Stack
- **Frontend**: Expo Router (React Native, SDK 54) — SafeAreaProvider, expo-blur, expo-linear-gradient
- **Backend**: FastAPI + Motor + MongoDB
- **Auth**: JWT (bcrypt via passlib) — 7-day tokens, roles (Owner/Manager/Accountant/Sales/Warehouse)
- **Storage**: `expo-secure-store` (native), `AsyncStorage` (web)

## v1 MVP Scope (Delivered)
1. **Authentication** — email + password register/login/me, seed admin
2. **Dashboard** — hero (Today's Sales), 6 KPI grid, 7-day trend chart, quick actions, top products, recent invoices, business health score
3. **Inventory** — products with SKU, HSN, GST, category, brand, color, unit, stock, low-stock alert; search + category chips
4. **Parties** — Customers & Suppliers with contact, GSTIN, outstanding balance, tap-to-call / WhatsApp
5. **Billing (POS)** — customer selector, line items with GST & discount, payment methods (Cash/UPI/Card/Bank/Credit), sticky glass total bar
6. **Purchase** — same invoice engine (`kind=purchase`), stock incremented
7. **Expenses** — categorized daily expenses (Fuel, Rent, Salary, etc.) with modal-based entry
8. **Reports** — P&L, GST rate-wise summary (CGST/SGST), expenses by category, sales register

## Design
- Personality: **iOS-Native Clean** — Apple-style inset-grouped lists, Notion clarity
- Brand color: Deep Moss Green `#274A3D`
- Font weight cap: 500; hierarchy via size + color only
- Currency: Indian numbering (`₹1,50,000`)
- Icons: Ionicons (Phosphor-alternative shipped by default)

## API Surface (`/api/*`)
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET/POST/PUT/DELETE /products`, `GET /products/categories`
- `GET/POST/PUT/DELETE /parties?party_type=customer|supplier`
- `POST/GET /invoices`, `GET /invoices/{id}`
- `GET/POST/DELETE /expenses`
- `GET /dashboard`
- `GET /reports/gst`, `GET /reports/pnl`, `GET /reports/sales-register`
- `POST /seed` (idempotent)

## Seed Data
Admin: `admin@lotuserp.com` / `admin123` · 8 demo products (mattress, curtain, sofa fabric, carpet, cushion, bedsheet, wallpaper, pillow) · 5 parties (3 customers + 2 suppliers).

## Not in v1 (Future)
Manufacturing, Fabric roll tracking, Custom orders, Employee/Attendance, Delivery/GPS, OCR/Voice, AI advisor, Multi-branch/warehouse, Loyalty/CRM, Push notifications, Payment gateway, Multi-language, Offline sync.
