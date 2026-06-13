import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { ShieldCheck, Loader2, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  editor: "Editor",
  observer: "Observer",
};

const ROLE_DESC: Record<string, string> = {
  super_admin: "Full access: manage all settings, accounts, and elections.",
  editor: "Can manage candidates, offices, and election settings.",
  observer: "Read-only access to view results and reports.",
};

export default function AdminJoinPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [invite, setInvite] = useState<{ role: string; email: string | null; expiresAt: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setInviteError("Invalid invite link."); setIsValidating(false); return; }
    fetch(`/api/admin/invites/${token}`, { credentials: "include" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, ...j })))
      .then((data) => {
        if (!data.ok || !data.valid) {
          setInviteError(data.error ?? "This invite is invalid or has expired.");
        } else {
          setInvite({ role: data.role, email: data.email, expiresAt: data.expiresAt });
          if (data.email) setEmail(data.email);
        }
      })
      .catch(() => setInviteError("Failed to validate invite. Please try again."))
      .finally(() => setIsValidating(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, name, email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Registration failed");
      setDone(true);
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span className="font-semibold text-sm">PharmSci E-Voting — Admin Setup</span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {isValidating ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validating invite…</p>
            </div>
          ) : inviteError ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <XCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
              <h1 className="text-lg font-bold text-foreground mb-2">Invite Invalid</h1>
              <p className="text-sm text-muted-foreground mb-6">{inviteError}</p>
              <Button variant="outline" onClick={() => setLocation("/admin/login")}>
                Go to Admin Login
              </Button>
            </div>
          ) : done ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto mb-4" />
              <h1 className="text-lg font-bold text-foreground mb-2">Account Created!</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Your admin account has been set up. You can now log in with your email and password.
              </p>
              <Button onClick={() => setLocation("/admin/login")}>
                Go to Admin Login
              </Button>
            </div>
          ) : invite ? (
            <div className="bg-card border border-border rounded-xl shadow-sm p-8">
              <h1 className="text-2xl font-bold text-foreground mb-1">Set Up Admin Account</h1>

              {/* Role badge */}
              <div className="flex items-center gap-2 mt-3 mb-6 bg-primary/8 border border-primary/20 rounded-lg px-4 py-3">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-foreground">{ROLE_LABELS[invite.role] ?? invite.role}</div>
                  <div className="text-xs text-muted-foreground">{ROLE_DESC[invite.role] ?? ""}</div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Full Name</label>
                  <Input
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Email Address</label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={!!invite.email}
                    className={invite.email ? "bg-muted" : ""}
                    required
                  />
                  {invite.email && (
                    <p className="text-xs text-muted-foreground mt-1">Email pre-filled by the invite creator.</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Password</label>
                  <div className="relative">
                    <Input
                      type={showPw ? "text" : "password"}
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPw((s) => !s)}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account…</>
                  ) : "Create My Admin Account"}
                </Button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Invite expires {new Date(invite.expiresAt).toLocaleDateString()}.
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
