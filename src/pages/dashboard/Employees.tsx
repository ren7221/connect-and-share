import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Copy, Trash2, Link as LinkIcon, ShieldCheck, ShieldOff } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface Permissions {
  view_only: boolean;
  edit_suppliers: boolean;
  manage_sessions: boolean;
  manage_price_list: boolean;
  manage_payments: boolean;
  update_supply_sales: boolean;
}

interface Employee {
  id: string;
  user_id: string | null;
  invite_token: string | null;
  permissions: Json;
  created_at: string;
  is_primary?: boolean;
  profiles?: { full_name: string | null; email: string | null } | null;
  isAdmin?: boolean;
}

const defaultPerms: Permissions = { view_only: true, edit_suppliers: false, manage_sessions: false, manage_price_list: false, manage_payments: false, update_supply_sales: false };
const permKeys: (keyof Permissions)[] = ["view_only", "edit_suppliers", "manage_sessions", "manage_price_list", "manage_payments", "update_supply_sales"];
const permLabels: Record<string, string> = {
  view_only: "View Only",
  edit_suppliers: "Edit Suppliers",
  manage_sessions: "Manage Sessions",
  manage_price_list: "Manage Price List",
  manage_payments: "Manage Payments",
  update_supply_sales: "Update Supply Sales"
};

