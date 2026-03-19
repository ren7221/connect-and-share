import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

interface PaymentMethod {
  id: string;
  name: string;
  is_active: boolean;
  method_type: string;
  created_at: string;
}

const PaymentMethods = () => {
  const { tuckshopId } = useAuth();
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<string>("revenue");

  const fetchMethods = async () => {
    if (!tuckshopId) return;
    const { data } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("tuckshop_id", tuckshopId)
      .order("created_at");
    if (data) setMethods(data as PaymentMethod[]);
  };

  useEffect(() => { fetchMethods(); }, [tuckshopId]);

  const addMethod = async () => {
    if (!tuckshopId || !newName.trim()) return;
    const { error } = await supabase.from("payment_methods").insert({
      tuckshop_id: tuckshopId,
      name: newName.trim(),
      method_type: newType,
    } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Payment method added" }); setNewName(""); setNewType("revenue"); setOpen(false); fetchMethods(); }
  };

  const toggleActive = async (method: PaymentMethod) => {
    await supabase.from("payment_methods").update({ is_active: !method.is_active }).eq("id", method.id);
    fetchMethods();
  };

  const updateMethodType = async (method: PaymentMethod, type: string) => {
    await supabase.from("payment_methods").update({ method_type: type } as any).eq("id", method.id);
    fetchMethods();
  };

  const deleteMethod = async (id: string) => {
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Payment method removed" }); fetchMethods(); }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" /> Payment Methods
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Configure payment channels for employee sessions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Method</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Add Payment Method</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="e.g. Airtel Money, Cash, etc." value={newName} onChange={(e) => setNewName(e.target.value)} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Classification</label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">💰 Revenue Source</SelectItem>
                    <SelectItem value="expenditure">📤 Expenditure Source</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {newType === "revenue" ? "Contributes positively to income totals" : "Reduces net totals (e.g. cash outs, utilities)"}
                </p>
              </div>
              <Button onClick={addMethod} className="w-full">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="premium-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-semibold">{m.name}</TableCell>
                    <TableCell>
                      <Select value={m.method_type || "revenue"} onValueChange={(v) => updateMethodType(m, v)}>
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="revenue">💰 Revenue</SelectItem>
                          <SelectItem value="expenditure">📤 Expenditure</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m)} />
                        <span className={m.is_active ? "text-primary text-xs font-medium" : "text-muted-foreground text-xs"}>{m.is_active ? "Active" : "Inactive"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => deleteMethod(m.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {methods.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No payment methods configured. Add your first one above.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default PaymentMethods;
