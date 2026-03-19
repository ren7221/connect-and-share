import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Users, XCircle, Play, FileText, LogIn, Trash2, StickyNote, LogOut, Pencil, Star } from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { cn, formatCompact } from "@/lib/utils";
import PremiumLoader from "@/components/PremiumLoader";

interface PaymentMethod {
  id: string;
  name: string;
  method_type?: string;
}

interface SessionPayment {
  payment_method_id: string;
  amount: number;
  payment_methods: { name: string; method_type?: string } | null;
}

interface Participant {
  id: string;
  user_id: string;
  join_time: string;
  exit_time: string | null;
  exit_notes?: string | null;
  profile?: { full_name: string | null };
}

interface Employee {
  id: string;
  user_id: string | null;
  full_name: string;
}

interface Session {
  id: string;
  employee_id: string;
  tuckshop_id: string;
  login_time: string;
  logout_time: string | null;
  duration_minutes: number | null;
  airtel_money: number;
  tnm_mpamba: number;
  national_bank: number;
  cash_at_hand: number;
  cash_outs: number;
  session_notes?: string | null;
  created_at: string;
  session_payments?: SessionPayment[];
  participants?: Participant[];
}

const NAME_TO_COLUMN: Record<string, string> = {
  "Airtel Money": "airtel_money",
  "TNM Mpamba": "tnm_mpamba",
  "National Bank": "national_bank",
  "Cash at Hand": "cash_at_hand",
  "Cash Outs": "cash_outs",
};

type DatePreset = "today" | "yesterday" | "7days" | "all";

