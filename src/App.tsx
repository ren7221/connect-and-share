import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PremiumLoader from "@/components/PremiumLoader";

// Lazy-loaded pages (Phase 4)
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const EmployeeSignup = lazy(() => import("./pages/EmployeeSignup"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Docs = lazy(() => import("./pages/Docs"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));
const SupplierSales = lazy(() => import("./pages/dashboard/SupplierSales"));
const Suppliers = lazy(() => import("./pages/dashboard/Suppliers"));
const Employees = lazy(() => import("./pages/dashboard/Employees"));
const PriceList = lazy(() => import("./pages/dashboard/PriceList"));
const Sessions = lazy(() => import("./pages/dashboard/Sessions"));
const Analytics = lazy(() => import("./pages/dashboard/Analytics"));
const Reports = lazy(() => import("./pages/dashboard/Reports"));
const PaymentMethods = lazy(() => import("./pages/dashboard/PaymentMethods"));
const SupplierSalesAnalytics = lazy(() => import("./pages/dashboard/SupplierSalesAnalytics"));
const SessionAnalytics = lazy(() => import("./pages/dashboard/SessionAnalytics"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const EmployeeSales = lazy(() => import("./pages/employee/EmployeeSales"));
const EmployeeSessions = lazy(() => import("./pages/employee/EmployeeSessions"));
const EmployeePriceList = lazy(() => import("./pages/employee/EmployeePriceList"));
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><PremiumLoader message="Loading..." /></div>}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/join" element={<EmployeeSignup />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/docs" element={<Docs />} />

              <Route path="/admin" element={<ProtectedRoute requiredRole="super_admin"><AdminDashboard /></ProtectedRoute>} />

              <Route path="/dashboard" element={<ProtectedRoute requiredRole={["tuckshop_admin", "employee"]}><Dashboard /></ProtectedRoute>}>
                <Route index element={<ProtectedRoute requiredRole="tuckshop_admin"><DashboardHome /></ProtectedRoute>} />
                <Route path="sales" element={<SupplierSales />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="employees" element={<ProtectedRoute requiredRole="tuckshop_admin"><Employees /></ProtectedRoute>} />
                <Route path="prices" element={<ProtectedRoute requiredRole="tuckshop_admin"><PriceList /></ProtectedRoute>} />
                <Route path="my-sessions" element={<EmployeeSessions />} />
                <Route path="sessions" element={<ProtectedRoute requiredRole="tuckshop_admin"><Sessions /></ProtectedRoute>} />
                <Route path="sales-analytics" element={<ProtectedRoute requiredRole="tuckshop_admin"><SupplierSalesAnalytics /></ProtectedRoute>} />
                <Route path="session-analytics" element={<ProtectedRoute requiredRole="tuckshop_admin"><SessionAnalytics /></ProtectedRoute>} />
                <Route path="analytics" element={<ProtectedRoute requiredRole="tuckshop_admin"><Analytics /></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute requiredRole="tuckshop_admin"><Reports /></ProtectedRoute>} />
                <Route path="payment-methods" element={<ProtectedRoute requiredRole="tuckshop_admin"><PaymentMethods /></ProtectedRoute>} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              <Route path="/employee" element={<ProtectedRoute requiredRole="employee"><EmployeeDashboard /></ProtectedRoute>}>
                <Route index element={<EmployeeSessions />} />
                <Route path="sessions" element={<EmployeeSessions />} />
                <Route path="sales" element={<EmployeeSales />} />
                <Route path="prices" element={<EmployeePriceList />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="payments" element={<PaymentMethods />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
