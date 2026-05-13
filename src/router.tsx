import { createBrowserRouter } from 'react-router-dom';
import { LandingPage } from '@/pages/landing-page';
import { LoginPage } from '@/pages/login-page';
import { RegisterPage } from '@/pages/register-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { PlannerPage } from '@/pages/planner-page';
import { AdminPage } from '@/pages/admin-page';
import { ManagerPage } from '@/pages/manager-page';
import { ShareViewPage } from '@/pages/share-view-page';
import { BookSlotPage } from '@/pages/book-slot-page';
import { AppLayout } from '@/components/app-layout';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/u/:token', element: <ShareViewPage /> },
  { path: '/book/:token', element: <BookSlotPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/planner', element: <PlannerPage /> },
      { path: '/manager', element: <ManagerPage /> },
      { path: '/admin', element: <AdminPage /> },
    ],
  },
]);
