import { CheckCircle, Shield, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function BallotSuccessPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-end p-3">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-emerald-600" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">Your Vote Has Been Recorded</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          Thank you for participating in the Faculty of Pharmaceutical Sciences Student Elections.
          Your vote has been securely recorded and your session has ended.
        </p>

        <div className="bg-card border border-border rounded-xl p-6 mb-8 text-left space-y-4">
          <div className="flex items-start gap-3">
            <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-foreground">Your vote is anonymous</div>
              <div className="text-sm text-muted-foreground mt-1">
                Your ballot choices are permanently separated from your identity. No one — including administrators — can trace your vote back to you.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-foreground">Results will be announced</div>
              <div className="text-sm text-muted-foreground mt-1">
                The Electoral Committee will announce the results after the voting period closes and the audit is complete.
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          You have been logged out. You may safely close this window.
        </p>
      </div>
      </div>
    </div>
  );
}
