import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, subDays, endOfDay } from "date-fns";
import { CalendarIcon, Download, FileText, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ReportType = "daily_sales" | "supplier_payments" | "commission" | "sessions" | "price_list" | "general";

interface PaymentMethod {
  id: string;
  name: string;
  method_type: string;
}

const Reports = () => {
  const { tuckshopId } = useAuth();
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>("daily_sales");
  const [range, setRange] = useState({ from: subDays(new Date(), 30), to: new Date() });
  const [tuckshopName, setTuckshopName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tuckshopId) return;
    supabase.from("tuckshops").select("name").eq("id", tuckshopId).maybeSingle().then(({ data }) => {
      if (data) setTuckshopName(data.name);
    });
    supabase.from("payment_methods").select("id, name, method_type").eq("tuckshop_id", tuckshopId).eq("is_active", true).order("created_at").then(({ data }) => {
      if (data) setPaymentMethods(data as PaymentMethod[]);
    });
  }, [tuckshopId]);

  const fmk = (v: number) => `MWK ${v.toLocaleString("en-US")}`;

  const fetchSessionReportData = async () => {
    if (!tuckshopId) return { sessions: [], participants: [], payments: [] };
    const { data: sessions } = await supabase.from("daily_sessions").select("*")
      .eq("tuckshop_id", tuckshopId)
      .gte("login_time", range.from.toISOString())
      .lte("login_time", endOfDay(range.to).toISOString())
      .order("login_time", { ascending: false });

    if (!sessions || sessions.length === 0) return { sessions: [], participants: [], payments: [] };
    const ids = sessions.map(s => s.id);

    const [{ data: parts }, { data: payments }, { data: profiles }] = await Promise.all([
      supabase.from("session_participants").select("*").in("session_id", ids),
      supabase.from("session_payments").select("*, payment_methods(name, method_type)").in("session_id", ids),
      (() => {
        const empIds = [...new Set(sessions.map(s => s.employee_id))];
        return supabase.from("profiles").select("id, full_name").in("id", empIds);
      })(),
    ]);

    let partProfileMap: Record<string, string> = {};
    if (parts && parts.length > 0) {
      const partUserIds = [...new Set(parts.map(p => p.user_id))];
      const { data: partProfiles } = await supabase.from("profiles").select("id, full_name").in("id", partUserIds);
      partProfiles?.forEach(p => { partProfileMap[p.id] = p.full_name || "Unknown"; });
    }

    const profileMap: Record<string, string> = {};
    profiles?.forEach(p => { profileMap[p.id] = p.full_name || "Unknown"; });

    return {
      sessions: sessions.map(s => ({ ...s, handler_name: profileMap[s.employee_id] || "Unknown" })),
      participants: (parts || []).map(p => ({ ...p, full_name: partProfileMap[p.user_id] || "Unknown" })),
      payments: payments || [],
    };
  };

  const fetchReportData = async () => {
    if (!tuckshopId) return [];
    if (reportType === "price_list") {
      const { data } = await supabase.from("price_list").select("*").eq("tuckshop_id", tuckshopId).order("commodity_name");
      return data ?? [];
    }
    if (reportType === "sessions" || reportType === "general") return [];
    const fromStr = format(range.from, "yyyy-MM-dd");
    const toStr = format(range.to, "yyyy-MM-dd");
    const { data } = await supabase.from("supplier_sales").select("*").eq("tuckshop_id", tuckshopId).gte("sale_date", fromStr).lte("sale_date", toStr).order("sale_date", { ascending: false });
    return data ?? [];
  };

  const fetchGeneralReportData = async () => {
    if (!tuckshopId) return null;
    const fromStr = format(range.from, "yyyy-MM-dd");
    const toStr = format(range.to, "yyyy-MM-dd");

    const [salesRes, sessionsRes, priceRes, employeesRes] = await Promise.all([
      supabase.from("supplier_sales").select("*").eq("tuckshop_id", tuckshopId).gte("sale_date", fromStr).lte("sale_date", toStr),
      supabase.from("daily_sessions").select("*").eq("tuckshop_id", tuckshopId).gte("login_time", range.from.toISOString()).lte("login_time", endOfDay(range.to).toISOString()),
      supabase.from("price_list").select("*").eq("tuckshop_id", tuckshopId).order("commodity_name"),
      supabase.from("employees").select("user_id").eq("tuckshop_id", tuckshopId),
    ]);

    const sales = salesRes.data ?? [];
    const sessions = sessionsRes.data ?? [];
    const prices = priceRes.data ?? [];
    const employees = employeesRes.data ?? [];

    // Fetch session payments
    let sessionPayments: any[] = [];
    if (sessions.length > 0) {
      const ids = sessions.map(s => s.id);
      const { data } = await supabase.from("session_payments").select("*, payment_methods(name, method_type)").in("session_id", ids);
      sessionPayments = data || [];
    }

    const totalRevenue = sales.reduce((sum, s: any) => sum + (s.quantity_sold * s.unit_price), 0);
    const totalCommission = totalRevenue * 0.12;
    const totalOutstanding = sales.reduce((sum, s: any) => sum + (s.quantity_supplied - s.quantity_sold), 0);
    const unpaidCount = sales.filter((s: any) => !s.is_paid).length;

    const sessionRevenue = sessionPayments.reduce((sum, p: any) => {
      const isExp = p.payment_methods?.method_type === "expenditure";
      return isExp ? sum - p.amount : sum + p.amount;
    }, 0);

    return { sales, sessions, prices, employees, sessionPayments, totalRevenue, totalCommission, totalOutstanding, unpaidCount, sessionRevenue };
  };

  const generateCSV = async () => {
    setGenerating(true);
    try {
      if (reportType === "general") {
        const data = await fetchGeneralReportData();
        if (!data) return;
        const lines = [
          `${tuckshopName} — GENERAL REPORT`,
          `Generated: ${format(new Date(), "PPpp")}`,
          `Period: ${format(range.from, "PPP")} to ${format(range.to, "PPP")}`,
          "",
          "=== SUPPLY SALES SUMMARY ===",
          `Total Revenue,${data.totalRevenue}`,
          `Total Commission (12%),${data.totalCommission}`,
          `Total Outstanding Items,${data.totalOutstanding}`,
          `Unpaid Entries,${data.unpaidCount}`,
          "",
          "=== SESSION SUMMARY ===",
          `Total Sessions,${data.sessions.length}`,
          `Net Session Revenue,${data.sessionRevenue}`,
          "",
          "=== EMPLOYEES ===",
          `Total Employees,${data.employees.length}`,
          "",
          "=== PRICE LIST ===",
          "Commodity,Unit Price",
          ...data.prices.map((p: any) => `${p.commodity_name},${p.unit_price}`),
        ];
        downloadCSV(lines.join("\n"), "general");
        return;
      }

      if (reportType === "sessions") {
        const { sessions, participants, payments } = await fetchSessionReportData();
        if (sessions.length === 0) { toast({ title: "No data for selected period", variant: "destructive" }); return; }

        const headers = ["Date", "Handler", "Login", "Logout", "Duration (min)", "Participants", ...paymentMethods.map(m => `${m.name} (${m.method_type})`), "Net Revenue", "Notes"];
        const rows = sessions.map((s: any) => {
          const sessionParts = participants.filter((p: any) => p.session_id === s.id);
          const sessionPayments = payments.filter((p: any) => p.session_id === s.id);
          const revenue = sessionPayments.reduce((sum: number, p: any) => {
            const isExp = p.payment_methods?.method_type === "expenditure";
            return isExp ? sum - p.amount : sum + p.amount;
          }, 0);
          return [
            format(new Date(s.login_time), "yyyy-MM-dd"),
            s.handler_name,
            format(new Date(s.login_time), "HH:mm"),
            s.logout_time ? format(new Date(s.logout_time), "HH:mm") : "Active",
            s.duration_minutes || "",
            sessionParts.map((p: any) => p.full_name).join("; "),
            ...paymentMethods.map(m => {
              const pay = sessionPayments.find((p: any) => p.payment_method_id === m.id);
              return pay ? pay.amount : 0;
            }),
            revenue,
            (s.session_notes || "").replace(/,/g, ";"),
          ];
        });

        const csvContent = [
          `${tuckshopName} — SESSIONS REPORT`,
          `Generated: ${format(new Date(), "PPpp")}`,
          `Period: ${format(range.from, "PPP")} to ${format(range.to, "PPP")}`,
          "",
          headers.join(","),
          ...rows.map(r => r.join(","))
        ].join("\n");

        downloadCSV(csvContent, "sessions");
        return;
      }

      const data = await fetchReportData();
      if (!data.length) { toast({ title: "No data for selected period", variant: "destructive" }); return; }

      let headers: string[] = [];
      let rows: string[][] = [];

      if (reportType === "daily_sales" || reportType === "supplier_payments") {
        headers = ["Date", "Supplier", "Commodity", "Unit Price (MWK)", "Supplied", "Sold", "Remaining", "Total Sales (MWK)", "Commission 12% (MWK)", "Status"];
        rows = data.map((r: any) => {
          const totalSales = r.quantity_sold * r.unit_price;
          return [r.sale_date, r.supplier_name, r.commodity_name, r.unit_price, r.quantity_supplied, r.quantity_sold, r.quantity_supplied - r.quantity_sold, totalSales, (totalSales * 0.12).toFixed(2), r.is_paid ? "Paid" : "Pending"];
        });
      } else if (reportType === "commission") {
        headers = ["Date", "Commodity", "Total Sales (MWK)", "Commission 12% (MWK)"];
        rows = data.map((r: any) => {
          const ts = r.quantity_sold * r.unit_price;
          return [r.sale_date, r.commodity_name, ts, (ts * 0.12).toFixed(2)];
        });
      } else {
        headers = ["Commodity", "Unit Price (MWK)"];
        rows = data.map((r: any) => [r.commodity_name, r.unit_price]);
      }

      const csvContent = [
        `${tuckshopName} — ${reportType.replace(/_/g, " ").toUpperCase()} REPORT`,
        `Generated: ${format(new Date(), "PPpp")}`,
        `Period: ${format(range.from, "PPP")} to ${format(range.to, "PPP")}`,
        "",
        headers.join(","),
        ...rows.map(r => r.join(","))
      ].join("\n");

      downloadCSV(csvContent, reportType);
    } finally {
      setGenerating(false);
    }
  };

  const downloadCSV = (content: string, type: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tuckshopName.replace(/\s+/g, "_")}_${type}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV downloaded successfully!" });
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) { toast({ title: "Please allow popups to generate PDF", variant: "destructive" }); return; }

      let tableHTML = "";

      if (reportType === "general") {
        const data = await fetchGeneralReportData();
        if (!data) { printWindow.close(); return; }

        tableHTML = `
          <h2 style="color:#1a7a4e;margin-bottom:12px;font-size:16px;">📊 Supply Sales Summary</h2>
          <table>
            <tbody>
              <tr><td style="font-weight:bold;">Total Revenue</td><td style="text-align:right;font-weight:bold;color:#1a7a4e;">${fmk(data.totalRevenue)}</td></tr>
              <tr><td style="font-weight:bold;">Commission (12%)</td><td style="text-align:right;color:#dc2626;">${fmk(data.totalCommission)}</td></tr>
              <tr><td>Net Payable to Suppliers</td><td style="text-align:right;">${fmk(data.totalRevenue - data.totalCommission)}</td></tr>
              <tr><td>Outstanding Items</td><td style="text-align:right;color:#f59e0b;">${data.totalOutstanding.toLocaleString()}</td></tr>
              <tr><td>Unpaid Entries</td><td style="text-align:right;">${data.unpaidCount}</td></tr>
              <tr><td>Total Sale Records</td><td style="text-align:right;">${data.sales.length}</td></tr>
            </tbody>
          </table>

          <h2 style="color:#1a7a4e;margin:24px 0 12px;font-size:16px;">🕐 Session Summary</h2>
          <table>
            <tbody>
              <tr><td style="font-weight:bold;">Total Sessions</td><td style="text-align:right;">${data.sessions.length}</td></tr>
              <tr><td style="font-weight:bold;">Net Session Revenue</td><td style="text-align:right;font-weight:bold;color:#1a7a4e;">${fmk(data.sessionRevenue)}</td></tr>
            </tbody>
          </table>

          <h2 style="color:#1a7a4e;margin:24px 0 12px;font-size:16px;">👥 Workforce</h2>
          <table>
            <tbody>
              <tr><td>Total Employees</td><td style="text-align:right;">${data.employees.length}</td></tr>
            </tbody>
          </table>

          <h2 style="color:#1a7a4e;margin:24px 0 12px;font-size:16px;">💰 Current Price List</h2>
          <table>
            <thead><tr><th>Commodity</th><th style="text-align:right;">Unit Price</th></tr></thead>
            <tbody>
              ${data.prices.map((p: any) => `<tr><td>${p.commodity_name}</td><td style="text-align:right;">${fmk(p.unit_price)}</td></tr>`).join("")}
            </tbody>
          </table>
        `;
      } else if (reportType === "sessions") {
        const { sessions, participants, payments } = await fetchSessionReportData();
        if (sessions.length === 0) { toast({ title: "No data for selected period", variant: "destructive" }); printWindow.close(); return; }

        let totalRevenue = 0;
        let totalExpenditure = 0;

        tableHTML = sessions.map((s: any, idx: number) => {
          const sessionParts = participants.filter((p: any) => p.session_id === s.id);
          const sessionPayments = payments.filter((p: any) => p.session_id === s.id);
          let revSum = 0, expSum = 0;
          sessionPayments.forEach((p: any) => {
            if (p.payment_methods?.method_type === "expenditure") expSum += p.amount;
            else revSum += p.amount;
          });
          totalRevenue += revSum;
          totalExpenditure += expSum;

          const partsHTML = sessionParts.map((p: any) => {
            const exitStr = p.exit_time ? ` (exited ${format(new Date(p.exit_time), "HH:mm")})` : '';
            return `${p.full_name}${exitStr}`;
          }).join(", ") || "None";

          const paymentsHeaderHTML = paymentMethods.map(m => {
            const color = m.method_type === 'expenditure' ? '#dc2626' : '#16a34a';
            return `<th style="text-align:right;padding:4px 6px;background:#f8f8f8;border-bottom:1px solid #e0e0e0;">${m.name} <span style="font-size:9px;color:${color}">(${m.method_type})</span></th>`;
          }).join("");

          const paymentsRowHTML = paymentMethods.map(m => {
            const pay = sessionPayments.find((p: any) => p.payment_method_id === m.id);
            return `<td style="text-align:right;padding:4px 6px;">${fmk(pay?.amount || 0)}</td>`;
          }).join("");

          return `
            <div class="session-block" style="margin-bottom:24px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
              <div style="background:#f0fdf4;padding:10px 14px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;">
                <div><strong>Session #${idx + 1}</strong> — ${s.handler_name}<span style="color:#666;margin-left:8px;font-size:11px;">${format(new Date(s.login_time), "PPP")}</span></div>
                <span style="font-size:11px;color:#666;">${format(new Date(s.login_time), "HH:mm")} → ${s.logout_time ? format(new Date(s.logout_time), "HH:mm") : "Active"} ${s.duration_minutes ? `(${s.duration_minutes}m)` : ""}</span>
              </div>
              <div style="padding:10px 14px;">
                <div style="margin-bottom:8px;"><strong style="font-size:11px;color:#555;">Participants:</strong><span style="font-size:11px;margin-left:4px;">${partsHTML}</span></div>
                <table style="width:100%;border-collapse:collapse;font-size:11px;">
                  <thead><tr>${paymentsHeaderHTML}<th style="text-align:right;padding:4px 6px;background:#f8f8f8;border-bottom:1px solid #e0e0e0;font-weight:bold;">Net</th></tr></thead>
                  <tbody><tr>${paymentsRowHTML}<td style="text-align:right;padding:4px 6px;font-weight:bold;color:#16a34a;">${fmk(revSum - expSum)}</td></tr></tbody>
                </table>
                ${s.session_notes ? `<div style="margin-top:8px;padding:8px;background:#fffbeb;border:1px solid #fbbf24;border-radius:4px;font-size:11px;"><strong>Notes:</strong> ${s.session_notes}</div>` : ""}
              </div>
            </div>
          `;
        }).join("");

        tableHTML += `
          <div style="margin-top:20px;padding:12px;background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;">
            <table style="width:100%;font-size:13px;">
              <tr><td style="font-weight:bold;">Total Revenue:</td><td style="text-align:right;font-weight:bold;color:#16a34a;">${fmk(totalRevenue)}</td></tr>
              <tr><td style="font-weight:bold;">Total Expenditure:</td><td style="text-align:right;font-weight:bold;color:#dc2626;">${fmk(totalExpenditure)}</td></tr>
              <tr style="border-top:2px solid #16a34a;"><td style="font-weight:bold;font-size:15px;padding-top:6px;">Net Balance:</td><td style="text-align:right;font-weight:bold;font-size:15px;padding-top:6px;color:#16a34a;">${fmk(totalRevenue - totalExpenditure)}</td></tr>
            </table>
          </div>
        `;
      } else {
        const data = await fetchReportData();
        if (!data.length) { toast({ title: "No data for selected period", variant: "destructive" }); printWindow.close(); return; }

        if (reportType === "daily_sales" || reportType === "supplier_payments" || reportType === "commission") {
          const isCommission = reportType === "commission";
          tableHTML = `<table><thead><tr>${isCommission ? "<th>Date</th><th>Commodity</th><th>Total Sales</th><th>Commission 12%</th>" : "<th>Date</th><th>Supplier</th><th>Commodity</th><th>Price</th><th>Supplied</th><th>Sold</th><th>Remaining</th><th>Total Sales</th><th>Commission</th><th>Status</th>"}</tr></thead><tbody>`;
          let totalRev = 0, totalComm = 0;
          data.forEach((r: any) => {
            const ts = r.quantity_sold * r.unit_price;
            totalRev += ts; totalComm += ts * 0.12;
            tableHTML += isCommission
              ? `<tr><td>${r.sale_date}</td><td>${r.commodity_name}</td><td>${fmk(ts)}</td><td>${fmk(ts * 0.12)}</td></tr>`
              : `<tr><td>${r.sale_date}</td><td>${r.supplier_name}</td><td>${r.commodity_name}</td><td>${fmk(r.unit_price)}</td><td>${r.quantity_supplied}</td><td>${r.quantity_sold}</td><td>${r.quantity_supplied - r.quantity_sold}</td><td>${fmk(ts)}</td><td>${fmk(ts * 0.12)}</td><td>${r.is_paid ? "✅ Paid" : "⏳ Pending"}</td></tr>`;
          });
          tableHTML += `</tbody><tfoot><tr><td colspan="${isCommission ? 2 : 7}" style="text-align:right;font-weight:bold;">TOTALS</td><td style="font-weight:bold;">${fmk(totalRev)}</td><td style="font-weight:bold;">${fmk(totalComm)}</td>${isCommission ? "" : "<td></td>"}</tr></tfoot></table>`;
        } else {
          tableHTML = `<table><thead><tr><th>Commodity</th><th>Unit Price</th></tr></thead><tbody>`;
          data.forEach((r: any) => { tableHTML += `<tr><td>${r.commodity_name}</td><td>${fmk(r.unit_price)}</td></tr>`; });
          tableHTML += `</tbody></table>`;
        }
      }

      const reportLabel = reportType === "general" ? "GENERAL BUSINESS REPORT" : reportType.replace(/_/g, " ").toUpperCase() + " REPORT";

      printWindow.document.write(`<!DOCTYPE html><html><head><title>${tuckshopName} Report</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',sans-serif;padding:40px;color:#1a1a1a}
  .header{text-align:center;margin-bottom:30px;border-bottom:3px solid #1a7a4e;padding-bottom:20px}
  .header img{width:48px;height:48px;border-radius:8px;margin-bottom:8px}
  .header h1{font-size:22px;color:#1a7a4e;margin-bottom:4px}
  .header p{font-size:12px;color:#666}
  .meta{display:flex;justify-content:space-between;margin-bottom:20px;font-size:11px;color:#555}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px}
  th{background:#1a7a4e;color:white;padding:8px 6px;text-align:left}
  td{padding:6px;border-bottom:1px solid #e0e0e0}
  tr:nth-child(even){background:#f8f8f8}
  tfoot td{border-top:2px solid #1a7a4e;background:#f0fdf4}
  .footer{margin-top:30px;padding-top:12px;border-top:1px solid #e0e0e0;text-align:center;font-size:10px;color:#999}
  @media print{body{padding:20px}}
</style></head><body>
<div class="header">
  <img src="/icon-192x192.png" alt="Logo" />
  <h1>${tuckshopName}</h1>
  <p>${reportLabel}</p>
</div>
<div class="meta">
  <span>Period: ${format(range.from, "PPP")} — ${format(range.to, "PPP")}</span>
  <span>Generated: ${format(new Date(), "PPpp")}</span>
</div>
${tableHTML}
<div class="footer">
  <p>${tuckshopName} • MUST Business Platform • Generated ${format(new Date(), "PPpp")}</p>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
      printWindow.document.close();
      toast({ title: "Report generated! Print dialog should open." });
    } finally {
      setGenerating(false);
    }
  };

  const reportTypes: { value: ReportType; label: string; desc: string }[] = [
    { value: "general", label: "General Report", desc: "Comprehensive overview of all business data for the period" },
    { value: "daily_sales", label: "Daily Sales", desc: "Full supplier sales breakdown with revenue and commissions" },
    { value: "supplier_payments", label: "Supplier Payments", desc: "Payment status overview for all suppliers" },
    { value: "commission", label: "Commission Summary", desc: "12% commission earned per commodity" },
    { value: "sessions", label: "Employee Sessions", desc: "Session logs with participants, payments, notes & reconciliation" },
    { value: "price_list", label: "Price List", desc: "Current commodity price catalogue" },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">Generate and download professional branded reports</p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-2xl shadow-md">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Report Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Report Type</label>
                <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {reportTypes.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{reportTypes.find(r => r.value === reportType)?.desc}</p>
              </div>

              {reportType !== "price_list" && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Date Range</label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left text-xs", !range.from && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1.5 h-3 w-3" />{format(range.from, "MMM d, yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={range.from} onSelect={(d) => d && setRange(r => ({ ...r, from: d }))} className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left text-xs", !range.to && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1.5 h-3 w-3" />{format(range.to, "MMM d, yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={range.to} onSelect={(d) => d && setRange(r => ({ ...r, to: d }))} className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={generateCSV} disabled={generating} className="gap-2">
                  <Download className="h-4 w-4" />{generating ? "Generating…" : "Download CSV"}
                </Button>
                <Button onClick={generatePDF} disabled={generating} variant="outline" className="gap-2">
                  <Printer className="h-4 w-4" />{generating ? "Generating…" : "Print / PDF"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <Card className="rounded-2xl shadow-md">
            <CardHeader>
              <CardTitle className="font-display text-lg">Available Reports</CardTitle>
              <CardDescription>Select a report type and date range, then download</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {reportTypes.map((r, i) => (
                  <motion.div key={r.value} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}>
                    <button
                      onClick={() => setReportType(r.value)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md",
                        reportType === r.value ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0", reportType === r.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{r.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                        </div>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div ref={printRef} className="hidden" />
    </div>
  );
};

export default Reports;
