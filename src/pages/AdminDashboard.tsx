import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle, XCircle, LogOut, Store, Clock, ShieldCheck, Users, Ban, Trash2,
  Play, MessageSquare, Send, Search, Eye, Activity, CalendarClock
} from "lucide-react";

interface TuckshopRow {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  created_at: string;
  owner_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  role: string | null;
}

interface NoteRow {
  id: string;
  tuckshop_id: string;
  user_id: string;
  note: string;
  created_at: string;
  tuckshop_name?: string;
  author_name?: string;
}

interface TuckshopDetail {
  employeeCount: number;
  sessionCount: number;
  lastSessionDate: string | null;
}

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [shops, setShops] = useState<TuckshopRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<TuckshopRow | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [newNote, setNewNote] = useState("");
  const [selectedShopId, setSelectedShopId] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Search & filter state
  const [shopSearch, setShopSearch] = useState("");
  const [shopStatusFilter, setShopStatusFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");

  // Detail dialog
  const [detailShop, setDetailShop] = useState<TuckshopRow | null>(null);
  const [detailData, setDetailData] = useState<TuckshopDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Stats
  const [todaySessions, setTodaySessions] = useState(0);

  const fetchData = async () => {
    const [shopsRes, profilesRes, rolesRes] = await Promise.all([
      supabase.from("tuckshops").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (shopsRes.data) setShops(shopsRes.data as unknown as TuckshopRow[]);
    if (profilesRes.data && rolesRes.data) {
      const roleMap = new Map(rolesRes.data.map((r) => [r.user_id, r.role]));
      setUsers(profilesRes.data.map((p) => ({ ...p, role: roleMap.get(p.id) ?? null })));
    }
    setLoading(false);
  };

  const fetchTodaySessions = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("daily_sessions")
      .select("id", { count: "exact", head: true })
      .gte("login_time", today.toISOString());
    setTodaySessions(count ?? 0);
  };

  const fetchNotes = async () => {
    const { data } = await supabase
      .from("tuckshop_notes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      const tuckshopIds = [...new Set(data.map(n => n.tuckshop_id))];
      const userIds = [...new Set(data.map(n => n.user_id))];
      const [{ data: tuckshops }, { data: profiles }] = await Promise.all([
        supabase.from("tuckshops").select("id, name").in("id", tuckshopIds),
        supabase.from("profiles").select("id, full_name").in("id", userIds),
      ]);
      const shopMap: Record<string, string> = {};
      tuckshops?.forEach(t => { shopMap[t.id] = t.name; });
      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => { profileMap[p.id] = p.full_name || "Unknown"; });
      setNotes(data.map(n => ({
        ...n,
        tuckshop_name: shopMap[n.tuckshop_id] || "Unknown",
        author_name: profileMap[n.user_id] || "Unknown",
      })));
    } else {
      setNotes([]);
    }
  };

  useEffect(() => { fetchData(); fetchNotes(); fetchTodaySessions(); }, []);

  const addNote = async () => {
    if (!newNote.trim() || !selectedShopId || !user) return;
    setSubmittingNote(true);
    const { error } = await supabase.from("tuckshop_notes").insert({
      tuckshop_id: selectedShopId,
      user_id: user.id,
      note: newNote.trim(),
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Note added" });
      setNewNote("");
      fetchNotes();
    }
    setSubmittingNote(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("tuckshops").update({ status: status as any }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: `Tuckshop ${status}` }); fetchData(); }
  };

  const unsuspend = async (id: string) => {
    const { error } = await supabase.from("tuckshops").update({ status: "approved" as any }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Tuckshop unsuspended" }); fetchData(); }
  };

  const deleteTuckshop = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("tuckshops").delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Tuckshop permanently deleted" }); fetchData(); }
    setDeleteTarget(null);
  };

  const viewTuckshopDetail = async (shop: TuckshopRow) => {
    setDetailShop(shop);
    setDetailLoading(true);
    const [empRes, sessRes] = await Promise.all([
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("tuckshop_id", shop.id),
      supabase.from("daily_sessions").select("id, login_time").eq("tuckshop_id", shop.id).order("login_time", { ascending: false }).limit(1),
    ]);
    const { count: sessCount } = await supabase
      .from("daily_sessions")
      .select("id", { count: "exact", head: true })
      .eq("tuckshop_id", shop.id);

    setDetailData({
      employeeCount: empRes.count ?? 0,
      sessionCount: sessCount ?? 0,
      lastSessionDate: sessRes.data?.[0]?.login_time ?? null,
    });
    setDetailLoading(false);
  };

  const changeUserRole = async (userId: string, newRole: string) => {
    if (newRole === "none") {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { toast({ title: "Role removed" }); fetchData(); }
    } else {
      // Upsert: delete existing then insert
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { toast({ title: `Role updated to ${newRole}` }); fetchData(); }
    }
  };

  const pending = shops.filter((s) => s.status === "pending");
  const suspended = shops.filter((s) => s.status === "suspended");
  const rejected = shops.filter((s) => s.status === "rejected");

  // Filtered lists
  const filteredShops = shops.filter(s => {
    const matchesSearch = shopSearch === "" ||
      s.name.toLowerCase().includes(shopSearch.toLowerCase()) ||
      (s.profiles?.full_name || "").toLowerCase().includes(shopSearch.toLowerCase());
    const matchesStatus = shopStatusFilter === "all" || s.status === shopStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter(u => {
    return userSearch === "" ||
      (u.full_name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(userSearch.toLowerCase());
  });

  // Activity feed: recent shops sorted by date
  const recentActivity = [...shops]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-primary/10 text-primary border-primary/20">Approved</Badge>;
    if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    if (status === "suspended") return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Suspended</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  const roleBadge = (role: string | null) => {
    if (role === "super_admin") return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Super Admin</Badge>;
    if (role === "tuckshop_admin") return <Badge className="bg-primary/10 text-primary border-primary/20">Tuckshop Admin</Badge>;
    if (role === "employee") return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Employee</Badge>;
    return <Badge variant="secondary">No Role</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold">Super Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2"><LogOut className="h-4 w-4" /> Sign Out</Button>
        </div>
      </nav>

      <div className="container py-8 space-y-8">
        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Card><CardContent className="flex items-center gap-4 p-6"><Clock className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">{pending.length}</p><p className="text-sm text-muted-foreground">Pending</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-6"><CheckCircle className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{shops.filter(s => s.status === "approved").length}</p><p className="text-sm text-muted-foreground">Approved</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-6"><Ban className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">{suspended.length}</p><p className="text-sm text-muted-foreground">Suspended</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-6"><XCircle className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">{rejected.length}</p><p className="text-sm text-muted-foreground">Rejected</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-6"><Store className="h-8 w-8 text-muted-foreground" /><div><p className="text-2xl font-bold">{shops.length}</p><p className="text-sm text-muted-foreground">Total Shops</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-6"><CalendarClock className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{todaySessions}</p><p className="text-sm text-muted-foreground">Sessions Today</p></div></CardContent></Card>
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-4">
          <Card className="col-span-1"><CardContent className="flex items-center gap-4 p-6"><Users className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{users.length}</p><p className="text-sm text-muted-foreground">Total Users</p></div></CardContent></Card>

          {/* Activity Feed */}
          <Card className="col-span-1 lg:col-span-3">
            <CardHeader><CardTitle className="font-display flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Recent Activity</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {recentActivity.map(s => (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">{new Date(s.created_at).toLocaleDateString()}</span>
                    {statusBadge(s.status)}
                    <span className="font-medium truncate">{s.name}</span>
                    <span className="text-muted-foreground text-xs truncate">by {s.profiles?.full_name || "—"}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending */}
        <Card>
          <CardHeader><CardTitle className="font-display">Pending Registrations</CardTitle></CardHeader>
          <CardContent>
            {pending.length === 0 ? <p className="text-sm text-muted-foreground">No pending registrations.</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Tuckshop</TableHead><TableHead>Owner</TableHead><TableHead>Email</TableHead><TableHead>Registered</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pending.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.profiles?.full_name || "—"}</TableCell>
                        <TableCell>{s.profiles?.email || "—"}</TableCell>
                        <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end flex-col sm:flex-row">
                            <Button size="sm" onClick={() => updateStatus(s.id, "approved")} className="gap-1 text-xs"><CheckCircle className="h-3 w-3" /> Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => updateStatus(s.id, "rejected")} className="gap-1 text-xs"><XCircle className="h-3 w-3" /> Reject</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Tuckshops */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="font-display">All Tuckshops</CardTitle>
              <div className="flex gap-2 flex-col sm:flex-row">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search name/owner..." value={shopSearch} onChange={e => setShopSearch(e.target.value)} className="pl-9 h-9 w-full sm:w-[200px]" />
                </div>
                <Select value={shopStatusFilter} onValueChange={setShopStatusFilter}>
                  <SelectTrigger className="h-9 w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Tuckshop</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead>Registered</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredShops.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.profiles?.full_name || "—"}</TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end flex-col sm:flex-row">
                            <Button size="sm" variant="outline" onClick={() => viewTuckshopDetail(s)} className="gap-1 text-xs">
                              <Eye className="h-3 w-3" /> Details
                            </Button>
                            {s.status === "approved" && (
                              <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "suspended")} className="gap-1 text-xs text-orange-600 border-orange-300 hover:bg-orange-50">
                                <Ban className="h-3 w-3" /> Suspend
                              </Button>
                            )}
                            {s.status === "suspended" && (
                              <Button size="sm" variant="outline" onClick={() => unsuspend(s.id)} className="gap-1 text-xs text-primary border-primary/30 hover:bg-primary/5">
                                <Play className="h-3 w-3" /> Unsuspend
                              </Button>
                            )}
                            <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(s)} className="gap-1 text-xs">
                              <Trash2 className="h-3 w-3" /> Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredShops.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No tuckshops match your filters.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes & Reviews */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Notes & Reviews
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedShopId} onValueChange={setSelectedShopId}>
                <SelectTrigger className="sm:w-[200px]"><SelectValue placeholder="Select tuckshop" /></SelectTrigger>
                <SelectContent>
                  {shops.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Textarea placeholder="Write a note or review..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[60px] flex-1" />
              <Button onClick={addNote} disabled={!newNote.trim() || !selectedShopId || submittingNote} className="gap-2 self-end">
                <Send className="h-4 w-4" /> Add Note
              </Button>
            </div>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {notes.map(n => (
                  <div key={n.id} className="rounded-lg border p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{n.tuckshop_name}</Badge>
                        <span className="text-xs text-muted-foreground">by {n.author_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm">{n.note}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Users */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="font-display flex items-center gap-2"><Users className="h-5 w-5" />All Users</CardTitle>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search name/email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9 h-9 w-full sm:w-[220px]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Change Role</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell>{u.email || "—"}</TableCell>
                      <TableCell>{roleBadge(u.role)}</TableCell>
                      <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Select value={u.role || "none"} onValueChange={(val) => changeUserRole(u.id, val)}>
                          <SelectTrigger className="h-8 w-[150px] text-xs ml-auto"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Role</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="tuckshop_admin">Tuckshop Admin</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No users match your search.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tuckshop</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteTuckshop}>Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tuckshop Detail Dialog */}
      <Dialog open={!!detailShop} onOpenChange={(v) => !v && setDetailShop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" /> {detailShop?.name}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading details...</p>
          ) : detailData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{detailData.employeeCount}</p>
                  <p className="text-xs text-muted-foreground">Employees</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{detailData.sessionCount}</p>
                  <p className="text-xs text-muted-foreground">Total Sessions</p>
                </div>
              </div>
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm"><strong>Owner:</strong> {detailShop?.profiles?.full_name || "—"} ({detailShop?.profiles?.email || "—"})</p>
                <p className="text-sm"><strong>Status:</strong> {detailShop?.status}</p>
                <p className="text-sm"><strong>Registered:</strong> {detailShop ? new Date(detailShop.created_at).toLocaleDateString() : "—"}</p>
                <p className="text-sm"><strong>Last Session:</strong> {detailData.lastSessionDate ? new Date(detailData.lastSessionDate).toLocaleString() : "No sessions"}</p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailShop(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
