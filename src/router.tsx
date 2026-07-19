import { type ReactNode, Suspense, lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/app-layout';

// Route-level code splitting: each page is its own chunk, so the initial bundle
// only loads what the landing/auth pages need. Heavy deps (charts on the
// dashboard, dnd-kit on the planner) load lazily when that route is visited.
const LandingPage = lazy(() => import('@/pages/landing-page').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('@/pages/login-page').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/register-page').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/forgot-password-page').then(m => ({ default: m.ForgotPasswordPage })));
const ShareViewPage = lazy(() => import('@/pages/share-view-page').then(m => ({ default: m.ShareViewPage })));
const BookSlotPage = lazy(() => import('@/pages/book-slot-page').then(m => ({ default: m.BookSlotPage })));
const CancelBookingPage = lazy(() => import('@/pages/cancel-booking-page').then(m => ({ default: m.CancelBookingPage })));
const RescheduleBookingPage = lazy(() => import('@/pages/reschedule-booking-page').then(m => ({ default: m.RescheduleBookingPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard-page').then(m => ({ default: m.DashboardPage })));
const TasksPage = lazy(() => import('@/pages/tasks-page').then(m => ({ default: m.TasksPage })));
const PlannerPage = lazy(() => import('@/pages/planner-page').then(m => ({ default: m.PlannerPage })));
const SettingsPage = lazy(() => import('@/pages/settings-page').then(m => ({ default: m.SettingsPage })));
const ManagerPage = lazy(() => import('@/pages/manager-page').then(m => ({ default: m.ManagerPage })));
const AdminPage = lazy(() => import('@/pages/admin-page').then(m => ({ default: m.AdminPage })));
const PriorityMatrixPage = lazy(() => import('@/pages/priority-matrix-page').then(m => ({ default: m.PriorityMatrixPage })));
const HabitsPage = lazy(() => import('@/pages/habits-page').then(m => ({ default: m.default })));
const GoalsPage = lazy(() => import('@/pages/goals-page').then(m => ({ default: m.default })));
const FocusPage = lazy(() => import('@/pages/focus-page').then(m => ({ default: m.default })));
const WeeklyReviewPage = lazy(() => import('@/pages/weekly-review-page').then(m => ({ default: m.default })));
const InsightsPage = lazy(() => import('@/pages/insights-page').then(m => ({ default: m.default })));

/** Suspense wrapper for the standalone (non-AppLayout) routes. */
function page(node: ReactNode): ReactNode {
  return (
    <Suspense fallback={<div className="grid min-h-svh place-items-center text-sm text-muted-foreground">Loading…</div>}>
      {node}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: page(<LandingPage />) },
  { path: '/login', element: page(<LoginPage />) },
  { path: '/register', element: page(<RegisterPage />) },
  { path: '/forgot-password', element: page(<ForgotPasswordPage />) },
  { path: '/u/:token', element: page(<ShareViewPage />) },
  { path: '/book/:token', element: page(<BookSlotPage />) },
  { path: '/reschedule/:token', element: page(<RescheduleBookingPage />) },
  { path: '/cancel/:token', element: page(<CancelBookingPage />) },
  {
    // AppLayout is eager (small) and provides the Suspense boundary for its
    // lazy child pages via the <Outlet/>.
    element: <AppLayout />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/tasks', element: <TasksPage /> },
      { path: '/planner', element: <PlannerPage /> },
      { path: '/habits', element: <HabitsPage /> },
      { path: '/goals', element: <GoalsPage /> },
      { path: '/focus', element: <FocusPage /> },
      { path: '/weekly-review', element: <WeeklyReviewPage /> },
      { path: '/insights', element: <InsightsPage /> },
      { path: '/priority-matrix', element: <PriorityMatrixPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/manager', element: <ManagerPage /> },
      { path: '/admin', element: <AdminPage /> },
    ],
  },
]);
