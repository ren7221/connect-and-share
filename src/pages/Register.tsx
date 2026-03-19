import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Store, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Register = () => {
  const [fullName, setFullName] = useState("");
  const [tuckshopName, setTuckshopName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !tuckshopName || !email || !password || !confirmPassword) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);

    // 1. Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (authError || !authData.user) {
      toast({ title: "Registration failed", description: authError?.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const userId = authData.user.id;

    // 2. Create tuckshop record (pending approval)
    const { error: shopError } = await supabase
      .from("tuckshops")
      .insert({ name: tuckshopName, owner_id: userId });

    if (shopError) {
      toast({ title: "Error creating tuckshop", description: shopError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // 3. Assign tuckshop_admin role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "tuckshop_admin" as any });

    if (roleError) {
      console.error("Role assignment error:", roleError);
    }

    // 4. Notify Super Admin via edge function (fire-and-forget)
    supabase.functions.invoke("notify-admin-registration", {
      body: { tuckshop_name: tuckshopName, owner_name: fullName, owner_email: email },
    }).catch(console.error);

    toast({
      title: "Registration submitted!",
      description: "Your tuckshop registration is pending Super Admin approval.",
    });
    setLoading(false);
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,hsl(153_60%_33%/0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,hsl(45_93%_47%/0.06),transparent_50%)]" />
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/icon-192x192.png" alt="MT Logo" className="h-10 w-10 rounded-lg" />
            <span className="font-display text-xl font-bold">MUST Business</span>
          </Link>
        </div>

        <Card className="gold-border transition-all duration-300 hover:shadow-lg hover:shadow-gold/10">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15">
              <Store className="h-6 w-6 text-gold" />
            </div>
            <CardTitle className="font-display text-2xl">Register Your Tuckshop</CardTitle>
            <CardDescription>
              Create an account and register your tuckshop. A Super Admin will review and approve your request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Banda"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tuckshopName">Tuckshop Name</Label>
                <Input
                  id="tuckshopName"
                  placeholder="e.g. MUST Ndata Campus Tuckshop"
                  value={tuckshopName}
                  onChange={(e) => setTuckshopName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full gap-2 bg-gradient-to-r from-primary to-gold hover:from-gold hover:to-primary text-primary-foreground shadow-md shadow-gold/10" disabled={loading}>
                <UserPlus className="h-4 w-4" />
                {loading ? "Submitting…" : "Register Tuckshop"}
              </Button>
            </form>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
