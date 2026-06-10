<div align="center">
  <h1>💪 GymFlow Desktop</h1>
  <p><strong>A modern, high-performance Desktop Gym Management System built with Electron and React.</strong></p>
  <p>Designed to provide a seamless, offline-first experience for gym owners to manage members, trainers, hardware biometric attendance, and billing.</p>
</div>

---

## ✨ Why GymFlow?

GymFlow is designed from the ground up as a native desktop application. It avoids the latency and constant internet requirements of web-based SaaS by running locally on your hardware, utilizing a robust SQLite database while maintaining a stunning, modern user interface.

Whether you are a **Gym Owner** looking for a reliable daily-driver system, or a **Developer** interested in seeing how modern web technologies (React 19, Tailwind v4, Prisma) map to desktop applications via Electron—GymFlow is built for you.

## 🚀 Real Features

Every feature listed here is actively supported in the schema and source code:

- **👥 Member Management**: Comprehensive member profiling including personal details, CNIC tracking, profile photos, and membership start/end dates.
- **🛡️ Biometric Integration**: Direct hardware integration with ZKTeco biometric devices using `node-zklib` for seamless, automated attendance tracking.
- **🏋️ Trainer Assignment**: Manage gym staff, track their specialties, and seamlessly assign trainers to specific gym members.
- **💳 Billing & Payments**: Define custom membership plans (duration, pricing) and record payments via Cash, Card, or Bank Transfer.
- **📊 Analytics & Dashboards**: Built-in interactive charts powered by Recharts for viewing attendance trends and financial data.
- **🔔 Notifications**: Ready-to-use integrations for automated SMS (via Twilio) and Email (via Nodemailer) for membership expiries and alerts.
- **🔒 Secure Authentication**: Local owner accounts protected by `bcryptjs` encryption and JWT.

## 💻 Tech Stack

This project utilizes a bleeding-edge modern web stack wrapped in Electron:

**Core**
- **Framework**: [Electron](https://www.electronjs.org/) (v42) + [React](https://react.dev/) 19
- **Build Tool**: [Vite](https://vitejs.dev/) + `tsup`
- **Language**: TypeScript

**UI & Styling**
- **Styling**: Tailwind CSS v4
- **Components**: Radix UI Primitives (Accessible, Headless UI)
- **Icons**: Lucide React
- **Data Visualization**: Recharts

**Data & State**
- **Database**: SQLite (Local, Offline-first via `dev.db`)
- **ORM**: [Prisma](https://www.prisma.io/)
- **State Management**: Zustand
- **Forms & Validation**: React Hook Form + Zod

**Hardware & External Services**
- **Biometrics**: `node-zklib`
- **Communications**: Twilio SDK & Nodemailer

## 🛠️ Getting Started (For Developers)

Follow these steps to run the application locally in development mode.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Khubaib-shah/Gym-management-system-desktop-app.git
   cd Gym-management-system-desktop-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the Database**
   The application uses a local SQLite database (`prisma/dev.db`). Ensure your Prisma schema is synced:
   ```bash
   npx prisma db push
   ```

4. **Start the Development Server**
   This command concurrently starts the Vite dev server for the React frontend, and compiles the Electron main process:
   ```bash
   npm run dev
   ```

### Building for Production

To package the application into a standalone Windows executable (`.exe`):

```bash
npm run build
```
This leverages `electron-builder` to bundle the app, Prisma engine, and SQLite database into the `release` folder.

## 📁 Project Structure

- `/electron` - Electron main process scripts and window management.
- `/src` - React frontend application (Components, Pages, Hooks).
- `/prisma` - Database schema (`schema.prisma`) and local SQLite file.
- `/dist` - Compiled frontend assets.
- `/dist-electron` - Compiled Electron backend assets.

## 🤝 Contributing

Contributions are welcome! If you're a developer looking to improve the biometric hardware integration, UI responsiveness, or payment flows, feel free to submit a Pull Request.

## 📄 License

Proprietary. All rights reserved by Khubaib Shah.
