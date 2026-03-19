import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();

  // Auto-redirect if already logged in
  useEffect(() => {
    if (authLoading || !user || !role) return;
    redirectByRole(role);
  }, [user, role, authLoading]);

  const redirectByRole = async (r: string) => {
    if (r === "super_admin") {
      navigate("/admin", { replace: true });
    } else if (r === "tuckshop_admin") {
      const { data: shop } = await supabase
        .from("tuckshops")
        .select("status")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (shop?.status === "pending") {
        toast({ title: "Your tuckshop is pending approval", description: "A Super Admin will review your registration soon." });
        navigate("/", { replace: true });
      } else if (shop?.status === "rejected") {
        toast({ title: "Your tuckshop registration was rejected", variant: "destructive" });
        navigate("/", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } else if (r === "employee") {
      navigate("/employee", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    toast({ title: "Welcome back!" });
    // AuthContext will update role, useEffect above handles redirect
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Enter your email first", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email for a password reset link." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
            <CardTitle className="font-display text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to your tuckshop account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button type="button" onClick={handleForgotPassword} className="text-xs text-gold hover:text-gold/80 hover:underline">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full gap-2 bg-gradient-to-r from-primary to-gold hover:from-gold hover:to-primary text-primary-foreground shadow-md shadow-gold/10" disabled={loading}>
                <LogIn className="h-4 w-4" />
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/register" className="font-medium text-primary hover:underline">Register Tuckshop</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