const Employees = () => {
  const { tuckshopId, isOwner, user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [permDialog, setPermDialog] = useState<Employee | null>(null);
  const [perms, setPerms] = useState<Permissions>(defaultPerms);
  const [tuckshopName, setTuckshopName] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "remove" | "demote"; emp: Employee } | null>(null);

  const fetchEmployees = async () => {
    if (!tuckshopId) return;
    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("tuckshop_id", tuckshopId)
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch profiles and admin roles
      const userIds = data.filter(e => e.user_id).map(e => e.user_id!);
      let adminSet = new Set<string>();
      if (userIds.length > 0) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds)
          .eq("role", "tuckshop_admin");
        if (roles) roles.forEach(r => adminSet.add(r.user_id));
      }

      const withProfiles = await Promise.all(
        data.map(async (emp) => {
          if (emp.user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", emp.user_id)
              .maybeSingle();
            return { ...emp, profiles: profile, isAdmin: adminSet.has(emp.user_id) };
          }
          return { ...emp, profiles: null, isAdmin: false };
        })
      );

      // Requirement: Promoted admins should not be able to view or manage other admins.
      // Only the shop creator should be able to see all admins.
      if (!isOwner) {
        setEmployees(withProfiles.filter(emp => !emp.isAdmin || emp.user_id === user?.id));
      } else {
        setEmployees(withProfiles);
      }
    }
  };

  useEffect(() => {
    if (!tuckshopId) return;
    fetchEmployees();
    supabase.from("tuckshops").select("name").eq("id", tuckshopId).maybeSingle().then(({ data }) => {
      if (data) setTuckshopName(data.name);
    });
  }, [tuckshopId]);

  const generateInvite = async () => {
    if (!tuckshopId) return;
    const { data, error } = await supabase
      .from("employees")
      .insert({
        tuckshop_id: tuckshopId,
        permissions: defaultPerms as unknown as Json
      })
      .select("invite_token")
      .single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    const link = `${window.location.origin}/join?token=${data.invite_token}&shop=${encodeURIComponent(tuckshopName)}`;
    setInviteLink(link);
    fetchEmployees();
  };

  const copyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast({ title: "Link copied!" });
    }
  };

  const removeEmployee = async (id: string) => {
    await supabase.from("employees").delete().eq("id", id);
    fetchEmployees();
    toast({ title: "Employee removed" });
  };

  const openPermissions = (emp: Employee) => {
    setPermDialog(emp);
    setPerms(emp.permissions ? (emp.permissions as unknown as Permissions) : defaultPerms);
  };

  const savePermissions = async () => {
    if (!permDialog) return;
    const { error } = await supabase
      .from("employees")
      .update({ permissions: perms as unknown as Json })
      .eq("id", permDialog.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Permissions updated" });
      setPermDialog(null);
      fetchEmployees();
    }
  };

  const promoteToAdmin = async (emp: Employee) => {
    if (!emp.user_id) return;

    // Requirement: Each shop can have a maximum of 2 admins.
    const adminCount = employees.filter(e => e.isAdmin).length;
    if (adminCount >= 2) {
      toast({ 
        title: "Limit Reached", 
        description: "Each shop can have a maximum of 2 admins. Please remove an admin before promoting another.", 
        variant: "destructive" 
      });
      return;
    }

    const { error } = await supabase.from("user_roles").insert({
      user_id: emp.user_id,
      role: "tuckshop_admin" as any,
    });
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already an admin", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Employee promoted to Admin" });
      fetchEmployees();
    }
  };

  const removeAdmin = async (emp: Employee) => {
    if (!emp.user_id) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", emp.user_id)
      .eq("role", "tuckshop_admin" as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Admin role removed" });
      fetchEmployees();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Employees</h1>
        <Button onClick={generateInvite} className="gap-2 w-full sm:w-auto"><UserPlus className="h-4 w-4" /> Invite Employee</Button>
      </div>

      {inviteLink && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <LinkIcon className="h-5 w-5 text-primary flex-shrink-0" />
            <code className="flex-1 text-xs break-all">{inviteLink}</code>
            <Button size="sm" variant="outline" onClick={copyLink} className="gap-1"><Copy className="h-3 w-3" /> Copy</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="premium-table">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => {
                const p = emp.permissions as unknown as Permissions;
                const activePerms = permKeys.filter((k) => p?.[k]).map((k) => permLabels[k]);
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.profiles?.full_name || "—"}</TableCell>
                    <TableCell>{emp.profiles?.email || "—"}</TableCell>
                    <TableCell>{emp.user_id ? <span className="text-primary">Active</span> : <span className="text-muted-foreground">Pending invite</span>}</TableCell>
                    <TableCell>
                      {emp.isAdmin ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><ShieldCheck className="h-3 w-3" />Admin</Badge>
                      ) : (
                        <Badge variant="secondary">Employee</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{activePerms.join(", ") || "View Only"}</TableCell>
                    <TableCell>{new Date(emp.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {isOwner && emp.user_id && !emp.isAdmin && (
                        <Button size="sm" variant="outline" onClick={() => promoteToAdmin(emp)} className="gap-1">
                          <ShieldCheck className="h-3 w-3" /> Promote
                        </Button>
                      )}
                      {isOwner && emp.isAdmin && emp.user_id && emp.user_id !== user?.id && (
                        <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: "demote", emp })} className="gap-1 text-destructive hover:text-destructive">
                          <ShieldOff className="h-3 w-3" /> Remove Admin
                        </Button>
                      )}
                      {!emp.isAdmin && isOwner && (
                        <Button size="sm" variant="outline" onClick={() => openPermissions(emp)}>Permissions</Button>
                      )}
                      {isOwner && emp.user_id !== user?.id && (
                        <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ type: "remove", emp })}><Trash2 className="h-3 w-3" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {employees.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No employees yet. Click "Invite Employee" to get started.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!permDialog} onOpenChange={(v) => !v && setPermDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permissions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {permKeys.map((key) => (
              <div key={key} className="flex items-center gap-3">
                <Checkbox
                  id={key}
                  checked={perms[key]}
                  onCheckedChange={(c) => setPerms({ ...perms, [key]: !!c })}
                />
                <label htmlFor={key} className="text-sm">{permLabels[key]}</label>
              </div>
            ))}
            <Button onClick={savePermissions} className="w-full">Save Permissions</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={(v) => !v && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "remove" ? "Remove Employee" : "Remove Admin Role"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "remove"
                ? `Are you sure you want to remove ${confirmAction.emp.profiles?.full_name || "this employee"}? This action cannot be undone.`
                : `Are you sure you want to demote ${confirmAction?.emp.profiles?.full_name || "this admin"}? They will lose all admin privileges.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmAction?.type === "remove") {
                  removeEmployee(confirmAction.emp.id);
                } else if (confirmAction?.type === "demote") {
                  removeAdmin(confirmAction!.emp);
                }
                setConfirmAction(null);
              }}
            >
              {confirmAction?.type === "remove" ? "Remove" : "Demote"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Employees;
