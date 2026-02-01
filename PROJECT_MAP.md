
# 🗺️ PROJECT_MAP: Mercado do Vale SaaS

## 🏛️ Base Architecture
- [x] Initial Scaffolding (React + TS + Vite-like)
- [x] Governance Standards (field-standards.ts)
- [x] Backend Integration (PocketBase SDK)
- [x] Infrastructure (Dockerfile for Cloud Run)
- [x] Modular Directory Structure
- [x] Database Schema Design (v2)
- [x] Contexts & Brain: AuthContext & ThemeEngine
- [x] Data Integrity: CurrencyInput (Integer handling) & IMEIInput (UpperTrim)
- [x] Routing & Security: ProtectedRoute & RBAC Layouts
- [x] Auth Module: LoginPage with CPF/Password (5-digit) logic
- [x] Modular Routing System (routes/index.tsx)
- [x] Atomic Layouts (layouts/AdminLayout.tsx)

## 📂 Directory Structure
- `/components/ui`: Standardized inputs and atomic visual elements
- `/hooks`: Logic hooks
- `/services`: PB and API calls
- `/core`: Business rules and "Antigravity" validations
- `/utils`: Styling (cn), standards, and masks
- `/contexts`: Global state providers
- `/pages`: View components (Auth, Dashboard, Store)
- `/routes`: Routing configuration
- `/layouts`: Global structures (Admin, Store)

## 🛠️ Tech Stack
- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Routing:** React Router 7
- **Integrity:** react-currency-input-field
- **UI:** Shadcn/ui principles (Radix), Lucide Icons
- **State:** Context API + Zustand (future)
- **Database/Auth:** PocketBase

## 📜 Revision Log
- **2026-01-30:** Initial Scaffold, PB Schema, Contexts.
- **2026-01-30:** Data Integrity components and Routing System implemented.
- **2026-01-30:** Finalized FASE 3 modularity and code organization.
- **2026-01-31:** Color Management System (types, service, selector, page, modal) following Brand pattern.
- **2026-01-31:** Storage Management System (types, service, selector, page, modal) following Brand pattern.
- **2026-01-31:** RAM Management System (types, service, selector, page, modal) following Brand pattern.
- **2026-01-31:** Version Management System (types, service, selector, page, modal) following Brand pattern.
- **2026-01-31:** Battery Health Management System (types, service, selector, page, modal) following Brand pattern.
- **2026-01-31:** Smart Dictionary System (field-dictionary, SmartInput component, FieldConfigPage, ProductForm refactoring).
