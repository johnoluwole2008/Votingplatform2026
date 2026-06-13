import { Link } from "wouter";
import { useGetElectionStatus } from "@workspace/api-client-react";
import { Shield, Clock, CheckCircle, Lock, Users, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

function PhaseCountdown({ targetDate }: { targetDate: string }) {
  const target = new Date(targetDate);
  const now = new Date();
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return <span>Now</span>;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <span>
      {days > 0 ? `${days}d ` : ""}{hours}h {minutes}m
    </span>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const variants: Record<string, { label: string; class: string }> = {
    setup: { label: "Setup Mode", class: "bg-muted text-muted-foreground" },
    registration: { label: "Registration Open", class: "bg-emerald-100 text-emerald-800" },
    voting: { label: "Voting Open", class: "bg-primary text-primary-foreground" },
    results: { label: "Results Available", class: "bg-amber-100 text-amber-800" },
    audit: { label: "Audit Phase", class: "bg-muted text-muted-foreground" },
  };
  const v = variants[phase] ?? variants.setup;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${v.class}`}>
      {v.label}
    </span>
  );
}

export default function IndexPage() {
  const { data: status, isLoading } = useGetElectionStatus();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="PharmSci Logo" className="h-10 w-10 object-contain" />
            <div>
              <div className="font-semibold text-sm text-foreground">PharmSci E-Voting</div>
              <div className="text-xs text-muted-foreground">Faculty of Pharmaceutical Sciences</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/admin/login">
              <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                Admin Access
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 py-16 text-center">
          {!isLoading && status && (
            <div className="mb-6" data-testid="status-phase">
              <PhaseBadge phase={status.phase} />
            </div>
          )}

          <h1 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
            {status?.electionName ?? "Faculty Student Elections"}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
            Your secure, verified vote shapes student leadership. One identity. One vote. Every voice counted.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            {(status?.votingOpen || !status) && (
              <Link href="/login">
                <Button
                  size="lg"
                  variant="default"
                  className="w-full sm:w-auto px-10"
                  data-testid="button-login"
                >
                  Cast Your Vote
                </Button>
              </Link>
            )}
            {status?.registrationOpen && !status.votingOpen && (
              <Link href="/register">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-10" data-testid="button-register">
                  Register to Vote
                </Button>
              </Link>
            )}
            {status && !status.votingOpen && !status.registrationOpen && status.phase !== "results" && status.phase !== "audit" && (
              <div className="text-muted-foreground text-sm py-3 px-6 border border-border rounded-lg">
                The election has not yet opened. Check back on Election Day.
              </div>
            )}
            {(status?.phase === "results" || status?.phase === "audit") && (
              <Link href="/results">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-10" data-testid="button-results">
                  View Results
                </Button>
              </Link>
            )}
          </div>

          {/* Phase info */}
          {status && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              {status.registrationStart && (
                <div className="bg-card border border-border rounded-lg px-5 py-4 text-center" data-testid="status-registration">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Registration</div>
                  <div className="text-sm font-medium text-foreground">
                    {status.registrationOpen ? (
                      <span className="text-emerald-600">Open — closes in <PhaseCountdown targetDate={status.registrationEnd!} /></span>
                    ) : (
                      new Date(status.registrationStart).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                    )}
                  </div>
                </div>
              )}
              {status.votingStart && (
                <div className="bg-card border border-border rounded-lg px-5 py-4 text-center" data-testid="status-voting">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Election Day</div>
                  <div className="text-sm font-medium text-foreground">
                    {status.votingOpen ? (
                      <span className="text-primary">Voting in progress — <PhaseCountdown targetDate={status.votingEnd!} /> remaining</span>
                    ) : (
                      new Date(status.votingStart).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                    )}
                  </div>
                </div>
              )}
              <div className="bg-card border border-border rounded-lg px-5 py-4 text-center" data-testid="status-students">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Eligible Students</div>
                <div className="text-sm font-semibold text-foreground">{(status.totalStudents ?? 0).toLocaleString()} registered students</div>
              </div>
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="bg-muted/30 border-t border-border py-14">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-xl font-semibold text-center text-foreground mb-10">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Users,
                  title: "1. Register",
                  desc: "During the registration window, submit your Matric Number and school email to verify your identity. Your details are cross-checked against official Faculty records.",
                },
                {
                  icon: Lock,
                  title: "2. Receive Confirmation",
                  desc: "After successful registration, you receive a confirmation email. Your voting password is set during registration — keep it safe.",
                },
                {
                  icon: CheckCircle,
                  title: "3. Vote on Election Day",
                  desc: "On Election Day, log in with your Matric Number and voting password. Review the ballot, select one candidate per office, and submit. Your ballot is final.",
                },
              ].map((step) => (
                <div key={step.title} className="bg-card border border-border rounded-lg p-6">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="py-14">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-xl font-semibold text-center text-foreground mb-10">Built for security</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Shield, label: "Identity verified", desc: "Every voter is cross-checked against official student records" },
                { icon: Lock, label: "One vote only", desc: "Database-enforced uniqueness prevents double voting" },
                { icon: CheckCircle, label: "Anonymised ballots", desc: "Your vote choice is never linked to your identity" },
                { icon: Award, label: "Audit trail", desc: "Every action is logged for post-election verification" },
              ].map((item) => (
                <div key={item.label} className="text-center p-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="font-medium text-sm text-foreground mb-1">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Faculty of Pharmaceutical Sciences Electoral Committee</span>
          <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Secured over HTTPS</span>
        </div>
      </footer>
    </div>
  );
}
