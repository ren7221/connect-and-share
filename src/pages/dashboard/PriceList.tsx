import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PriceItem {
  id: string;
  commodity_name: string;
  unit_price: number;
  updated_at: string;
}

const PriceList = () => {
  const { tuckshopId } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<PriceItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PriceItem | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const fetchItems = async () => {
    if (!tuckshopId) return;
    const { data } = await supabase.from("price_list").select("*").eq("tuckshop_id", tuckshopId).order("commodity_name");
    if (data) setItems(data);
  };

  useEffect(() => { fetchItems(); }, [tuckshopId]);

  const normalizeName = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  const checkDuplicate = (newName: string) => {
    const normalizedNew = normalizeName(newName);
    const duplicate = items.find(item =>
      normalizeName(item.commodity_name) === normalizedNew && item.id !== editing?.id
    );
    return duplicate ? duplicate.commodity_name : null;
  };

  const handleSave = async (force = false) => {
    if (!tuckshopId) return;

    const existingName = checkDuplicate(name);
    if (existingName && !force) {
      setDuplicateWarning(`An item with a similar name ("${existingName}") already exists. Are you sure you want to add this?`);
      return;
    }

    let error;
    if (editing) {
      ({ error } = await supabase.from("price_list").update({ commodity_name: name, unit_price: price }).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("price_list").insert({ tuckshop_id: tuckshopId, commodity_name: name, unit_price: price }));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOpen(false);
      setEditing(null);
      setName("");
      setPrice(0);
      setDuplicateWarning(null);
      fetchItems();
      toast({ title: "Success", description: `Item ${editing ? "updated" : "added"} successfully.` });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("price_list").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchItems();
      toast({ title: "Deleted", description: "Item removed from price list." });
    }
  };

  const openEdit = (item: PriceItem) => {
    setEditing(item);
    setName(item.commodity_name);
    setPrice(item.unit_price);
    setDuplicateWarning(null);
    setOpen(true);
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item =>
      item.commodity_name.toLowerCase().includes(query) ||
      normalizeName(item.commodity_name).includes(normalizeName(query))
    );
  }, [items, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Price List</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search commodities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setDuplicateWarning(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing(null); setName(""); setPrice(0); setDuplicateWarning(null); }} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Item" : "New Price Item"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Commodity Name</Label>
                  <Input id="name" value={name} onChange={(e) => { setName(e.target.value); setDuplicateWarning(null); }} placeholder="e.g. Coca-Cola 500ml" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Unit Price (MWK)</Label>
                  <Input id="price" type="number" value={price} onChange={(e) => setPrice(+e.target.value)} />
                </div>

                {duplicateWarning && (
                  <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Duplicate Warning</AlertTitle>
                    <AlertDescription>{duplicateWarning}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                {duplicateWarning ? (
                  <div className="flex gap-2 w-full">
                    <Button variant="outline" className="flex-1" onClick={() => setDuplicateWarning(null)}>Cancel</Button>
                    <Button variant="destructive" className="flex-1" onClick={() => handleSave(true)}>Add Anyway</Button>
                  </div>
                ) : (
                  <Button onClick={() => handleSave(false)} className="w-full">{editing ? "Update Item" : "Add to List"}</Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-none shadow-premium overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="premium-table">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[40%]">Commodity</TableHead>
                <TableHead className="text-right">Unit Price (MWK)</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} className="group transition-colors hover:bg-muted/30">
                  <TableCell className="font-medium">{item.commodity_name}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{item.unit_price.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(item.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(item)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                    {searchQuery ? (
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 opacity-20" />
                        <p>No commodities matching "{searchQuery}"</p>
                      </div>
                    ) : (
                      "No items in the price list yet."
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PriceList;
