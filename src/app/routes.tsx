import { Navigate, Outlet, createBrowserRouter } from "react-router";
import { Layout } from "./layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { AddTreeData } from "./pages/AddTreeData";
import { TreeList } from "./pages/TreeList";
import { WateringCalendar } from "./pages/WateringCalendar";
import { MedicationCalendar } from "./pages/MedicationCalendar";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";
import { AdminPanel } from "./pages/AdminPanel";
import { useAuth } from "./context/AuthContext";
import { TreeProvider } from "./context/TreeContext";

const RequireAuth = () => {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <div className="min-h-screen grid place-items-center text-emerald-700">Restoring session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return <Outlet />;
};

const AuthOnly = () => {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <div className="min-h-screen grid place-items-center text-emerald-700">Restoring session...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

const ProtectedApp = () => {
  return (
    <TreeProvider>
      <Layout />
    </TreeProvider>
  );
};

const AdminOnlyPage = () => {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <div className="min-h-screen grid place-items-center text-emerald-700">Restoring session...</div>;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <AdminPanel />;
};

export const router = createBrowserRouter([
  {
    Component: AuthOnly,
    children: [
      { path: "/signin", Component: SignIn },
      { path: "/signup", Component: SignUp },
    ],
  },
  {
    Component: RequireAuth,
    children: [
      {
        path: "/",
        Component: ProtectedApp,
        children: [
          { index: true, Component: Dashboard },
          { path: "add", Component: AddTreeData },
          { path: "list", Component: TreeList },
          { path: "calendar", Component: WateringCalendar },
          { path: "medication-calendar", Component: MedicationCalendar },
          { path: "admin", Component: AdminOnlyPage },
        ],
      },
      { path: "*", Component: () => <Navigate to="/" replace /> },
    ],
  },
]);