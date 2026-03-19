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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCompact } from "@/lib/utils";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { CalendarIcon, Clock, DollarSign, Users, Activity, Trophy, Medal } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const CHART_COLORS = ["hsl(153, 60%, 33%)", "hsl(210, 80%, 52%)", "hsl(38, 92%, 50%)", "hsl(270, 60%, 50%)", "hsl(0, 72%, 51%)"];
const fmk = (v: number) => formatCompact(v, "MWK");

interface PaymentMethod {
  id: string;
  name: string;
}

const SessionAnalytics = () => {
  const { tuckshopId } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionPaymentsMap, setSessionPaymentsMap] = useState<Record<string, Record<string, number>>>({});
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: subDays(new Date(), 30), to: new Date() });
  const [preset, setPreset] = useState("30d");
  const [employeeFilter, setEmployeeFilter] = useState("all");

  const setPresetRange = (key: string) => {
    setPreset(key);
    const now = new Date();
    if (key === "7d") setRange({ from: subDays(now, 7), to: now });
    else if (key === "30d") setRange({ from: subDays(now, 30), to: now });
    else if (key === "month") setRange({ from: startOfMonth(now), to: endOfMonth(now) });
    else if (key === "prev_month") setRange({ from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) });
  };

  const [paymentMethodsMap, setPaymentMethodsMap] = useState<Record<string, { name: string, method_type?: string }>>({});

  useEffect(() => {
    if (!tuckshopId) return;
    supabase.from("payment_methods").select("id, name, method_type").eq("tuckshop_id", tuckshopId).eq("is_active", true).order("created_at")
      .then(({ data }) => {
        if (data) {
          setPaymentMethods(data);
          const map: Record<string, { name: string, method_type?: string }> = {};
          data.forEach(m => { map[m.id] = { name: m.name, method_type: m.method_type }; });
          setPaymentMethodsMap(map);
        }
      });
  }, [tuckshopId]);

  const [participantsMap, setParticipantsMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!tuckshopId) return;
    setLoading(true);
    supabase.from("daily_sessions").select("*").eq("tuckshop_id", tuckshopId)
      .gte("login_time", range.from.toISOString())
      .lte("login_time", range.to.toISOString())
      .order("login_time", { ascending: false })
      .then(async ({ data }) => {
        const s = data ?? [];
        setSessions(s);
        const sessionIds = s.map(x => x.id);
        const spMap: Record<string, Record<string, number>> = {};
        const partMap: Record<string, string[]> = {};

        if (sessionIds.length > 0) {
          const [{ data: payments }, { data: parts }] = await Promise.all([
            supabase
              .from("session_payments")
              .select("session_id, payment_method_id, amount")
              .in("session_id", sessionIds),
            supabase
              .from("session_participants")
              .select("session_id, user_id")
              .in("session_id", sessionIds),
          ]);
          if (payments) {
            payments.forEach((p: any) => {
              if (!spMap[p.session_id]) spMap[p.session_id] = {};
              spMap[p.session_id][p.payment_method_id] = p.amount;
            });
          }
          if (parts) {
            parts.forEach((p: any) => {
              if (!partMap[p.session_id]) partMap[p.session_id] = [];
              if (!partMap[p.session_id].includes(p.user_id)) partMap[p.session_id].push(p.user_id);
            });
          }
        }
        setSessionPaymentsMap(spMap);
        setParticipantsMap(partMap);
        // Fetch profiles for unique employee IDs AND participant IDs
        const allUserIds = new Set(s.map(x => x.employee_id));
        Object.values(partMap).forEach(uids => uids.forEach(uid => allUserIds.add(uid)));
        const ids = [...allUserIds];
        if (ids.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
          const map: Record<string, string> = {};
          profs?.forEach(p => { map[p.id] = p.full_name || "Unknown"; });
          setProfiles(map);
        }
        setLoading(false);
      });
  }, [tuckshopId, range]);

  const getRevenue = (s: any) => {
    const sp = sessionPaymentsMap[s.id];
    if (sp && Object.keys(sp).length > 0) {
      return Object.entries(sp).reduce((sum, [methodId, v]) => {
        const m = paymentMethodsMap[methodId];
        const isExp = m?.method_type === "expenditure";
        return isExp ? sum - (v as number) : sum + (v as number);
      }, 0);
    }
    return (Number(s.airtel_money) || 0) + (Number(s.tnm_mpamba) || 0) + (Number(s.national_bank) || 0) + (Number(s.cash_at_hand) || 0);
  };

  const filtered = useMemo(() => {
    if (employeeFilter === "all") return sessions;
    return sessions.filter(s => s.employee_id === employeeFilter);
  }, [sessions, employeeFilter]);

  // Include all participants, not just session creators
  const employees = useMemo(() => {
    const ids = new Set(sessions.map(s => s.employee_id));
    Object.values(participantsMap).forEach(uids => uids.forEach(uid => ids.add(uid)));
    return [...ids];
  }, [sessions, participantsMap]);

  const kpis = useMemo(() => {
    const totalRev = filtered.reduce((s, r) => s + getRevenue(r), 0);
    const avgDuration = filtered.filter(s => s.duration_minutes).reduce((s, r) => s + r.duration_minutes, 0) / (filtered.filter(s => s.duration_minutes).length || 1);
    return {
      totalSessions: filtered.length,
      totalRevenue: totalRev,
      avgDuration: Math.round(avgDuration),
      activeEmployees: new Set(filtered.map(s => s.employee_id)).size,
    };
  }, [filtered]);

  const dailyRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(s => {
      const d = format(new Date(s.login_time), "yyyy-MM-dd");
      map[d] = (map[d] || 0) + getRevenue(s);
    });
    return Object.entries(map).sort().map(([date, revenue]) => ({ date, revenue }));
  }, [filtered]);

  const revenuePerEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(s => {
      const rev = getRevenue(s);
      const participants = participantsMap[s.id];
      if (participants && participants.length > 0) {
        // Split revenue among all participants
        const share = rev / participants.length;
        participants.forEach(uid => { map[uid] = (map[uid] || 0) + share; });
      } else {
        map[s.employee_id] = (map[s.employee_id] || 0) + rev;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([id, revenue]) => ({ name: profiles[id] || "Unknown", revenue }));
  }, [filtered, profiles, participantsMap]);

  const avgDurationPerEmployee = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filtered.filter(s => s.duration_minutes).forEach(s => {
      const participants = participantsMap[s.id];
      if (participants && participants.length > 0) {
        participants.forEach(uid => {
          if (!map[uid]) map[uid] = { total: 0, count: 0 };
          map[uid].total += s.duration_minutes;
          map[uid].count++;
        });
      } else {
        if (!map[s.employee_id]) map[s.employee_id] = { total: 0, count: 0 };
        map[s.employee_id].total += s.duration_minutes;
        map[s.employee_id].count++;
      }
    });
    return Object.entries(map).map(([id, v]) => ({ name: profiles[id] || "Unknown", avg: Math.round(v.total / v.count) }));
  }, [filtered, profiles, participantsMap]);
    return Object.entries(map).map(([id, v]) => ({ name: profiles[id] || "Unknown", avg: Math.round(v.total / v.count) }));
  }, [filtered, profiles]);

  const channelDistribution = useMemo(() => {
    const NAME_TO_COL: Record<string, string> = {
      "Airtel Money": "airtel_money", "TNM Mpamba": "tnm_mpamba",
      "National Bank": "national_bank", "Cash at Hand": "cash_at_hand", "Cash Outs": "cash_outs",
    };
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => { totals[m.name] = 0; });
    filtered.forEach(s => {
      const sp = sessionPaymentsMap[s.id];
      if (sp && Object.keys(sp).length > 0) {
        paymentMethods.forEach(m => { totals[m.name] = (totals[m.name] || 0) + (sp[m.id] || 0); });
      } else {
        // Fallback to hardcoded columns
        paymentMethods.forEach(m => {
          const col = NAME_TO_COL[m.name];
          if (col) totals[m.name] = (totals[m.name] || 0) + (s[col] || 0);
        });
      }
    });
    return Object.entries(totals).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filtered, paymentMethods, sessionPaymentsMap]);

  const performanceRanking = useMemo(() => {
    const map: Record<string, { revenue: number; sessions: number }> = {};
    filtered.forEach(s => {
      if (!map[s.employee_id]) map[s.employee_id] = { revenue: 0, sessions: 0 };
      map[s.employee_id].revenue += getRevenue(s);
      map[s.employee_id].sessions++;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([id, v], i) => ({ rank: i + 1, name: profiles[id] || "Unknown", ...v, avgPerSession: Math.round(v.revenue / v.sessions) }));
  }, [filtered, profiles]);

  const kpiCards = [
    { label: "Total Sessions", value: kpis.totalSessions.toString(), icon: Activity, className: "stat-card-green" },
    { label: "Total Revenue", value: fmk(kpis.totalRevenue), icon: DollarSign, className: "stat-card-blue" },
    { label: "Avg Duration", value: `${Math.floor(kpis.avgDuration / 60)}h ${kpis.avgDuration % 60}m`, icon: Clock, className: "stat-card-amber" },
    { label: "Active Employees", value: kpis.activeEmployees.toString(), icon: Users, className: "stat-card-purple" },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Session Analytics</h1>
            <p className="text-muted-foreground mt-1">Employee performance & session insights</p>
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

      {/* Filter */}
      <div className="flex flex-wrap gap-3">
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map(id => <SelectItem key={id} value={id}>{profiles[id] || "Unknown"}</SelectItem>)}
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
            <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Daily Revenue Trend</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <PremiumLoader message="Loading chart..." /> : dailyRevenue.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyRevenue}>
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
            <CardHeader><CardTitle className="font-display text-lg">Revenue per Employee</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <PremiumLoader message="Loading chart..." /> : revenuePerEmployee.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenuePerEmployee} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [fmk(v), "Revenue"]} />
                    <Bar dataKey="revenue" fill="hsl(210, 80%, 52%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="rounded-2xl shadow-md">
            <CardHeader><CardTitle className="font-display text-lg">Payment Channel Distribution</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <PremiumLoader message="Loading chart..." /> : channelDistribution.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {channelDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [fmk(v)]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="rounded-2xl shadow-md">
            <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-accent" /> Avg Duration per Employee</CardTitle></CardHeader>
            <CardContent className="h-72">
              {loading ? <PremiumLoader message="Loading chart..." /> : avgDurationPerEmployee.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={avgDurationPerEmployee}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} unit="m" />
                    <Tooltip formatter={(v: number) => [`${Math.floor(v / 60)}h ${v % 60}m`, "Avg Duration"]} />
                    <Bar dataKey="avg" name="Avg Duration (min)" fill="hsl(38, 92%, 50%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Employee Performance Ranking */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="rounded-2xl shadow-md">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2"><Trophy className="h-5 w-5 text-accent" /> Employee Performance Ranking</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="premium-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Avg/Session</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceRanking.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell>
                      {p.rank <= 3 ? (
                        <Medal className={cn("h-5 w-5", p.rank === 1 ? "text-yellow-500" : p.rank === 2 ? "text-gray-400" : "text-amber-700")} />
                      ) : (
                        <span className="text-muted-foreground font-mono">#{p.rank}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">{p.name}</TableCell>
                    <TableCell className="text-right font-mono">{p.sessions}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{fmk(p.revenue)}</TableCell>
                    <TableCell className="text-right font-mono">{fmk(p.avgPerSession)}</TableCell>
                  </TableRow>
                ))}
                {performanceRanking.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No session data available</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default SessionAnalytics;
