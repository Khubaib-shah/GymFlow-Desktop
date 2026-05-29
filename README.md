# GMS SaaS - Gym Management System

A modern, full-stack Gym Management Solution designed for scalability and performance. Built with Next.js 16, TypeScript, and MongoDB.

## 📋 Overview

**GMS SaaS** is a comprehensive platform for gym owners to manage their fitness centers, members, trainers, and finances. It features a multi-tenant architecture (SaaS) where a single platform can host multiple gyms, each with its own staff and members.

## 🚀 Key Features

- **Multi-Tenant Architecture**: Support for multiple gyms on a single platform.
- **Member Management**: Comprehensive profiles, membership tracking, and QR check-ins.
- **Staff Roles**: Granular permissions for Owners, Managers, Trainers, and Receptionists.
- **Workout Planning**: Create exercise templates and assign personalized workout plans to members.
- **Financial Tracking**: Record payments, track subscriptions, and monitor platform-level revenue.
- **Analytics**: Real-time dashboards with performance KPIs and revenue trends.
- **Attendance**: Automated attendance tracking with QR code support.

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Frontend**: React 19, TypeScript, Tailwind CSS 4
- **UI Components**: Radix UI, shadcn/ui
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: NextAuth.js
- **State Management**: Zustand
- **Charts**: Recharts
- **Payment Integration**: Stripe (Service ready)

## 🏗️ Getting Started

### Prerequisites

- Node.js 18.0+
- MongoDB instance (Local or Atlas)
- npm or pnpm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Khubaib-shah/GMS-saas.git
   cd GMS-saas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   MONGODB_URL=your_mongodb_connection_string
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Seed the Database**
   Populate the database with comprehensive Pakistani-localized test data:
   ```bash
   npm run seed
   ```
   *This will generate a `seed_pakistani_credentials.json` file with login details for test accounts.*

5. **Start Development**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

- `/app`: Next.js App Router (Pages & API routes)
- `/components`: Reusable UI components
- `/lib`: Services, utilities, and shared logic
- `/models`: Mongoose database schemas
- `/scripts`: CLI scripts for database management and seeding
- `/types`: Shared TypeScript definitions

## 🔧 Available Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run seed`: Cleans the database and seeds localized test data.
- `npm run lint`: Runs ESLint for code quality checks.

## 🤝 Contributing

This is a private project. For contributions, please branch from `main` and submit a Pull Request.

## 📄 License

Proprietary. All rights reserved.
