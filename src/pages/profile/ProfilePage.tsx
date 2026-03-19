import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Phone, Shield, Calendar, Store, Camera, Lock, Save, Palette, Upload } from "lucide-react";

const ProfilePage = () => {
  const { user, role, tuckshopId } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<{ full_name: string; email: string; phone: string; avatar_url: string; created_at: string }>({
    full_name: "", email: "", phone: "", avatar_url: "", created_at: "",
  });
  const [tuckshopName, setTuckshopName] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState({ newPassword: "", confirmPassword: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Branding state (admin only)
  const [brandColor, setBrandColor] = useState("#16a34a");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile({ full_name: data.full_name ?? "", email: data.email ?? "", phone: (data as any).phone ?? "", avatar_url: (data as any).avatar_url ?? "", created_at: data.created_at });
    });
    if (tuckshopId) {
      supabase.from("tuckshops").select("name, brand_color, logo_url").eq("id", tuckshopId).maybeSingle().then(({ data }) => {
        if (data) {
          setTuckshopName(data.name);
          if (data.brand_color) setBrandColor(data.brand_color);
          if (data.logo_url) setLogoUrl(data.logo_url);
        }
      });
    }
  }, [user, tuckshopId]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: profile.full_name, phone: profile.phone } as any).eq("id", user.id);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Profile updated" });
  };

  const handlePasswordChange = async () => {
    if (passwords.newPassword.length < 6) { toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" }); return; }
    if (passwords.newPassword !== passwords.confirmPassword) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwords.newPassword });
    setChangingPassword(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Password updated" }); setPasswords({ newPassword: "", confirmPassword: "" }); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `profiles/${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) { toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" }); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: publicUrl } as any).eq("id", user.id);
    setProfile((p) => ({ ...p, avatar_url: publicUrl }));
    setUploading(false);
    toast({ title: "Avatar updated" });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tuckshopId) return;
    setUploadingLogo(true);
    const path = `tuckshop-logos/${tuckshopId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); setUploadingLogo(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("tuckshops").update({ logo_url: publicUrl } as any).eq("id", tuckshopId);
    setLogoUrl(publicUrl);
    setUploadingLogo(false);
    toast({ title: "Logo updated" });
  };

  const handleSaveBrandColor = async () => {
    if (!tuckshopId) return;
    setSavingColor(true);
    await supabase.from("tuckshops").update({ brand_color: brandColor } as any).eq("id", tuckshopId);
    setSavingColor(false);
    toast({ title: "Brand color updated" });
  };

  const initials = profile.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "U";
  const roleBadge = role === "super_admin" ? "Super Admin" : role === "tuckshop_admin" ? "Tuckshop Admin" : role === "employee" ? "Employee" : "User";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-2xl md:text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your personal information and security</p>
      </motion.div>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-primary/90 via-primary to-emerald-700" />
          <CardContent className="relative pt-0 pb-6 px-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-12">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Camera className="h-6 w-6 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                </label>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-xl font-bold truncate">{profile.full_name || "Unnamed User"}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" />{roleBadge}</Badge>
                  {tuckshopName && <Badge variant="outline" className="gap-1"><Store className="h-3 w-3" />{tuckshopName}</Badge>}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><User className="h-3 w-3" />Full Name</Label>
                  <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />Email</Label>
                  <Input value={profile.email} disabled className="bg-muted/50" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />Phone</Label>
                  <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+265..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" />Joined</Label>
                  <Input value={profile.created_at ? new Date(profile.created_at).toLocaleDateString() : ""} disabled className="bg-muted/50" />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-auto gap-2">
                <Save className="h-4 w-4" />{saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tuckshop Branding — admin only */}
      {role === "tuckshop_admin" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2"><Palette className="h-5 w-5 text-muted-foreground" />Tuckshop Branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tuckshop Logo</Label>
                  <div className="flex items-center gap-3">
                    {logoUrl && (
                      <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-lg object-cover border border-border" />
                    )}
                    <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{uploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Brand Color</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-10 w-10 rounded-lg border border-border cursor-pointer" />
                    <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="max-w-32" />
                    <Button size="sm" onClick={handleSaveBrandColor} disabled={savingColor}>
                      {savingColor ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">These settings will be displayed on your employees' dashboard.</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Security Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2"><Lock className="h-5 w-5 text-muted-foreground" />Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input type="password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} placeholder="Min 6 characters" />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm Password</Label>
                <Input type="password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} placeholder="Repeat password" />
              </div>
            </div>
            <Button onClick={handlePasswordChange} disabled={changingPassword} variant="outline" className="gap-2">
              <Lock className="h-4 w-4" />{changingPassword ? "Updating..." : "Change Password"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ProfilePage;