const Sessions = () => {
  const { user, tuckshopId, role, isOwner } = useAuth();
  const isAdmin = role === "tuckshop_admin" || role === "super_admin";
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<Date | undefined>(new Date());
  const [activePreset, setActivePreset] = useState<DatePreset>("today");

  // Notes tab filters
  const [notesEmployeeFilter, setNotesEmployeeFilter] = useState("all");
  const [notesDateFilter, setNotesDateFilter] = useState<Date | undefined>(undefined);

  // Start session state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [activeSessionData, setActiveSessionData] = useState<Session | null>(null);
  const [activeParticipants, setActiveParticipants] = useState<Participant[]>([]);
  const [form, setForm] = useState<Record<string, number>>({});
  const [sessionNotes, setSessionNotes] = useState("");

  // Edit session state
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState<Record<string, number>>({});
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Exit notes dialog
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exitNoteText, setExitNoteText] = useState("");

  const applyPreset = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset === "today") setFilterDate(new Date());
    else if (preset === "yesterday") setFilterDate(subDays(new Date(), 1));
    else if (preset === "7days") setFilterDate(subDays(new Date(), 6));
    else setFilterDate(undefined);
  };

  const fetchEmployees = useCallback(async () => {
    if (!tuckshopId) return;

    // Get tuckshop owner_id
    const { data: shop } = await supabase
      .from("tuckshops")
      .select("owner_id")
      .eq("id", tuckshopId)
      .maybeSingle();
    const ownerId = shop?.owner_id;

    const { data } = await supabase
      .from("employees")
      .select("id, user_id")
      .eq("tuckshop_id", tuckshopId)
      .not("user_id", "is", null);

    if (data && data.length > 0) {
      const userIds = data.map(e => e.user_id!);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const nameMap: Record<string, string> = {};
      profiles?.forEach(p => { nameMap[p.id] = p.full_name || "Unknown"; });

      // Owner can add everyone (including other admins) except self
      // Non-owner admins can add everyone except the owner and self
      setEmployees(
        data
          .filter(e => {
            if (e.user_id === user?.id) return false; // exclude self
            if (!isOwner && e.user_id === ownerId) return false; // non-owner can't add owner
            return true;
          })
          .map(e => ({
            id: e.id,
            user_id: e.user_id,
            full_name: nameMap[e.user_id!] || "Unknown",
          }))
      );
    }
  }, [tuckshopId, user?.id, isOwner]);

  const checkActiveSession = useCallback(async () => {
    if (!tuckshopId) return;

    const { data: sessionId } = await supabase.rpc("get_active_tuckshop_session", {
      _tuckshop_id: tuckshopId,
    });

    if (sessionId) {
      const { data: sessionData } = await supabase
        .from("daily_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionData) setActiveSessionData(sessionData as Session);

      const { data: parts } = await supabase
        .from("session_participants")
        .select("*")
        .eq("session_id", sessionId)
        .order("join_time");

      if (parts && parts.length > 0) {
        const userIds = parts.map(p => p.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        const profileMap: Record<string, string> = {};
        profiles?.forEach(p => { profileMap[p.id] = p.full_name || "Unknown"; });

        setActiveParticipants(parts.map(p => ({
          ...p,
          profile: { full_name: profileMap[p.user_id] || "Unknown" },
        })) as Participant[]);
      } else {
        setActiveParticipants([]);
      }
    } else {
      setActiveSessionData(null);
      setActiveParticipants([]);
    }
  }, [tuckshopId]);

  useEffect(() => {
    if (!tuckshopId) return;
    supabase.from("payment_methods").select("id, name, method_type").eq("tuckshop_id", tuckshopId).eq("is_active", true).order("created_at")
      .then(({ data }) => {
        if (data) {
          setPaymentMethods(data as PaymentMethod[]);
          const initial: Record<string, number> = {};
          data.forEach(m => { initial[m.id] = 0; });
          setForm(initial);
        }
      });
  }, [tuckshopId]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { checkActiveSession(); }, [checkActiveSession]);

  const fetchSessions = useCallback(async () => {
    if (!tuckshopId) return;
    setLoading(true);

    let query = supabase
      .from("daily_sessions")
      .select("*")
      .eq("tuckshop_id", tuckshopId)
      .order("login_time", { ascending: false });

    if (filterDate && activePreset !== "all") {
      if (activePreset === "7days") {
        query = query.gte("login_time", startOfDay(subDays(new Date(), 6)).toISOString());
      } else {
        query = query
          .gte("login_time", startOfDay(filterDate).toISOString())
          .lte("login_time", endOfDay(filterDate).toISOString());
      }
    }

    const { data } = await query;
    if (!data) { setLoading(false); return; }

    const employeeIds = [...new Set(data.map(s => s.employee_id))];
    let pMap: Record<string, string> = {};
    if (employeeIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", employeeIds);
      if (profiles) profiles.forEach(p => { pMap[p.id] = p.full_name || "Unknown"; });
    }
    setProfilesMap(pMap);

    const ids = data.map(s => s.id);
    let paymentsMap: Record<string, SessionPayment[]> = {};
    if (ids.length > 0) {
      const { data: payments } = await supabase
        .from("session_payments")
        .select("session_id, payment_method_id, amount, payment_methods(name, method_type)")
        .in("session_id", ids);
      if (payments) {
        payments.forEach((p: any) => {
          if (!paymentsMap[p.session_id]) paymentsMap[p.session_id] = [];
          paymentsMap[p.session_id].push(p);
        });
      }
    }

    let participantsMap: Record<string, Participant[]> = {};
    if (ids.length > 0) {
      const { data: allParts } = await supabase
        .from("session_participants")
        .select("*")
        .in("session_id", ids);
      if (allParts) {
        const allUserIds = [...new Set(allParts.map(p => p.user_id))];
        const { data: partProfiles } = await supabase.from("profiles").select("id, full_name").in("id", allUserIds);
        const partNameMap: Record<string, string> = {};
        partProfiles?.forEach(p => { partNameMap[p.id] = p.full_name || "Unknown"; });

        allParts.forEach((p: any) => {
          if (!participantsMap[p.session_id]) participantsMap[p.session_id] = [];
          participantsMap[p.session_id].push({
            ...p,
            profile: { full_name: partNameMap[p.user_id] || "Unknown" },
          });
        });
      }
    }

    setSessions(data.map(s => ({
      ...s,
      session_payments: paymentsMap[s.id] || [],
      participants: participantsMap[s.id] || [],
    })) as Session[]);
    setLoading(false);
  }, [tuckshopId, filterDate, activePreset]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const getRevenue = (s: Session) => {
    if (s.session_payments && s.session_payments.length > 0) {
      return s.session_payments.reduce((sum, p) => {
        const isExpenditure = p.payment_methods?.method_type === "expenditure";
        return isExpenditure ? sum - p.amount : sum + p.amount;
      }, 0);
    }
    return (s.airtel_money || 0) + (s.tnm_mpamba || 0) + (s.national_bank || 0) + (s.cash_at_hand || 0);
  };

  const getPaymentAmount = (s: Session, methodId: string) => {
    if (s.session_payments && s.session_payments.length > 0) {
      const p = s.session_payments.find(sp => sp.payment_method_id === methodId);
      return p ? p.amount : 0;
    }
    const method = paymentMethods.find(m => m.id === methodId);
    if (method) {
      const col = NAME_TO_COLUMN[method.name];
      if (col && col in s) return (s as any)[col] || 0;
    }
    return 0;
  };

  const startSession = async () => {
    if (!user || !tuckshopId) return;

    const { data: existingId } = await supabase.rpc("get_active_tuckshop_session", {
      _tuckshop_id: tuckshopId,
    });
    if (existingId) {
      toast({ title: "Active session already exists", variant: "destructive" });
      checkActiveSession();
      return;
    }

    const { data: newSession, error } = await supabase.from("daily_sessions").insert({
      employee_id: user.id,
      tuckshop_id: tuckshopId,
    }).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    if (newSession) {
      const participantInserts = [
        { session_id: newSession.id, user_id: user.id, tuckshop_id: tuckshopId },
        ...selectedEmployees
          .filter(uid => uid !== user.id)
          .map(uid => ({ session_id: newSession.id, user_id: uid, tuckshop_id: tuckshopId })),
      ];
      await supabase.from("session_participants").insert(participantInserts);
    }

    toast({ title: "Session started" });
    setSelectedEmployees([]);
    checkActiveSession();
    fetchSessions();
  };

  const closeSession = async () => {
    if (!user || !tuckshopId || !activeSessionData) return;
    const logoutTime = new Date().toISOString();
    const loginTime = new Date(activeSessionData.login_time);
    const duration = Math.round((new Date(logoutTime).getTime() - loginTime.getTime()) / 60000);

    const columnUpdates: Record<string, number> = {};
    paymentMethods.forEach(m => {
      const col = NAME_TO_COLUMN[m.name];
      if (col) columnUpdates[col] = form[m.id] || 0;
    });

    const { error } = await supabase.from("daily_sessions").update({
      ...columnUpdates,
      logout_time: logoutTime,
      duration_minutes: duration,
      session_notes: sessionNotes.trim() || null,
    } as any).eq("id", activeSessionData.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const paymentRows = paymentMethods.map(m => ({
      session_id: activeSessionData.id,
      payment_method_id: m.id,
      amount: form[m.id] || 0,
    }));
    await supabase.from("session_payments").insert(paymentRows);

    await supabase
      .from("session_participants")
      .update({ exit_time: logoutTime })
      .eq("session_id", activeSessionData.id)
      .is("exit_time", null);

    toast({ title: "Session closed" });
    const reset: Record<string, number> = {};
    paymentMethods.forEach(m => { reset[m.id] = 0; });
    setForm(reset);
    setSessionNotes("");
    setActiveSessionData(null);
    setActiveParticipants([]);
    fetchSessions();
  };

  const joinSession = async () => {
    if (!user || !tuckshopId || !activeSessionData) return;

    const { data: existing } = await supabase
      .from("session_participants")
      .select("id")
      .eq("session_id", activeSessionData.id)
      .eq("user_id", user.id)
      .is("exit_time", null)
      .maybeSingle();

    if (existing) {
      toast({ title: "Already participating", description: "You are already in this session." });
      checkActiveSession();
      return;
    }

    const { error } = await supabase.from("session_participants").insert({
      session_id: activeSessionData.id,
      user_id: user.id,
      tuckshop_id: tuckshopId,
    });
    if (error) {
      toast({ title: "Error joining session", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Joined session" });
      checkActiveSession();
    }
  };

  const isParticipating = activeParticipants.some(p => p.user_id === user?.id && !p.exit_time);
  const activeParticipantCount = activeParticipants.filter(p => !p.exit_time).length;

  // Control transfer: earliest active joiner (by join_time) is the controller
  const sortedActiveParticipants = [...activeParticipants]
    .filter(p => !p.exit_time)
    .sort((a, b) => new Date(a.join_time).getTime() - new Date(b.join_time).getTime());
  const currentControllerId = sortedActiveParticipants[0]?.user_id;
  const canControlSession = isParticipating && currentControllerId === user?.id;

  const exitSessionAdmin = async (noteText?: string) => {
    if (!user || !activeSessionData) return;
    const { data: myPart } = await supabase
      .from("session_participants")
      .select("id")
      .eq("session_id", activeSessionData.id)
      .eq("user_id", user.id)
      .is("exit_time", null)
      .maybeSingle();
    if (myPart) {
      await supabase.from("session_participants").update({
        exit_time: new Date().toISOString(),
        exit_notes: noteText?.trim() || null,
      } as any).eq("id", myPart.id);
      toast({ title: "You have exited the session" });
      setExitNoteText("");
      setShowExitDialog(false);
      checkActiveSession();
    } else {
      toast({ title: "You are not currently in this session", variant: "destructive" });
    }
  };

  const toggleEmployee = (userId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleDeleteSession = async (session: Session) => {
    if (!user || (!isAdmin)) return;

    try {
      await supabase.from("audit_logs").insert({
        action: "Deleted Session",
        table_name: "daily_sessions",
        record_id: session.id,
        tuckshop_id: session.tuckshop_id,
        user_id: user.id,
        new_data: {
          deleted_session_login: session.login_time,
          handler_id: session.employee_id
        }
      });

      const { error } = await supabase.from("daily_sessions").delete().eq("id", session.id);
      if (error) throw error;

      toast({ title: "Session deleted securely" });
      fetchSessions();
      if (activeSessionData && activeSessionData.id === session.id) {
        checkActiveSession();
      }
    } catch (err: any) {
      toast({ title: "Deletion failed", description: err.message, variant: "destructive" });
    }
  };

  const openEditSession = (session: Session) => {
    const editAmounts: Record<string, number> = {};
    paymentMethods.forEach(m => {
      editAmounts[m.id] = getPaymentAmount(session, m.id);
    });
    setEditForm(editAmounts);
    setEditNotes(session.session_notes || "");
    setEditingSession(session);
  };

  const handleEditSession = async () => {
    if (!user || !editingSession || !tuckshopId) return;
    setEditSaving(true);
    try {
      // Delete old session_payments
      await supabase.from("session_payments").delete().eq("session_id", editingSession.id);

      // Insert new session_payments
      const paymentRows = paymentMethods.map(m => ({
        session_id: editingSession.id,
        payment_method_id: m.id,
        amount: editForm[m.id] || 0,
      }));
      await supabase.from("session_payments").insert(paymentRows);

      // Update legacy columns + notes
      const columnUpdates: Record<string, any> = {};
      paymentMethods.forEach(m => {
        const NAME_TO_COLUMN: Record<string, string> = {
          "Airtel Money": "airtel_money", "TNM Mpamba": "tnm_mpamba",
          "National Bank": "national_bank", "Cash at Hand": "cash_at_hand", "Cash Outs": "cash_outs",
        };
        const col = NAME_TO_COLUMN[m.name];
        if (col) columnUpdates[col] = editForm[m.id] || 0;
      });
      columnUpdates.session_notes = editNotes.trim() || null;

      await supabase.from("daily_sessions").update(columnUpdates as any).eq("id", editingSession.id);

      // Audit log
      await supabase.from("audit_logs").insert([{
        action: "Edited Session",
        table_name: "daily_sessions",
        record_id: editingSession.id,
        tuckshop_id: tuckshopId,
        user_id: user.id,
        old_data: { session_payments: editingSession.session_payments, session_notes: editingSession.session_notes } as any,
        new_data: { editForm, session_notes: editNotes.trim() || null } as any,
      }]);

      toast({ title: "Session updated" });
      setEditingSession(null);
      fetchSessions();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };
  const sessionsWithNotes = useMemo(() => {
    return sessions.filter(s => {
      if (!s.session_notes) return false;
      if (notesEmployeeFilter !== "all" && s.employee_id !== notesEmployeeFilter) return false;
      if (notesDateFilter) {
        const sDate = new Date(s.login_time);
        if (sDate < startOfDay(notesDateFilter) || sDate > endOfDay(notesDateFilter)) return false;
      }
      return true;
    });
  }, [sessions, notesEmployeeFilter, notesDateFilter]);

  const uniqueEmployeeIds = useMemo(() => [...new Set(sessions.map(s => s.employee_id))], [sessions]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Daily Sessions</h1>

      {/* Start / Active Session Card - keep existing */}
      <Card className="gold-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {activeSessionData ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                </span>
                Active Session
              </>
            ) : (
              "Start New Session"
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Exit Notes Dialog */}
          <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> Exit Session
                </DialogTitle>
                <DialogDescription>
                  You are about to exit the session. Leave an optional note explaining why you're leaving.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <StickyNote className="h-3.5 w-3.5" /> Exit Note (optional)
                </Label>
                <Textarea
                  placeholder="e.g. Shift change, went home early, incident..."
                  value={exitNoteText}
                  onChange={(e) => setExitNoteText(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowExitDialog(false); setExitNoteText(""); }}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => exitSessionAdmin(exitNoteText)} className="gap-2">
                  <LogOut className="h-4 w-4" /> Confirm Exit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Session Dialog */}
          <Dialog open={!!editingSession} onOpenChange={(open) => !open && setEditingSession(null)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" /> Edit Session Figures
                </DialogTitle>
                <DialogDescription>
                  Update the financial figures for this session. Changes will be logged for audit.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {paymentMethods.map(m => (
                    <div key={m.id}>
                      <Label className="flex items-center gap-1">
                        {m.name}
                        {m.method_type === "expenditure" && (
                          <span className="text-[10px] text-destructive font-normal">(expense)</span>
                        )}
                      </Label>
                      <Input
                        type="number"
                        value={editForm[m.id] || 0}
                        onChange={(e) => setEditForm({ ...editForm, [m.id]: +e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> Session Notes
                  </Label>
                  <Textarea
                    placeholder="Session notes..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="mt-1.5 min-h-[60px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingSession(null)}>Cancel</Button>
                <Button onClick={handleEditSession} disabled={editSaving}>
                  {editSaving ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {!activeSessionData ? (
            <div className="space-y-4">
              {employees.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> Select collaborators (optional)
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {employees.map(e => (
                      <label
                        key={e.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                          selectedEmployees.includes(e.user_id!)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <Checkbox
                          checked={selectedEmployees.includes(e.user_id!)}
                          onCheckedChange={() => toggleEmployee(e.user_id!)}
                        />
                        <span className="text-sm font-medium">{e.full_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <Button size="lg" onClick={startSession} className="gap-2 px-8 font-bold bg-gradient-to-r from-primary to-accent text-primary-foreground">
                <Play className="h-4 w-4" /> Start Session
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success-muted border border-success/20">
                <span className="text-sm font-semibold text-success-foreground">
                  Started at {new Date(activeSessionData.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {activeParticipants.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Users className="h-4 w-4" /> Participants ({activeParticipantCount} active)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeParticipants.map(p => (
                      <Badge
                        key={p.id}
                        variant={p.exit_time ? "secondary" : "default"}
                        className={cn("gap-1", !p.exit_time && "bg-success hover:bg-success/80")}
                      >
                        {p.profile?.full_name || "Unknown"}
                        {p.exit_time && (
                          <span className="text-[10px] opacity-70">
                            (exited {new Date(p.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!isParticipating ? (
                <div className="py-4 text-center border-2 border-dashed rounded-xl space-y-3">
                  <p className="text-muted-foreground">You must join this session to control it.</p>
                  <Button onClick={joinSession} className="gap-2 font-bold">
                    <LogIn className="h-4 w-4" /> Join Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Exit — only visible when others are still active */}
                  {activeParticipantCount > 1 && (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowExitDialog(true)} className="gap-2">
                        <LogOut className="h-4 w-4" /> Exit Session (Keep Running)
                      </Button>
                    </div>
                  )}
                  {/* Close session — creator OR earliest remaining participant */}
                  {canControlSession ? (
                    <div className="border-t pt-4 space-y-3">
                      {currentControllerId !== activeSessionData.employee_id && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2 flex items-center gap-1">
                          <LogIn className="h-3.5 w-3.5 rotate-90" />
                          Control has been transferred to you as the earliest active participant.
                        </p>
                      )}
                      <p className="text-sm font-medium">Submit financial results & close session:</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {paymentMethods.map(m => (
                          <div key={m.id}>
                            <Label className="flex items-center gap-1">
                              {m.name}
                              {m.method_type === "expenditure" && (
                                <span className="text-[10px] text-destructive font-normal">(expense)</span>
                              )}
                            </Label>
                            <Input
                              type="number"
                              value={form[m.id] || 0}
                              onChange={(e) => setForm({ ...form, [m.id]: +e.target.value })}
                            />
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" /> Session Notes (optional)
                        </Label>
                        <Textarea
                          placeholder="Note any shortages, overages, incidents, or cash differences..."
                          value={sessionNotes}
                          onChange={(e) => setSessionNotes(e.target.value)}
                          className="mt-1.5 min-h-[60px]"
                        />
                      </div>
                      <Button onClick={closeSession} variant="destructive" className="gap-2 font-bold">
                        <XCircle className="h-4 w-4" /> Close Session & Submit Results
                      </Button>
                    </div>
                  ) : (
                    <div className="border-t pt-4">
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Another participant is currently controlling this session.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-2 w-full">
        {(["today", "yesterday", "7days", "all"] as DatePreset[]).map(p => (
          <Button
            key={p}
            size="sm"
            variant={activePreset === p ? "default" : "outline"}
            onClick={() => applyPreset(p)}
            className={cn("text-xs sm:text-sm", activePreset === p && "bg-gradient-to-r from-primary to-accent text-primary-foreground")}
          >
            {p === "today" ? "Today" : p === "yesterday" ? "Yesterday" : p === "7days" ? "7 Days" : "All"}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-2", filterDate && activePreset !== "all" && "border-primary")}>
              <CalendarIcon className="h-4 w-4" />
              {filterDate && activePreset !== "all" ? format(filterDate, "PPP") : "Pick date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filterDate}
              onSelect={(d) => { setFilterDate(d); setActivePreset(d ? "today" : "all"); }}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Tabs: Sessions + Notes */}
      <Tabs defaultValue="sessions" className="w-full">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <Card className="gold-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Session History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="min-h-[120px] flex items-center justify-center">
                  <PremiumLoader message="Loading sessions..." />
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No sessions found for this period.</p>
                </div>
              ) : (
                <>
                  {/* Mobile card view */}
                  <div className="md:hidden space-y-3 p-3">
                    {sessions.map((s) => {
                      const income = (s.session_payments || []).filter((p) => p.payment_methods?.method_type !== "expenditure").reduce((sum, p) => sum + (p.amount || 0), 0);
                      const expense = (s.session_payments || []).filter((p) => p.payment_methods?.method_type === "expenditure").reduce((sum, p) => sum + (p.amount || 0), 0);
                      const net = income - expense;
                      return (
                        <div key={s.id} className="rounded-xl border bg-card p-4 space-y-3">
                          {/* Top row: Date + Status + Delete */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{new Date(s.login_time).toLocaleDateString()}</span>
                            <div className="flex items-center gap-2">
                              {!s.logout_time ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-foreground">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                                  </span>
                                  Active
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Closed</span>
                              )}
                              {isOwner && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the session record and log the action for audit purposes.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteSession(s)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Delete Session
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>

                          {/* Handler */}
                          <div className="text-xs">
                            <span className="text-muted-foreground">Handler: </span>
                            <span className="font-semibold text-primary">
                              {s.participants && s.participants.length > 1
                                ? "Multiple participants"
                                : profilesMap[s.employee_id] || "Unknown"}
                            </span>
                          </div>

                          {/* Time & Duration */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>🕐 {new Date(s.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {s.logout_time ? new Date(s.logout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "now"}</span>
                            {s.duration_minutes && (
                              <span className="text-foreground font-medium">{Math.floor(s.duration_minutes / 60)}h {s.duration_minutes % 60}m</span>
                            )}
                          </div>

                          {/* Participants */}
                          {s.participants && s.participants.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Participants</span>
                              {s.participants.map(p => (
                                <div key={p.id} className="flex items-center gap-2 text-xs">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant={p.exit_time ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0.5 shrink-0 cursor-default gap-0.5">
                                          {p.user_id === s.employee_id && <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />}
                                          {p.profile?.full_name || "?"}
                                          {(p as any).exit_notes && <StickyNote className="h-2.5 w-2.5 opacity-70" />}
                                        </Badge>
                                      </TooltipTrigger>
                                      {(p as any).exit_notes && (
                                        <TooltipContent side="top" className="text-xs max-w-[200px]">
                                          <p className="font-semibold">Exit note:</p>
                                          <p className="whitespace-pre-wrap">{(p as any).exit_notes}</p>
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                  <span className="text-muted-foreground">
                                    {new Date(p.join_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {" → "}
                                    {p.exit_time
                                      ? new Date(p.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                      : <span className="text-primary font-medium">now</span>
                                    }
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Net Revenue */}
                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-xs text-muted-foreground">Net Revenue</span>
                            <span className={cn("font-bold text-sm", net < 0 ? "text-destructive" : "text-foreground")}>{formatCompact(net)}</span>
                          </div>

                          {/* Payment breakdown */}
                          {paymentMethods.length > 0 && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              {paymentMethods.map(m => {
                                const amt = getPaymentAmount(s, m.id);
                                return (
                                  <div key={m.id} className="flex justify-between">
                                    <span className="text-muted-foreground truncate mr-1">{m.name}</span>
                                    <span>{amt ? formatCompact(amt) : "—"}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden md:block w-full relative overflow-hidden rounded-b-xl">
                    <div className="overflow-x-auto w-full scrollbar-hide">
                      <TooltipProvider>
                        <Table className="premium-table w-full">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="font-bold">Date</TableHead>
                              <TableHead className="font-bold">Handler</TableHead>
                              <TableHead className="font-bold">Participants</TableHead>
                              <TableHead className="font-bold">Status</TableHead>
                              <TableHead>Login</TableHead>
                              <TableHead>Logout</TableHead>
                              <TableHead className="text-right">Duration</TableHead>
                              <TableHead className="text-right font-bold">Net Revenue</TableHead>
                              {paymentMethods.map(m => (
                                <TableHead key={m.id} className="text-right">
                                  {m.name}
                                  {m.method_type === "expenditure" && <span className="text-[9px] text-destructive ml-0.5">▼</span>}
                                </TableHead>
                              ))}
                              {isOwner && <TableHead className="text-right font-bold w-12">Actions</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sessions.map((s) => (
                              <TableRow key={s.id}>
                                <TableCell>{new Date(s.login_time).toLocaleDateString()}</TableCell>
                                <TableCell className="font-semibold text-primary">
                                {s.participants && s.participants.length > 1
                                  ? <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Multiple participants</span>
                                  : profilesMap[s.employee_id] || "Unknown"}
                              </TableCell>
                                <TableCell>
                                  {s.participants && s.participants.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {s.participants.map(p => (
                                        <Tooltip key={p.id}>
                                          <TooltipTrigger>
                                            <Badge variant={p.exit_time ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0.5 cursor-pointer gap-0.5">
                                              {p.user_id === s.employee_id && <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />}
                                              {p.profile?.full_name || "?"}
                                              {(p as any).exit_notes && <StickyNote className="h-2.5 w-2.5 opacity-70" />}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs max-w-[200px]">
                                            <p>Joined: {new Date(p.join_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            <p>Exited: {p.exit_time ? new Date(p.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Still active"}</p>
                                            {(p as any).exit_notes && <p className="mt-1 font-semibold">Note: {(p as any).exit_notes}</p>}
                                          </TooltipContent>
                                        </Tooltip>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {!s.logout_time ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-foreground">
                                      <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                                      </span>
                                      Active
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Closed</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">{new Date(s.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                                <TableCell className="text-xs">{s.logout_time ? new Date(s.logout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{s.duration_minutes ? `${Math.floor(s.duration_minutes / 60)}h ${s.duration_minutes % 60}m` : "—"}</TableCell>
                                <TableCell className="text-right font-bold text-primary">{formatCompact(getRevenue(s))}</TableCell>
                                {paymentMethods.map(m => (
                                  <TableCell key={m.id} className="text-right text-xs">{getPaymentAmount(s, m.id) ? formatCompact(getPaymentAmount(s, m.id)) : "—"}</TableCell>
                                ))}
                                {isOwner && (
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {s.logout_time && (
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEditSession(s)}>
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              This action cannot be undone. This will permanently delete the session record, all related transactions, and log the action for audit purposes.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteSession(s)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                              Delete Session
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                            {/* Totals Row */}
                            {sessions.length > 0 && (
                              <TableRow className="bg-muted/30 font-bold border-t-2">
                                <TableCell colSpan={7} className="text-right font-bold">Totals</TableCell>
                                <TableCell className="text-right font-bold text-primary">
                                  {formatCompact(sessions.reduce((sum, s) => sum + getRevenue(s), 0))}
                                </TableCell>
                                {paymentMethods.map(m => (
                                  <TableCell key={m.id} className="text-right font-bold text-xs">
                                    {formatCompact(sessions.reduce((sum, s) => sum + getPaymentAmount(s, m.id), 0))}
                                  </TableCell>
                                ))}
                                {isOwner && <TableCell />}
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TooltipProvider>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card className="gold-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Session Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Notes Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <Select value={notesEmployeeFilter} onValueChange={setNotesEmployeeFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {uniqueEmployeeIds.map(id => (
                      <SelectItem key={id} value={id}>{profilesMap[id] || "Unknown"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("gap-2", notesDateFilter && "border-primary")}>
                      <CalendarIcon className="h-4 w-4" />
                      {notesDateFilter ? format(notesDateFilter, "PPP") : "Filter by date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={notesDateFilter}
                      onSelect={setNotesDateFilter}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {notesDateFilter && (
                  <Button variant="ghost" size="sm" onClick={() => setNotesDateFilter(undefined)} className="text-xs">
                    Clear date
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="min-h-[120px] flex items-center justify-center">
                  <PremiumLoader message="Loading notes..." />
                </div>
              ) : sessionsWithNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No notes found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessionsWithNotes.map(s => (
                    <div key={s.id} className="rounded-xl border bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">{profilesMap[s.employee_id] || "Unknown"}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(s.login_time), "PPP")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {s.logout_time && ` → ${new Date(s.logout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">
                        {s.session_notes}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Sessions;
