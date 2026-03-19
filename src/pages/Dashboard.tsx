import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { useTuckshopBranding } from "@/hooks/useTuckshopBranding";
import { motion, AnimatePresence } from "framer-motion";

const Dashboard = () => {
  const { branding } = useTuckshopBranding();
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-background overflow-hidden font-sans">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full content-transition">
          <div className="h-1 header-gradient flex-shrink-0" />
          <header className="h-14 flex items-center border-b px-4 md:px-6 gap-3 bg-card/50 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              {branding?.logo_url && (
                <img src={branding.logo_url} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
              )}
              <span className="font-display text-lg font-bold bg-gradient-to-r from-primary via-gold to-primary bg-clip-text text-transparent">
                {branding?.name || "Tuckshop Dashboard"}
              </span>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
