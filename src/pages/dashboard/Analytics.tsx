import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { CalendarIcon, TrendingUp, DollarSign, Percent, AlertCircle, Users, BarChart3, Clock } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type DateRange = { from: Date; to: Date };

const CHART_COLORS = ["hsl(153, 60%, 33%)", "hsl(210, 80%, 52%)", "hsl(38, 92%, 50%)", "hsl(270, 60%, 50%)", "hsl(0, 72%, 51%)"];

const Analytics = () => {
  const { tuckshopId } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [preset, setPreset] = useState<string>("30d");

  const setPresetRange = (key: string) => {
    setPreset(key);
    const now = new Date();
    if (key === "7d") setRange({ from: subDays(now, 7), to: now });
    else if (key === "30d") setRange({ from: subDays(now, 30), to: now });
    else if (key === "month") setRange({ from: startOfMonth(now), to: endOfMonth(now) });
    else if (key === "prev_month") setRange({ from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) });
  };

  useEffect(() => {
    if (!tuckshopId) return;
    setLoading(true);
    const fromStr = format(range.from, "yyyy-MM-dd");
    const toStr = format(range.to, "yyyy-MM-dd");

    Promise.all([
      supabase.from("supplier_sales").select("*").eq("tuckshop_id", tuckshopId).gte("sale_date", fromStr).lte("sale_date", toStr),
      supabase.from("daily_sessions").select("*").eq("tuckshop_id", tuckshopId).gte("login_time", range.from.toISOString()).lte("login_time", range.to.toISOString()),
    ]).then(([sRes, dRes]) => {
      setSales(sRes.data ?? []);
      setSessions(dRes.data ?? []);
      setLoading(false);
    });
  }, [tuckshopId, range]);

  const kpis = useMemo(() => {
    const totalRevenue = sales.reduce((s, r) => s + r.quantity_sold * r.unit_price, 0);
    const commission = totalRevenue * 0.12;
    const outstanding = sales.filter(s => !s.is_paid).reduce((s, r) => s + r.outstanding_balance, 0);
    const uniqueEmployees = new Set(sessions.map(s => s.employee_id)).size;
    return { totalRevenue, commission, outstanding, sessions: sessions.length, employees: uniqueEmployees };
  }, [sales, sessions]);

  const dailySalesData = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach(s => {
      const d = s.sale_date;
      map[d] = (map[d] || 0) + s.quantity_sold * s.unit_price;
    });
    return Object.entries(map).sort().map(([date, revenue]) => ({ date, revenue }));
  }, [sales]);

  const topCommodities = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach(s => { map[s.commodity_name] = (map[s.commodity_name] || 0) + s.quantity_sold * s.unit_price; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, revenue]) => ({ name, revenue }));
  }, [sales]);

  const paymentStatus = useMemo(() => {
    const paid = sales.filter(s => s.is_paid).length;
    return [{ name: "Paid", value: paid }, { name: "Pending", value: sales.length - paid }];
  }, [sales]);

  const fmk = (v: number) => `MWK ${v.toLocaleString("en-US")}`;


  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-1">Track your tuckshop performance</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[["7d", "7 Days"], ["30d", "30 Days"], ["month", "This Month"], ["prev_month", "Last Month"]].map(([k, l]) => (
              <Button key={k} size="sm" variant={preset === k ? "default" : "outline"} onClick={() => setPresetRange(k)} className="text-xs">{l}</Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 text-xs">
                  <CalendarIcon className="h-3 w-3" />
                  {format(range.from, "MMM d")} – {format(range.to, "MMM d")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="range" selected={{ from: range.from, to: range.to }} onSelect={(r: any) => { if (r?.from) { setRange({ from: r.from, to: r.to || r.from }); setPreset("custom"); } }} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </motion.div>

      {/* Charts moved up as KPIs removed */}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-2xl shadow-md">
            <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Daily Sales Trend</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <Skeleton className="h-full w-full rounded-xl" /> : dailySalesData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No sales data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySalesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => format(new Date(v), "MMM d")} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [fmk(v), "Revenue"]} labelFormatter={v => format(new Date(v), "PPP")} />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(153, 60%, 33%)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Commodities */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="rounded-2xl shadow-md">
            <CardHeader><CardTitle className="font-display text-lg">Top Commodities</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <Skeleton className="h-full w-full rounded-xl" /> : topCommodities.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No commodity data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCommodities} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [fmk(v), "Revenue"]} />
                    <Bar dataKey="revenue" fill="hsl(153, 60%, 33%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Status */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="rounded-2xl shadow-md">
            <CardHeader><CardTitle className="font-display text-lg">Payment Status</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <Skeleton className="h-full w-full rounded-xl" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paymentStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Session Longevity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="rounded-2xl shadow-md">
            <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-purple-500" /> Session Longevity (min)</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <Skeleton className="h-full w-full rounded-xl" /> : sessions.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No session data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(() => {
                    const map: Record<string, number> = {};
                    sessions.forEach(s => {
                      const d = format(new Date(s.login_time), "MMM d");
                      map[d] = (map[d] || 0) + (s.duration_minutes || 0);
                    });
                    return Object.entries(map).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).map(([date, mins]) => ({ date, mins }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} unit="m" />
                    <Tooltip />
                    <Bar dataKey="mins" name="Duration" fill="hsl(270, 60%, 50%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;
