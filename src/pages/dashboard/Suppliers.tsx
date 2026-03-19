import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Package, Truck, ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupplierGood {
  id: string;
  commodity_name: string;
  unit_price: number;
}

interface Supplier {
  id: string;
  supplier_name: string;
  created_at: string;
  goods: SupplierGood[];
}

const fmt = (n: number) => `MWK ${n.toLocaleString("en-US")}`;

const Suppliers = () => {
  const { tuckshopId, permissions, role } = useAuth();
  const { toast } = useToast();
  const canEdit = role === "tuckshop_admin" || permissions?.edit_suppliers;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Modals state
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierName, setSupplierName] = useState("");

  const [goodOpen, setGoodOpen] = useState(false);
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);
  const [editingGood, setEditingGood] = useState<SupplierGood | null>(null);
  const [goodForm, setGoodForm] = useState({ commodity_name: "", unit_price: 0 });

  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSuppliers = async () => {
    if (!tuckshopId) return;
    setLoading(true);

    // Fetch suppliers
    const { data: sups, error: supsErr } = await supabase
      .from("suppliers")
      .select("*")
      .eq("tuckshop_id", tuckshopId)
      .order("supplier_name");

    if (supsErr) {
      toast({ title: "Error", description: supsErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!sups || sups.length === 0) {
      setSuppliers([]);
      setLoading(false);
      return;
    }

    // Fetch goods
    const supplierIds = sups.map(s => s.id);
    const { data: goods } = await supabase
      .from("supplier_goods")
      .select("*")
      .in("supplier_id", supplierIds);

    const suppliersWithGoods = (sups || []).map(s => ({
      ...s,
      goods: (goods || []).filter(g => g.supplier_id === s.id).sort((a, b) => a.commodity_name.localeCompare(b.commodity_name))
    }));

    setSuppliers(suppliersWithGoods);
    setLoading(false);
  };

  const filteredSuppliers = React.useMemo(() => {
    if (!searchQuery.trim()) return suppliers;
    const query = searchQuery.toLowerCase();
    return suppliers.filter(s => s.supplier_name.toLowerCase().includes(query));
  }, [suppliers, searchQuery]);

  useEffect(() => { fetchSuppliers(); }, [tuckshopId]);

  const handleSaveSupplier = async () => {
    if (!tuckshopId) return;
    if (!supplierName.trim()) {
      toast({ title: "Validation", description: "Supplier name is required", variant: "destructive" });
      return;
    }

    let error;
    if (editingSupplier) {
      ({ error } = await supabase.from("suppliers").update({ supplier_name: supplierName }).eq("id", editingSupplier.id));
    } else {
      ({ error } = await supabase.from("suppliers").insert({ supplier_name: supplierName, tuckshop_id: tuckshopId }));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingSupplier ? "Supplier updated" : "Supplier added" });
      setSupplierOpen(false);
      setEditingSupplier(null);
      setSupplierName("");
      fetchSuppliers();
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Supplier deleted" }); fetchSuppliers(); }
  };

  const openEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierName(s.supplier_name);
    setSupplierOpen(true);
  };

  const handleSaveGood = async () => {
    if (!tuckshopId || !activeSupplier) return;
    if (!goodForm.commodity_name.trim()) {
      toast({ title: "Validation", description: "Commodity name is required", variant: "destructive" });
      return;
    }

    let error;
    if (editingGood) {
      ({ error } = await supabase.from("supplier_goods").update(goodForm).eq("id", editingGood.id));
    } else {
      ({ error } = await supabase.from("supplier_goods").insert({
        ...goodForm,
        supplier_id: activeSupplier.id,
        tuckshop_id: tuckshopId
      }));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingGood ? "Good updated" : "Good added" });
      setGoodOpen(false);
      setEditingGood(null);
      setGoodForm({ commodity_name: "", unit_price: 0 });
      fetchSuppliers();
    }
  };

  const handleDeleteGood = async (id: string) => {
    const { error } = await supabase.from("supplier_goods").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Commodity deleted" }); fetchSuppliers(); }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" /> Suppliers Data
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your suppliers and their respective goods</p>
        </motion.div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card shadow-sm border-border/50"
            />
          </div>
          <Dialog open={supplierOpen} onOpenChange={(o) => { setSupplierOpen(o); if (!o) { setEditingSupplier(null); setSupplierName(""); } }}>
            {canEdit && (
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto"><Plus className="h-4 w-4" /> Add Supplier</Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader><DialogTitle>{editingSupplier ? "Edit Supplier" : "New Supplier"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Supplier Name</Label>
                  <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="e.g. Mapeto Ltd" className="mt-1" />
                </div>
                <Button onClick={handleSaveSupplier} className="w-full">{editingSupplier ? "Update" : "Add Supplier"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Add Good Modal */}
      <Dialog open={goodOpen} onOpenChange={(o) => { setGoodOpen(o); if (!o) { setEditingGood(null); setGoodForm({ commodity_name: "", unit_price: 0 }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGood ? "Edit Commodity" : `Add Commodity for ${activeSupplier?.supplier_name}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Commodity Name</Label>
              <Input value={goodForm.commodity_name} onChange={(e) => setGoodForm({ ...goodForm, commodity_name: e.target.value })} placeholder="e.g. Sugar" className="mt-1" />
            </div>
            <div>
              <Label>Unit Price (MWK)</Label>
              <Input type="number" value={goodForm.unit_price} onChange={(e) => setGoodForm({ ...goodForm, unit_price: +e.target.value })} className="mt-1" />
            </div>
            <Button onClick={handleSaveGood} className="w-full">{editingGood ? "Update Commodity" : "Add Commodity"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 flex-1 md:hidden">
        {filteredSuppliers.map((s) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="overflow-hidden border border-border/50 shadow-sm">
              <CardHeader className="bg-muted/20 pb-3 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground">{s.supplier_name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{s.goods.length} commodities attached</p>
                  </div>
                  <div className="flex gap-1">
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditSupplier(s)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete supplier?</AlertDialogTitle><AlertDialogDescription>This will permanently remove {s.supplier_name} and all its commodities.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSupplier(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-muted/5 p-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5"><Package className="h-4 w-4" /> Commodities</h4>
                    {canEdit && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setActiveSupplier(s); setGoodOpen(true); }}>
                        <Plus className="h-3 w-3" /> Add
                      </Button>
                    )}
                  </div>
                  {s.goods.length > 0 ? (
                    <div className="space-y-2">
                      {s.goods.map(g => (
                        <div key={g.id} className="flex items-center justify-between p-2 rounded-md bg-background border text-sm">
                          <div>
                            <p className="font-medium">{g.commodity_name}</p>
                            <p className="text-xs text-muted-foreground">{fmt(g.unit_price)}</p>
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setActiveSupplier(s); setEditingGood(g); setGoodForm({ commodity_name: g.commodity_name, unit_price: g.unit_price }); setGoodOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-6 w-6"><Trash2 className="h-3 w-3 text-destructive" /></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Delete commodity?</AlertDialogTitle><AlertDialogDescription>This will remove {g.commodity_name} from {s.supplier_name}.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteGood(g.id)} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">No commodities added yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {suppliers.length === 0 && !loading && (
          <Card className="border-dashed flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Truck className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-medium">No suppliers added yet</p>
          </Card>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block shadow-xl shadow-black/5 rounded-xl border bg-card overflow-hidden">
        <Table className="premium-table w-full">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="font-bold">Supplier Name</TableHead>
              <TableHead className="font-bold">Commodities Count</TableHead>
              <TableHead className="text-right font-bold w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.map((s) => (
              <React.Fragment key={s.id}>
                <TableRow className={cn("group cursor-pointer hover:bg-muted/30 transition-colors", expandedRows.includes(s.id) && "bg-muted/20")} onClick={() => toggleRow(s.id)}>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-6 w-6 pointer-events-none">
                      {expandedRows.includes(s.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  <TableCell className="font-semibold text-base">{s.supplier_name}</TableCell>
                  <TableCell>
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary">
                      {s.goods.length} items
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => { setActiveSupplier(s); setGoodOpen(true); }} title="Add Commodity"><Plus className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openEditSupplier(s)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete supplier?</AlertDialogTitle><AlertDialogDescription>This will permanently remove {s.supplier_name} and all associated commodities.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSupplier(s.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </TableCell>
                </TableRow>
                <AnimatePresence>
                  {expandedRows.includes(s.id) && (
                    <TableRow className="bg-muted/5 hover:bg-muted/5">
                      <TableCell colSpan={4} className="p-0 border-b-2 border-border/50">
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="p-6 pl-16">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Commodities Supplied by {s.supplier_name}</h4>
                            </div>
                            {s.goods.length > 0 ? (
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {s.goods.map(g => (
                                  <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border bg-background shadow-sm hover:border-primary/30 transition-colors">
                                    <div>
                                      <p className="font-semibold text-sm">{g.commodity_name}</p>
                                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{fmt(g.unit_price)}</p>
                                    </div>
                                    {canEdit && (
                                      <div className="flex gap-0.5">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setActiveSupplier(s); setEditingGood(g); setGoodForm({ commodity_name: g.commodity_name, unit_price: g.unit_price }); setGoodOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Delete commodity?</AlertDialogTitle><AlertDialogDescription>This will remove {g.commodity_name} from {s.supplier_name}.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteGood(g.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center p-6 border border-dashed rounded-lg bg-background/50">
                                <p className="text-sm text-muted-foreground">No commodities added yet</p>
                                {canEdit && <Button variant="outline" size="sm" className="mt-3 gap-1" onClick={() => { setActiveSupplier(s); setGoodOpen(true); }}><Plus className="h-3 w-3" /> Add First Commodity</Button>}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </TableCell>
                    </TableRow>
                  )}
                </AnimatePresence>
              </React.Fragment>
            ))}
            {filteredSuppliers.length === 0 && !loading && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-16"><Truck className="h-10 w-10 mx-auto mb-4 opacity-20" /><p className="font-medium">{searchQuery ? "No matching suppliers found" : "No suppliers added yet"}</p></TableCell></TableRow>
            )}
            {loading && (
              <TableRow><TableCell colSpan={4} className="text-center py-12"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Suppliers;
