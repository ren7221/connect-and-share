import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Users, LogIn, LogOut, XCircle, FileText, AlertCircle, StickyNote, Star } from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { cn, formatCompact } from "@/lib/utils";
import PremiumLoader from "@/components/PremiumLoader";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface Session {
  id: string;
  employee_id: string;
  login_time: string;
  logout_time: string | null;
  duration_minutes: number | null;
  airtel_money: number;
  tnm_mpamba: number;
  national_bank: number;
  cash_at_hand: number;
  cash_outs: number;
  session_notes?: string | null;
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

const EmployeeSessions = () => {
  const { user, tuckshopId, permissions, role } = useAuth();
  const isAdmin = role === "tuckshop_admin" || role === "super_admin";
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [form, setForm] = useState<Record<string, number>>({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<Date | undefined>(new Date());
  const [activePreset, setActivePreset] = useState<DatePreset>("today");

  // Collaborative session state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [myParticipation, setMyParticipation] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isSessionCreator, setIsSessionCreator] = useState(false);

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

  const fetchPaymentMethods = useCallback(async () => {
    if (!tuckshopId) return;
    const { data } = await supabase
      .from("payment_methods")
      .select("id, name, method_type")
      .eq("tuckshop_id", tuckshopId)
      .eq("is_active", true)
      .order("created_at");
    if (data) {
      setPaymentMethods(data as PaymentMethod[]);
      const initial: Record<string, number> = {};
      data.forEach(m => { initial[m.id] = 0; });
      setForm(initial);
    }
  }, [tuckshopId]);

  const checkActiveSession = useCallback(async () => {
    if (!user || !tuckshopId) return;

    const { data: sessionId } = await supabase.rpc("get_active_tuckshop_session", {
      _tuckshop_id: tuckshopId,
    });

    if (sessionId) {
      setActiveSessionId(sessionId);

      const { data: sessionData } = await supabase
        .from("daily_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionData) {
        setActiveSession(sessionData as Session);
        setIsSessionCreator(sessionData.employee_id === user.id);
      }

      const { data: myPart } = await supabase
        .from("session_participants")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .is("exit_time", null)
        .maybeSingle();

      setMyParticipation(myPart as Participant | null);

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

        setParticipants(parts.map(p => ({
          ...p,
          profile: { full_name: profileMap[p.user_id] || "Unknown" },
        })) as Participant[]);
      } else {
        setParticipants([]);
      }
    } else {
      setActiveSessionId(null);
      setActiveSession(null);
      setMyParticipation(null);
      setParticipants([]);
      setIsSessionCreator(false);
    }
  }, [user, tuckshopId]);

  const fetchSessions = useCallback(async () => {
    if (!user || !tuckshopId) return;
    setLoading(true);

    // Fetch session IDs where the user was a participant
    const { data: participationData } = await supabase
      .from("session_participants")
      .select("session_id")
      .eq("user_id", user.id)
      .eq("tuckshop_id", tuckshopId);

    const joinedSessionIds = participationData?.map(p => p.session_id) || [];

    // Combine sessions created by user and sessions joined by user
    const userPermissions = permissions as any;
    const canViewAll = isAdmin || userPermissions?.manage_sessions;

    let query = supabase
      .from("daily_sessions")
      .select("*")
      .eq("tuckshop_id", tuckshopId);

    // Admins and employees with manage_sessions see ALL tuckshop sessions
    if (!canViewAll) {
      if (joinedSessionIds.length > 0) {
        query = query.or(`employee_id.eq.${user.id},id.in.(${joinedSessionIds.join(",")})`);
      } else {
        query = query.eq("employee_id", user.id);
      }
    }

    query = query.order("login_time", { ascending: false });

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
    if (data) {
      const sessionIds = data.map(s => s.id);
      let paymentsMap: Record<string, SessionPayment[]> = {};
      let participantsMap: Record<string, Participant[]> = {};

      if (sessionIds.length > 0) {
        const [{ data: payments }, { data: allParts }] = await Promise.all([
          supabase
            .from("session_payments")
            .select("session_id, payment_method_id, amount, payment_methods(name, method_type)")
            .in("session_id", sessionIds),
          supabase
            .from("session_participants")
            .select("*")
            .in("session_id", sessionIds),
        ]);

        if (payments) {
          payments.forEach((p: any) => {
            if (!paymentsMap[p.session_id]) paymentsMap[p.session_id] = [];
            paymentsMap[p.session_id].push(p);
          });
        }

        if (allParts && allParts.length > 0) {
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
    }
    setLoading(false);
  }, [user, tuckshopId, filterDate, activePreset]);

  useEffect(() => { fetchPaymentMethods(); }, [fetchPaymentMethods]);
  useEffect(() => { checkActiveSession(); }, [checkActiveSession]);
  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const getSessionRevenue = (s: Session) => {
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
      toast({ title: "Active session exists", description: "Join the existing session instead.", variant: "destructive" });
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
      await supabase.from("session_participants").insert({
        session_id: newSession.id,
        user_id: user.id,
        tuckshop_id: tuckshopId,
      });
    }

    toast({ title: "Session started" });
    checkActiveSession();
    fetchSessions();
  };

  const joinSession = async () => {
    if (!user || !tuckshopId || !activeSessionId) return;

    // Backend guard: check if already participating
    const { data: existing } = await supabase
      .from("session_participants")
      .select("id")
      .eq("session_id", activeSessionId)
      .eq("user_id", user.id)
      .is("exit_time", null)
      .maybeSingle();

    if (existing) {
      toast({ title: "Already participating", description: "You are already in this session." });
      checkActiveSession();
      return;
    }

    const { error } = await supabase.from("session_participants").insert({
      session_id: activeSessionId,
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

  const exitSession = async (noteText?: string) => {
    if (!user || !activeSessionId || !myParticipation) return;
    const { error: exitError } = await supabase
      .from("session_participants")
      .update({
        exit_time: new Date().toISOString(),
        exit_notes: noteText?.trim() || null,
      } as any)
      .eq("id", myParticipation.id);

    if (exitError) {
      toast({ title: "Error", description: exitError.message, variant: "destructive" });
      return;
    }

    toast({ title: "You have exited the session" });
    const reset: Record<string, number> = {};
    paymentMethods.forEach(m => { reset[m.id] = 0; });
    setForm(reset);
    setSessionNotes("");
    setExitNoteText("");
    setShowExitDialog(false);
    checkActiveSession();
  };

  const closeSession = async () => {
    if (!user || !tuckshopId || !activeSession) return;
    const logoutTime = new Date().toISOString();
    const loginTime = new Date(activeSession.login_time);
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
    } as any).eq("id", activeSession.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const paymentRows = paymentMethods.map(m => ({
      session_id: activeSession.id,
      payment_method_id: m.id,
      amount: form[m.id] || 0,
    }));
    await supabase.from("session_payments").insert(paymentRows);

    await supabase
      .from("session_participants")
      .update({ exit_time: logoutTime })
      .eq("session_id", activeSession.id)
      .is("exit_time", null);

    toast({ title: "Session closed" });
    const reset: Record<string, number> = {};
    paymentMethods.forEach(m => { reset[m.id] = 0; });
    setForm(reset);
    setSessionNotes("");
    setActiveSession(null);
    setActiveSessionId(null);
    setMyParticipation(null);
    setParticipants([]);
    fetchSessions();
  };

  const renderActiveSessionCard = () => {
    const userPermissions = permissions as any;
    const canManageSessions = isAdmin || userPermissions?.manage_sessions;

    if (!activeSessionId || !activeSession) {
      return (
        <Card className="gold-border">
          <CardHeader>
            <CardTitle>Start New Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center border-2 border-dashed rounded-xl space-y-4">
              <p className="text-muted-foreground">No active session for your tuckshop.</p>
              {canManageSessions ? (
                <Button size="lg" onClick={startSession} className="px-8 font-bold bg-gradient-to-r from-primary to-accent text-primary-foreground">
                  Start Session Now
                </Button>
              ) : (
                <Badge variant="secondary" className="px-4 py-2">View Only Mode</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    const isParticipating = !!myParticipation;
    const canJoin = !isParticipating && !isSessionCreator;
    const activeParticipantCount = participants.filter(p => !p.exit_time).length;
    
    // Control transfer: earliest active joiner (by join_time) is the controller
    const sortedActiveParticipants = [...participants]
      .filter(p => !p.exit_time)
      .sort((a, b) => new Date(a.join_time).getTime() - new Date(b.join_time).getTime());
    const currentControllerId = sortedActiveParticipants[0]?.user_id;

    const canControlSession = isParticipating && currentControllerId === user?.id;

    return (
      <>
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
              <Button variant="destructive" onClick={() => exitSession(exitNoteText)} className="gap-2">
                <LogOut className="h-4 w-4" /> Confirm Exit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="gold-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
              </span>
              Active Session
              {(isParticipating || isSessionCreator) && (
                <Badge variant="outline" className="ml-2 text-success-foreground border-success/30 bg-success-muted">
                  Active – You Are a Participant
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success-muted border border-success/20">
              <span className="text-sm font-semibold text-success-foreground">
                Started at {new Date(activeSession.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {participants.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="h-4 w-4" /> Participants ({activeParticipantCount} active)
                </div>
                <div className="flex flex-wrap gap-2">
                  {participants.map(p => (
                    <Badge
                      key={p.id}
                      variant={p.exit_time ? "secondary" : "default"}
                      className={cn("gap-1", !p.exit_time && "bg-success hover:bg-success/80")}
                    >
                      {p.profile?.full_name || "Unknown"}
                      {p.exit_time ? (
                        <span className="text-[10px] opacity-70">
                          (exited {new Date(p.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      ) : null}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {canJoin ? (
              <div className="py-4 text-center border-2 border-dashed rounded-xl space-y-3">
                <p className="text-muted-foreground">You are not in this session yet.</p>
                <Button onClick={joinSession} className="gap-2 font-bold">
                  <LogIn className="h-4 w-4" /> Join Session
                </Button>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                {/* Exit (individual) — only if others are still active */}
                {activeParticipantCount > 1 && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowExitDialog(true)} className="gap-2">
                      <LogOut className="h-4 w-4" /> Exit Session
                    </Button>
                  </div>
                )}

                {/* Close session — creator OR last remaining participant */}
                {canControlSession && (
                  <>
                    <div className="border-t pt-4">
                      {currentControllerId !== activeSession.employee_id && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Control has been transferred to you as the earliest active participant.
                        </p>
                      )}
                      <p className="text-sm font-medium mb-3">Submit financial results & close session for everyone:</p>
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
                              disabled={!canManageSessions}
                            />
                          </div>
                        ))}
                      </div>
                      {/* Session Notes */}
                      <div className="mt-4">
                        <Label className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" /> Session Notes (optional)
                        </Label>
                        <Textarea
                          placeholder="Note any shortages, overages, incidents, or cash differences..."
                          value={sessionNotes}
                          onChange={(e) => setSessionNotes(e.target.value)}
                          className="mt-1.5 min-h-[60px]"
                          disabled={!canManageSessions}
                        />
                      </div>
                    </div>
                    {canManageSessions ? (
                      <Button onClick={closeSession} variant="destructive" className="gap-2 font-bold">
                        <XCircle className="h-4 w-4" /> Close Session & Submit Results
                      </Button>
                    ) : (
                      <Alert className="bg-warning-muted border-warning/30">
                        <AlertCircle className="h-4 w-4 text-warning-foreground" />
                        <AlertDescription className="text-warning-foreground text-xs">
                          You don't have permission to close this session. Please contact an admin.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">My Sessions</h1>

      {renderActiveSessionCard()}

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full">
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

      <Card className="gold-border">
        <CardHeader><CardTitle>Session History</CardTitle></CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16">
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
                      {/* Top row: Date + Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{new Date(s.login_time).toLocaleDateString()}</span>
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
                      </div>

                      {/* Time & Duration */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>🕐 {new Date(s.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {s.logout_time ? new Date(s.logout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "now"}</span>
                        {s.duration_minutes && (
                          <span className="text-foreground font-medium">{Math.floor(s.duration_minutes / 60)}h {s.duration_minutes % 60}m</span>
                        )}
                      </div>

                      {/* Participants — always show for closed sessions */}
                      {s.participants && s.participants.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Participants</span>
                            {s.participants.length > 1 && (
                              <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                                <Users className="h-2.5 w-2.5" /> Shared Session
                              </span>
                            )}
                          </div>
                          {s.participants.map(p => (
                            <div key={p.id} className="flex items-center gap-2 text-xs">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant={p.exit_time ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0.5 shrink-0 cursor-default">
                                      {p.profile?.full_name || "?"}
                                      {(p as any).exit_notes && <StickyNote className="h-2.5 w-2.5 ml-0.5 opacity-70" />}
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
                      {paymentMethods.length > 0 && s.logout_time && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {paymentMethods.map(m => {
                            const amt = getPaymentAmount(s, m.id);
                            return (
                              <div key={m.id} className="flex justify-between">
                                <span className="text-muted-foreground truncate mr-1">{m.name}</span>
                                <span className={amt === 0 ? "text-muted-foreground" : ""}>{formatCompact(amt)}</span>
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
                <ScrollArea className="w-full">
                  <TooltipProvider>
                    <Table className="premium-table w-full">
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="font-bold">Date</TableHead>
                          <TableHead className="font-bold">Participants</TableHead>
                          <TableHead className="font-bold">Status</TableHead>
                          <TableHead className="font-bold">Login</TableHead>
                          <TableHead className="font-bold">Logout</TableHead>
                          <TableHead className="font-bold text-right">Duration</TableHead>
                          <TableHead className="text-right font-bold">Net Revenue</TableHead>
                          {paymentMethods.map(m => (
                            <TableHead key={m.id} className="text-right font-bold">
                              {m.name}
                              {m.method_type === "expenditure" && <span className="text-[9px] text-destructive ml-0.5">▼</span>}
                            </TableHead>
                          ))}

                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessions.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>{new Date(s.login_time).toLocaleDateString()}</TableCell>
                            <TableCell>
                              {s.participants && s.participants.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                  {s.participants.map(p => (
                                    <div key={p.id} className="flex items-center gap-2 text-[11px]">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge variant={p.exit_time ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0.5 shrink-0 cursor-default">
                                              {p.profile?.full_name || "?"}
                                              {(p as any).exit_notes && <StickyNote className="h-2.5 w-2.5 ml-0.5 opacity-70" />}
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
                                      <span className="text-muted-foreground whitespace-nowrap">
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
                            <TableCell className="text-right text-xs">
                              {s.duration_minutes ? `${Math.floor(s.duration_minutes / 60)}h ${s.duration_minutes % 60}m` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {(() => {
                                const income = (s.session_payments || []).filter((p) => p.payment_methods?.method_type !== "expenditure").reduce((sum, p) => sum + (p.amount || 0), 0);
                                const expense = (s.session_payments || []).filter((p) => p.payment_methods?.method_type === "expenditure").reduce((sum, p) => sum + (p.amount || 0), 0);
                                const net = income - expense;
                                return <span className={net < 0 ? "text-destructive" : "text-foreground"}>{formatCompact(net)}</span>;
                              })()}
                            </TableCell>
                            {paymentMethods.map(m => {
                              const amt = getPaymentAmount(s, m.id);
                              return (
                                <TableCell key={m.id} className={cn("text-right text-xs", amt === 0 && s.logout_time ? "text-muted-foreground" : "")}>
                                  {s.logout_time ? formatCompact(amt) : "—"}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TooltipProvider>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeSessions;
