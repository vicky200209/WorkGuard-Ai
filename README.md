
# WorkGuard AI

WorkGuard AI is a role-based workforce and construction site management platform built with React, TypeScript, Supabase, and Gemini AI integration.  
The application is designed for construction companies and site operations teams to manage workers, supervisors, attendance, inspections, tasks, and real-time notifications from a centralized dashboard.

---

## Features

### Multi-Role Dashboard System
The platform supports four different user roles:

- **Admin**
  - Manage sites and staff
  - Monitor platform-wide activity
  - View audit logs
  - Send announcements and notifications
  - Access operational statistics

- **Site Manager**
  - Manage assigned construction sites
  - Track workers and supervisors
  - Manage attendance and inspections
  - Handle inventory/materials
  - Monitor task progress

- **Supervisor**
  - Assign tasks to workers
  - Track attendance
  - Submit site inspections
  - Monitor worker performance
  - Use AI-assisted inspection analysis

- **Worker**
  - View assigned tasks
  - Check attendance records
  - Receive notifications
  - View assigned work site information

---

## Tech Stack

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router DOM
- Lucide React Icons

### Backend & Services
- Supabase
  - Authentication
  - Database
  - Realtime updates

### AI Integration
- Google Gemini API (`@google/genai`)

---

## Project Structure

```bash
src/
│
├── components/        # Shared UI components
├── hooks/             # Custom React hooks
├── lib/               # External service configuration
├── pages/
│   ├── admin/
│   ├── manager/
│   ├── supervisor/
│   └── worker/
├── types/             # Shared TypeScript types
└── App.tsx            # Main application routes
```

---

## Authentication & Authorization

The application uses **Supabase Authentication** with role-based routing.

Supported roles:
- `admin`
- `site_manager`
- `supervisor`
- `worker`

Users are automatically redirected to their respective dashboards after login.

---

## Realtime Functionality

The platform supports realtime updates using Supabase subscriptions for:
- Attendance updates
- Task management
- Notifications
- Site activity
- Workforce monitoring

---

## Environment Variables

Create a `.env` file in the project root.

Example:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_google_gemini_api_key
```

---

## Installation

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd WorkGuard-Ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file and add your credentials.

### 4. Start development server

```bash
npm run dev
```

The app will run on:

```bash
http://localhost:3000
```

---

## Build for Production

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

---

## Main Dependencies

```json
{
  "@google/genai": "^1.29.0",
  "@supabase/supabase-js": "^2.106.1",
  "react": "^19.0.1",
  "react-router-dom": "^7.15.1",
  "tailwindcss": "^4.1.14",
  "vite": "^6.2.3"
}
```

---

## Key Functional Areas

### Workforce Management
- Worker onboarding
- Supervisor assignments
- Attendance tracking
- Salary references
- Role-based access control

### Site Operations
- Site creation and management
- Material inventory tracking
- Site inspection records
- Daily operational monitoring

### Task Management
- Task assignment
- Due date tracking
- Progress monitoring
- Worker-specific task distribution

### Notification System
- Broadcast notifications
- Alert priorities
- Real-time updates

### Audit & Monitoring
- Operational logs
- Activity monitoring
- Site performance tracking

---

## Future Improvements

- Mobile application support
- GPS attendance tracking
- AI-powered risk prediction
- Payroll automation
- File and image uploads
- Advanced analytics dashboard

---

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Type checking
npm run clean    # Remove build files
```

---

## License

This project is intended for educational and internal business usage.  
You may customize and extend it according to your organizational needs.

---

## Author

Developed as a modern AI-powered construction workforce management platform using React, Supabase, and AI model training.
