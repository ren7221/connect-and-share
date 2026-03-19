import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Users, DollarSign, Clock, TrendingUp, Plus, FileText, ShoppingCart, CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const DashboardHome = () => {
  const { tuckshopId } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ sales: 0, employees: 0, items: 0, sessions: 0, suppliers: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!tuckshopId) return;
    setLoading(true);
    const [s, e, p, d, sup] = await Promise.all([
      supabase.from("supplier_sales").select("id", { count: "exact", head: true }).eq("tuckshop_id", tuckshopId),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("tuckshop_id", tuckshopId),
      supabase.from("price_list").select("id", { count: "exact", head: true }).eq("tuckshop_id", tuckshopId),
      supabase.from("daily_sessions").select("id", { count: "exact", head: true }).eq("tuckshop_id", tuckshopId),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("tuckshop_id", tuckshopId),
    ]);
    setStats({
      sales: s.count ?? 0,
      employees: e.count ?? 0,
      items: p.count ?? 0,
      sessions: d.count ?? 0,
      suppliers: sup.count ?? 0,
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [tuckshopId]);

  const cards = [
    { label: "Supplier Sales", value: stats.sales, icon: Package, gradient: "stat-card-green", sublabel: "Total records" },
    { label: "Employees", value: stats.employees, icon: Users, gradient: "stat-card-blue", sublabel: "Active team" },
    { label: "Price Items", value: stats.items, icon: DollarSign, gradient: "stat-card-gold", sublabel: "In catalogue" },
    { label: "Sessions", value: stats.sessions, icon: Clock, gradient: "stat-card-purple", sublabel: "Logged shifts" },
  ];

  const quickActions = [
    { label: "Add Supplier", icon: Plus, path: "/dashboard/suppliers", desc: "Register a new supplier" },
    { label: "Record Sale", icon: ShoppingCart, path: "/dashboard/sales", desc: "Log a supplier sale" },
    { label: "View Reports", icon: FileText, path: "/dashboard/reports", desc: "Generate & export reports" },
    { label: "Manage Employees", icon: Users, path: "/dashboard/employees", desc: "Team & permissions" },
  ];

  const checklist = [
    { label: "Add at least one supplier", done: stats.suppliers > 0 },
    { label: "Add items to price list", done: stats.items > 0 },
    { label: "Invite an employee", done: stats.employees > 0 },
    { label: "Record your first sale", done: stats.sales > 0 },
  ];
  const checklistProgress = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl premium-gradient p-6 md:p-10 text-primary-foreground shadow-xl shadow-primary/10"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-sm">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold opacity-90 uppercase tracking-wider">Dashboard Overview</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={fetchData}
              disabled={loading}
              className="ml-auto h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight">Welcome Back!</h1>
          <p className="mt-4 opacity-80 text-base md:text-lg max-w-2xl font-medium leading-relaxed">
            Here's a quick snapshot of your tuckshop activity. Navigate through the sidebar to manage all aspects of your business.
          </p>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="rounded-3xl border-0">
                <CardContent className="flex items-center gap-5 p-6">
                  <Skeleton className="h-14 w-14 rounded-2xl flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-2.5 w-14" />
                  </div>
                </CardContent>
              </Card>
            ))
          : cards.map((c, i) => (
              <motion.div key={c.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className={`${c.gradient} border-0 card-hover rounded-3xl overflow-hidden relative group`}>
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="flex items-center gap-5 p-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md flex-shrink-0 shadow-inner">
                      <c.icon className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold uppercase tracking-wider opacity-80 mb-1">{c.label}</p>
                      <p className="text-4xl font-black tracking-tighter">{c.value}</p>
                      <p className="text-xs font-medium opacity-60 mt-1">{c.sublabel}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      {/* Quick Actions + Getting Started */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:gap-3">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-md border border-input p-3 sm:p-4">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ))
                : quickActions.map((a) => (
                    <Button
                      key={a.label}
                      variant="outline"
                      className="h-auto flex-col items-start gap-1.5 p-3 sm:p-4 text-left min-w-0"
                      onClick={() => navigate(a.path)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <a.icon className="h-4 w-4 text-gold flex-shrink-0" />
                        <span className="font-semibold text-sm truncate">{a.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">{a.desc}</span>
                    </Button>
                  ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Getting Started Checklist */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center justify-between">
                Getting Started
                {loading ? <Skeleton className="h-4 w-16" /> : (
                  <span className="text-sm font-normal text-muted-foreground">{checklistProgress}/{checklist.length} done</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  ))
                : checklist.map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      {item.done ? (
                        <CheckCircle2 className="h-5 w-5 text-gold flex-shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />
                      )}
                      <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : "font-medium"}`}>{item.label}</span>
                    </div>
                  ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardHome;
