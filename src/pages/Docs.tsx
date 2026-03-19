import { Link } from "react-router-dom";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Docs = () => {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/icon-192x192.png" alt="MUST Business" className="h-9 w-9 rounded-lg" />
            <span className="font-display text-lg font-bold">MUST Business</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link to="/" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
        </div>
      </nav>

      <div className="container max-w-4xl py-12">
        <h1 className="font-display text-4xl font-bold">User Guide</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Everything you need to know about the MUST Business Management Platform.
        </p>

        <div className="mt-12 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-semibold text-primary">For Tuckshop Owners</h2>
            <ul className="mt-4 space-y-3">
              {[
                "Register your tuckshop and wait for approval",
                "Add suppliers with commodities and unit prices",
                "Invite employees and set their permissions",
                "Monitor daily sales sessions and balances",
                "Track supplier payments and outstanding balances",
                "View price listings and update as needed",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-accent">For Employees</h2>
            <ul className="mt-4 space-y-3">
              {[
                "Join via the invitation link from your Admin",
                "Session starts automatically when you log in",
                "Record daily balances across all payment channels",
                "Input quantity sold for each commodity",
                "View price listing for reference during sales",
                "Log out to end your session automatically",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="font-display text-2xl font-bold">System Overview</h2>
          <div className="mt-6 space-y-6 text-sm text-muted-foreground">
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">Roles</h3>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li><strong>Super Admin</strong> — Approves/rejects tuckshop registrations. Cannot access internal tuckshop data.</li>
                <li><strong>Tuckshop Admin (Owner)</strong> — Full control over their shop: suppliers, employees, price list, sessions.</li>
                <li><strong>Employee</strong> — Permission-based access: view-only, edit suppliers, manage sessions, manage price list, manage payments.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">Supplier Sales & Commission</h3>
              <p className="mt-1">Each supplier sale tracks: commodity name, unit price, quantity supplied, quantity sold. The system auto-calculates remaining stock, total sales, 12% commission, and net payable amount. Outstanding balances roll over until marked as paid.</p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">Daily Sessions</h3>
              <p className="mt-1">Employees log sessions recording Airtel Money, TNM Mpamba, National Bank, cash at hand, and cash-outs. Session duration is tracked automatically.</p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">Employee Invitations</h3>
              <p className="mt-1">Tuckshop admins generate invite links with unique tokens. Employees sign up via the link, which automatically links them to the correct tuckshop with default permissions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Docs;
