import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PremiumLoader from "@/components/PremiumLoader";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { CalendarIcon, TrendingUp, DollarSign, Percent, Package, Trophy } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const CHART_COLORS = ["hsl(153, 60%, 33%)", "hsl(210, 80%, 52%)", "hsl(38, 92%, 50%)", "hsl(270, 60%, 50%)", "hsl(0, 72%, 51%)", "hsl(180, 60%, 40%)"];
const fmk = (v: number) => `MWK ${v.toLocaleString("en-US")}`;

const SupplierSalesAnalytics = () => {
  const { tuckshopId } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: subDays(new Date(), 30), to: new Date() });
  const [preset, setPreset] = useState("30d");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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
    supabase.from("supplier_sales").select("*").eq("tuckshop_id", tuckshopId)
      .gte("sale_date", format(range.from, "yyyy-MM-dd"))
      .lte("sale_date", format(range.to, "yyyy-MM-dd"))
      .then(({ data }) => { setSales(data ?? []); setLoading(false); });
  }, [tuckshopId, range]);

  const filtered = useMemo(() => {
    let d = sales;
    if (supplierFilter !== "all") d = d.filter(s => s.supplier_name === supplierFilter);
    if (statusFilter === "paid") d = d.filter(s => s.is_paid);
    else if (statusFilter === "pending") d = d.filter(s => !s.is_paid);
    return d;
  }, [sales, supplierFilter, statusFilter]);

  const suppliers = useMemo(() => [...new Set(sales.map(s => s.supplier_name))], [sales]);

  const kpis = useMemo(() => {
    const totalRevenue = filtered.reduce((s, r) => s + r.quantity_sold * r.unit_price, 0);
    const commission = totalRevenue * 0.12;
    const outstanding = filtered.filter(s => !s.is_paid).reduce((s, r) => s + (r.quantity_supplied - r.quantity_sold) * r.unit_price, 0);
    const supplierRevMap: Record<string, number> = {};
    filtered.forEach(s => { supplierRevMap[s.supplier_name] = (supplierRevMap[s.supplier_name] || 0) + s.quantity_sold * s.unit_price; });
    const topSupplier = Object.entries(supplierRevMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    return { totalRevenue, commission, outstanding, topSupplier };
  }, [filtered]);

  const dailyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(s => { map[s.sale_date] = (map[s.sale_date] || 0) + s.quantity_sold * s.unit_price; });
    return Object.entries(map).sort().map(([date, revenue]) => ({ date, revenue }));
  }, [filtered]);

  const revenueBySupplier = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(s => { map[s.supplier_name] = (map[s.supplier_name] || 0) + s.quantity_sold * s.unit_price; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, revenue]) => ({ name, revenue }));
  }, [filtered]);

  const paymentStatus = useMemo(() => {
    const paid = filtered.filter(s => s.is_paid).length;
    return [{ name: "Paid", value: paid }, { name: "Pending", value: filtered.length - paid }];
  }, [filtered]);

  const topCommodities = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(s => { map[s.commodity_name] = (map[s.commodity_name] || 0) + s.quantity_sold; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, qty]) => ({ name, qty }));
  }, [filtered]);

  const kpiCards = [
    { label: "Total Revenue", value: fmk(kpis.totalRevenue), icon: DollarSign, className: "stat-card-green" },
    { label: "Commission Earned", value: fmk(kpis.commission), icon: Percent, className: "stat-card-blue" },
    { label: "Outstanding Value", value: fmk(kpis.outstanding), icon: Package, className: "stat-card-amber" },
    { label: "Top Supplier", value: kpis.topSupplier, icon: Trophy, className: "stat-card-purple" },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Sales Analytics</h1>
            <p className="text-muted-foreground mt-1">Supplier sales performance & insights</p>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Suppliers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={cn("rounded-2xl border-0", kpi.className)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{kpi.label}</p>
                    <p className="text-2xl font-black mt-1">{loading ? "..." : kpi.value}</p>
                  </div>
                  <kpi.icon className="h-8 w-8 opacity-30" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-2xl shadow-md">
            <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Daily Sales Trend</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <PremiumLoader message="Loading chart..." /> : dailyTrend.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrend}>
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

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="rounded-2xl shadow-md">
            <CardHeader><CardTitle className="font-display text-lg">Revenue by Supplier</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <PremiumLoader message="Loading chart..." /> : revenueBySupplier.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueBySupplier} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [fmk(v), "Revenue"]} />
                    <Bar dataKey="revenue" fill="hsl(153, 60%, 33%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="rounded-2xl shadow-md">
            <CardHeader><CardTitle className="font-display text-lg">Payment Status</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <PremiumLoader message="Loading chart..." /> : (
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

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="rounded-2xl shadow-md">
            <CardHeader><CardTitle className="font-display text-lg">Top Commodities (Qty Sold)</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <PremiumLoader message="Loading chart..." /> : topCommodities.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCommodities}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="qty" name="Qty Sold" fill="hsl(210, 80%, 52%)" radius={[6, 6, 0, 0]} />
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

export default SupplierSalesAnalytics;
