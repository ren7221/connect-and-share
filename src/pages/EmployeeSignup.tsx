import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const EmployeeSignup = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("token");
  const tuckshopName = searchParams.get("shop") || "Your Tuckshop";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (!inviteToken) {
      toast({ title: "Invalid invitation link", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);

    // 1. Validate invite token exists
    const { data: empRecord, error: empError } = await supabase
      .from("employees")
      .select("id, tuckshop_id")
      .eq("invite_token", inviteToken)
      .is("user_id", null)
      .maybeSingle();

    if (empError || !empRecord) {
      toast({ title: "Invalid or expired invitation link", variant: "destructive" });
      setLoading(false);
      return;
    }

    // 2. Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (authError || !authData.user) {
      toast({ title: "Signup failed", description: authError?.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const userId = authData.user.id;

    // 3. Link employee record: set user_id and consume token
    const { error: updateError } = await supabase
      .from("employees")
      .update({ user_id: userId, invite_token: null } as any)
      .eq("id", empRecord.id);

    if (updateError) {
      console.error("Employee link error:", updateError);
    }

    // 4. Assign employee role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "employee" as any });

    if (roleError) {
      console.error("Role assignment error:", roleError);
    }

    toast({
      title: "Account created!",
      description: `You have been added to ${tuckshopName}.`,
    });
    setLoading(false);
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(153_60%_33%/0.06),transparent_50%)]" />
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/icon-192x192.png" alt="MT Logo" className="h-10 w-10 rounded-lg" />
            <span className="font-display text-xl font-bold">MUST Tuckshop</span>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">Join {tuckshopName}</CardTitle>
            <CardDescription>You've been invited to join as an employee. Create your account to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            {!inviteToken ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center text-sm text-destructive">
                Invalid or missing invitation link. Please ask your Tuckshop Admin for a new one.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" placeholder="Jane Phiri" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  <UserPlus className="h-4 w-4" />
                  {loading ? "Creating account…" : "Create Account"}
                </Button>
              </form>
            )}
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">Sign In</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeeSignup;
