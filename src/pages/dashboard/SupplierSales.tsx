import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { Plus, Pencil, Trash2, AlertCircle, CalendarIcon, Lock, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import SignatureCanvas from 'react-signature-canvas';

interface UnifiedGood {
  id: string;
  supplier_id: string;
  supplier_name: string;
  commodity_name: string;
  unit_price: number;
}

interface Sale {
  id: string;
  supplier_id: string | null;
  supplier_name: string;
  commodity_name: string;
  unit_price: number;
  quantity_supplied: number;
  quantity_sold: number;
  is_paid: boolean;
  outstanding_balance: number;
  sale_date: string;
  supply_time?: string;
  payment_locked?: boolean;
}

const fmt = (n: number) => `MWK ${n.toLocaleString("en-US")}`;
const fmtNum = (n: number) => n.toLocaleString("en-US");

const presets = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "All", days: -1 },
];

const SupplierSales = () => {
  const { tuckshopId, user } = useAuth();
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [goods, setGoods] = useState<UnifiedGood[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [selectedGoodId, setSelectedGoodId] = useState("");
  const [qtyBrought, setQtyBrought] = useState(0);
  const [qtySold, setQtySold] = useState(0);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [activePreset, setActivePreset] = useState("30 days");

  // Payment Confirmation State
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const sigContainerRef = useRef<HTMLDivElement | null>(null);
  const [sigWidth, setSigWidth] = useState(400);

  const fetchData = async () => {
    if (!tuckshopId) return;
    let salesQuery = supabase.from("supplier_sales").select("*").eq("tuckshop_id", tuckshopId).order("supply_time", { ascending: false });
    if (dateFrom) salesQuery = salesQuery.gte("sale_date", format(dateFrom, "yyyy-MM-dd"));
    if (dateTo) salesQuery = salesQuery.lte("sale_date", format(dateTo, "yyyy-MM-dd"));

    const [salesRes, supsRes, goodsRes] = await Promise.all([
      salesQuery,
      supabase.from("suppliers").select("id, supplier_name").eq("tuckshop_id", tuckshopId),
      supabase.from("supplier_goods").select("*").eq("tuckshop_id", tuckshopId),
    ]);

    if (salesRes.data) setSales(salesRes.data as unknown as Sale[]);

    if (supsRes.data && goodsRes.data) {
      const supsMap = new Map((supsRes.data || []).map(s => [s.id, s.supplier_name]));
      const unified: UnifiedGood[] = (goodsRes.data || []).map(g => ({
        id: g.id,
        supplier_id: g.supplier_id,
        supplier_name: supsMap.get(g.supplier_id) || "Unknown",
        commodity_name: g.commodity_name,
        unit_price: g.unit_price
      }));
      setGoods(unified.sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)));
    }
  };

  useEffect(() => { fetchData(); }, [tuckshopId, dateFrom, dateTo]);

  const applyPreset = (label: string, days: number) => {
    setActivePreset(label);
    if (days === -1) {
      setDateFrom(undefined);
      setDateTo(undefined);
    } else if (days === 0) {
      const today = new Date();
      setDateFrom(today);
      setDateTo(today);
    } else {
      setDateFrom(subDays(new Date(), days));
      setDateTo(new Date());
    }
  };

  const selectedGood = goods.find((g) => g.id === selectedGoodId);
  const totalSales = selectedGood ? qtySold * selectedGood.unit_price : 0;
  const commission = totalSales * 0.12;
  const netPayable = totalSales - commission;
  const remaining = qtyBrought - qtySold;

  const handleSave = async () => {
    if (!tuckshopId || !user || !selectedGood) return;
    if (qtyBrought <= 0) {
      toast({ title: "Invalid", description: "Quantity brought must be greater than 0", variant: "destructive" });
      return;
    }
    if (qtySold < 0 || qtySold > qtyBrought) {
      toast({ title: "Invalid", description: `Quantity sold cannot exceed quantity brought (${fmtNum(qtyBrought)})`, variant: "destructive" });
      return;
    }

    const payload = {
      supplier_id: selectedGood.supplier_id,
      supplier_name: selectedGood.supplier_name,
      commodity_name: selectedGood.commodity_name,
      unit_price: selectedGood.unit_price,
      quantity_supplied: qtyBrought,
      quantity_sold: qtySold,
      outstanding_balance: qtyBrought - qtySold,
      sale_date: saleDate,
      tuckshop_id: tuckshopId,
      created_by: user.id,
      ...(editing ? {} : { supply_time: new Date().toISOString(), payment_locked: false, is_paid: false })
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("supplier_sales").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("supplier_sales").insert(payload));
    }
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: editing ? "Sale updated" : "Sale recorded" }); closeDialog(); fetchData(); }
  };

  const handleDelete = async (id: string, isLocked: boolean) => {
    if (isLocked) {
      toast({ title: "Cannot delete", description: "This payment has been locked and confirmed.", variant: "destructive" });
      return;
    }
    await supabase.from("supplier_sales").delete().eq("id", id);
    fetchData();
  };

  const togglePaidInitiate = async (sale: Sale, checked: boolean) => {
    if (sale.payment_locked) return;
    if (checked) {
      // Open Payment Confirmation
      setPaymentSale(sale);
      setPaymentOpen(true);
      if (sigCanvas.current) {
        sigCanvas.current.clear();
      }
    } else {
      // Toggle back to unpaid
      await supabase.from("supplier_sales").update({ is_paid: false }).eq("id", sale.id);
      fetchData();
    }
  };

  const handlePaymentConfirm = async (signatureData: string | null = null) => {
    if (!paymentSale || !user || !tuckshopId) return;

    try {
      // 1. Update Sale Record
      const { error: updateError } = await supabase.from("supplier_sales").update({
        is_paid: true,
        payment_locked: true,
        signature_data: signatureData,
        payment_confirmed_by: user.id,
        payment_confirmed_at: new Date().toISOString()
      }).eq("id", paymentSale.id);

      if (updateError) throw updateError;

      // 2. Audit Log
      await supabase.from("audit_logs").insert({
        action: `Supplier Payment Confirmed ${signatureData ? '(Signed)' : '(Digital)'}`,
        table_name: 'supplier_sales',
        record_id: paymentSale.id,
        tuckshop_id: tuckshopId,
        user_id: user.id,
        new_data: {
          supplier: paymentSale.supplier_name,
          commodity: paymentSale.commodity_name,
          amount_paid: (paymentSale.quantity_sold * paymentSale.unit_price) * 0.88,
          signed: !!signatureData
        }
      });

      toast({ title: "Payment confirmed and locked." });
      setPaymentOpen(false);
      setPaymentSale(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error tracking payment", description: err.message, variant: "destructive" });
    }
  };

  const openEdit = (sale: Sale) => {
    if (sale.payment_locked) {
      toast({ title: "Locked", description: "Cannot edit a locked transaction.", variant: "destructive" });
      return;
    }
    setEditing(sale);
    // Find matching good
    const good = goods.find(g => g.supplier_id === sale.supplier_id && g.commodity_name === sale.commodity_name);
    if (good) setSelectedGoodId(good.id);
    setQtyBrought(sale.quantity_supplied);
    setQtySold(sale.quantity_sold);
    setSaleDate(sale.sale_date);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setSelectedGoodId("");
    setQtyBrought(0);
    setQtySold(0);
    setSaleDate(new Date().toISOString().split("T")[0]);
  };

  const totalOutstanding = sales.reduce((sum, s) => sum + (s.quantity_supplied - s.quantity_sold), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold font-mono">Daily Supply Sales</h1>
        <div className="flex items-center gap-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-warning-muted border border-warning/20 rounded-xl px-4 py-2 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-warning-foreground" />
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-warning-foreground/70">Total Outstanding</p>
              <p className="text-xl font-black text-warning-foreground">{totalOutstanding.toLocaleString("en-US")}</p>
            </div>
          </motion.div>
          <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto"><Plus className="h-4 w-4" />Record Delivery & Sales</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editing ? "Edit Supply" : "Record Daily Delivery & Sales"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Select Supplier & Commodity <span className="text-destructive">*</span></Label>
                  <Select value={selectedGoodId} onValueChange={setSelectedGoodId} disabled={!!editing}>
                    <SelectTrigger><SelectValue placeholder="Choose good..." /></SelectTrigger>
                    <SelectContent>
                      {goods.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          <span className="font-semibold">{g.supplier_name}</span> — {g.commodity_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedGood && (
                  <>
                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                      <span className="text-muted-foreground text-xs font-semibold block">Unit Price</span>
                      <span className="font-bold">{fmt(selectedGood.unit_price)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Qty Brought Today <span className="text-destructive">*</span></Label>
                        <Input type="number" value={qtyBrought || ""} onChange={(e) => setQtyBrought(+e.target.value)} min={0} />
                      </div>
                      <div>
                        <Label>Qty Sold Today</Label>
                        <Input type="number" value={qtySold || ""} onChange={(e) => setQtySold(+e.target.value)} min={0} max={qtyBrought} />
                        {qtySold > qtyBrought && <p className="text-destructive text-xs mt-1">Exceeds brought ({fmtNum(qtyBrought)})</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-primary/5 text-sm">
                      <div><span className="text-muted-foreground text-xs font-semibold block">Remaining</span><span className="font-bold text-warning-foreground">{fmtNum(Math.max(0, remaining))}</span></div>
                      <div><span className="text-muted-foreground text-xs font-semibold block">Total Sales</span><span className="font-bold">{fmt(totalSales)}</span></div>
                      <div><span className="text-muted-foreground text-xs font-semibold block">Commission 12%</span><span className="font-bold text-destructive">{fmt(commission)}</span></div>
                      <div><span className="text-muted-foreground text-xs font-semibold block">Net Payable</span><span className="font-bold text-primary">{fmt(netPayable)}</span></div>
                    </div>

                    <div><Label>Supply Date</Label><Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} /></div>
                    <Button onClick={handleSave} className="w-full">{editing ? "Update Supply" : "Record Supply"}</Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map(p => (
          <Button key={p.label} size="sm" variant={activePreset === p.label ? "default" : "outline"} onClick={() => applyPreset(p.label, p.days)} className="text-xs">
            {p.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("text-xs gap-1", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="h-3 w-3" />{dateFrom ? format(dateFrom, "MMM d") : "From"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d ?? undefined); setActivePreset(""); }} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("text-xs gap-1", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="h-3 w-3" />{dateTo ? format(dateTo, "MMM d") : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d ?? undefined); setActivePreset(""); }} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Desktop Table / Container */}
      <div className="responsive-table-container shadow-xl shadow-black/5 rounded-xl border bg-card overflow-hidden">
        <Table className="premium-table w-full whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>Time Supplied</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Commodity</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Brought</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Total Sales</TableHead>
              <TableHead className="text-right">Net Payable</TableHead>
              <TableHead className="text-center">Paid</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s) => {
              const ts = s.quantity_sold * s.unit_price;
              const cm = ts * 0.12;
              const np = ts - cm;
              return (
                <TableRow key={s.id} className={cn(s.payment_locked && "bg-muted/10")}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{s.sale_date}</span>
                      {s.supply_time && <span className="text-[10px] text-muted-foreground">{new Date(s.supply_time).toLocaleTimeString()}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{s.supplier_name}</TableCell>
                  <TableCell className="font-bold text-primary">{s.commodity_name}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{s.unit_price.toLocaleString("en-US")}</TableCell>
                  <TableCell className="text-right font-bold text-sm bg-primary/5">{fmtNum(s.quantity_supplied)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(s.quantity_sold)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-sm">{fmt(ts)}</TableCell>
                  <TableCell className="text-right font-bold text-primary text-sm">{fmt(np)}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={s.is_paid}
                        disabled={s.payment_locked}
                        onCheckedChange={(c) => togglePaidInitiate(s, c)}
                      />
                      {s.payment_locked && <span title="Payment Locked & Confirmed"><Lock className="h-3 w-3 text-muted-foreground" /></span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" disabled={s.payment_locked} onClick={() => openEdit(s)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" disabled={s.payment_locked} onClick={() => handleDelete(s.id, !!s.payment_locked)} className={cn(s.payment_locked ? "text-muted" : "text-destructive")}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {sales.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No supply records found for selected period.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {/* Payment Confirmation Modal */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Confirm Supplier Payment</DialogTitle>
            <DialogDescription>
              Are you sure you want to confirm receipt of payment for this supply? This action will permanently lock the transaction.
            </DialogDescription>
          </DialogHeader>

          {paymentSale && (
            <div className="space-y-4 py-3">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground block text-xs">Supplier</span><strong className="text-foreground">{paymentSale.supplier_name}</strong></div>
                <div><span className="text-muted-foreground block text-xs">Commodity</span><strong className="text-primary">{paymentSale.commodity_name}</strong></div>
                <div><span className="text-muted-foreground block text-xs">Payment Due</span><strong className="text-foreground">{fmt((paymentSale.quantity_sold * paymentSale.unit_price) * 0.88)}</strong></div>
                <div><span className="text-muted-foreground block text-xs">Date</span><strong className="text-foreground">{paymentSale.sale_date}</strong></div>
              </div>

              <div className="space-y-2">
                <Label>Supplier Signature (Optional)</Label>
                <div ref={sigContainerRef} className="border-2 border-dashed border-border rounded-lg bg-white relative overflow-hidden">
                  <SignatureCanvas
                    ref={(ref) => {
                      sigCanvas.current = ref;
                      if (sigContainerRef.current) {
                        const w = sigContainerRef.current.offsetWidth;
                        if (w > 0 && w !== sigWidth) setSigWidth(w);
                      }
                    }}
                    canvasProps={{ width: sigWidth, height: 128, className: 'cursor-crosshair', style: { width: '100%', height: '128px' } }}
                    backgroundColor="#ffffff"
                    penColor="#000000"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2 shadow-sm" onClick={() => sigCanvas.current?.clear()}>Clear</Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Sign above using finger, stylus, or mouse.</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <Button variant="outline" className="w-full sm:flex-1" onClick={() => handlePaymentConfirm("digital_confirmation_only")}>
              Digitally Confirm (No Signature)
            </Button>
            <Button
              className="w-full sm:flex-1"
              onClick={() => {
                if (sigCanvas.current?.isEmpty()) {
                  toast({ title: "Signature Missing", description: "Please sign or use digital confirm.", variant: "destructive" });
                } else {
                  handlePaymentConfirm(sigCanvas.current?.toDataURL());
                }
              }}
            >
              Confirm with Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierSales;
