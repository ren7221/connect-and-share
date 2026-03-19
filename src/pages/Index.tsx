import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user || !role) return;
    if (role === "super_admin") navigate("/admin", { replace: true });
    else if (role === "tuckshop_admin") navigate("/dashboard", { replace: true });
    else if (role === "employee") navigate("/employee", { replace: true });
  }, [user, role, loading, navigate]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur-xl will-change-transform">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/icon-192x192.png" alt="MUST Business" className="h-9 w-9 rounded-lg" />
            <span className="font-display text-lg font-bold text-white">MUST Business</span>
          </Link>

          <div className="hidden sm:flex items-center gap-3">
            <Button variant="ghost" asChild className="text-white/80 hover:text-white hover:bg-white/10">
              <Link to="/docs">Docs</Link>
            </Button>
            <Button variant="ghost" asChild className="text-white hover:bg-white/10">
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild className="bg-white text-foreground hover:bg-white/90 font-semibold">
              <Link to="/register">Get Started</Link>
            </Button>
          </div>

          <button
            className="sm:hidden p-2 rounded-md text-white hover:bg-white/10 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed top-16 left-0 right-0 z-[49] bg-black/60 backdrop-blur-2xl border-b border-white/10 overflow-hidden sm:hidden"
          >
            <div className="container py-6 flex flex-col gap-4">
              <Link
                to="/docs"
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-medium text-white/80 hover:text-white transition-colors px-2 py-1"
              >
                How It Works
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-medium text-white/80 hover:text-white transition-colors px-2 py-1"
              >
                Sign In
              </Link>
              <Button asChild className="w-full h-12 text-lg bg-white text-foreground hover:bg-white/90 mt-2 font-bold shadow-lg shadow-white/10">
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero with campus background */}
      <section className="relative flex-1 flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/images/must-campus.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

        <div className="relative z-10 container text-center px-4 pt-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ willChange: "transform, opacity" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-white/90"
            >
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Trusted by MUST Campus Community
            </motion.div>

            <h1 className="mx-auto max-w-4xl font-display text-5xl font-extrabold leading-[1.08] tracking-tight text-white md:text-7xl lg:text-8xl">
              Run Your Campus{" "}
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Business Smarter
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70 md:text-xl leading-relaxed">
              The all-in-one platform for managing suppliers, sales, employees, and daily sessions at Malawi University of Science and Technology.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="gap-2 bg-gradient-to-r from-primary to-accent hover:from-accent hover:to-primary text-white shadow-lg shadow-primary/30 px-10 h-14 text-lg font-bold">
                <Link to="/register">
                  Get Started Free <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-white/40 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm px-10 h-14 text-lg font-bold">
                <Link to="/docs">How It Works</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/icon-192x192.png" alt="MUST Business" className="h-7 w-7 rounded-md" />
            <span className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} MUST Business
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Malawi University of Science and Technology
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
