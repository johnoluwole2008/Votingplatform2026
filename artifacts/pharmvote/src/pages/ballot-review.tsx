import { useLocation } from "wouter";
import { useSubmitBallot } from "@workspace/api-client-react";
import { Shield, AlertTriangle, CheckCircle, Loader2, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface OfficeData {
  id: number;
  title: string;
  candidates: { id: number; fullName: string; level?: string | null }[];
}

export default function BallotReviewPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const submit = useSubmitBallot();
  const [submitted, setSubmitted] = useState(false);

  const selectionsRaw = sessionStorage.getItem("ballot_selections");
  const officesRaw = sessionStorage.getItem("ballot_offices");
  const abstainedRaw = sessionStorage.getItem("ballot_abstained");

  if (!selectionsRaw || !officesRaw) {
    setLocation("/ballot");
    return null;
  }

  const selections: Record<number, number> = JSON.parse(selectionsRaw);
  const offices: OfficeData[] = JSON.parse(officesRaw);
  const abstainedIds: number[] = abstainedRaw ? JSON.parse(abstainedRaw) : [];
  const abstainedSet = new Set(abstainedIds);

  const votes = Object.entries(selections).map(([officeId, candidateId]) => ({
    officeId: Number(officeId),
    candidateId: Number(candidateId),
  }));

  const handleSubmit = () => {
    submit.mutate(
      { data: { votes } },
      {
        onSuccess: () => {
          sessionStorage.removeItem("ballot_selections");
          sessionStorage.removeItem("ballot_offices");
          sessionStorage.removeItem("ballot_abstained");
          setLocation("/ballot/success");
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Failed to submit ballot. Please try again.";
          toast({ title: "Submission failed", description: msg, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Faculty Elections — Review Ballot</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Review Your Ballot</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Please review your selections carefully. Once submitted, your vote cannot be changed or recalled.
        </p>

        {/* Warning */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-sm dark:bg-amber-950/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-amber-800 dark:text-amber-400">
            <strong>This is your final ballot.</strong> After submission, you will be logged out and your session will end.
          </div>
        </div>

        {abstainedIds.length > 0 && (
          <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-sm dark:bg-orange-950/20 dark:border-orange-800">
            <MinusCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <div className="text-orange-700 dark:text-orange-400">
              You are <strong>abstaining</strong> from {abstainedIds.length} office{abstainedIds.length !== 1 ? "s" : ""}. No vote will be cast for those positions.
            </div>
          </div>
        )}

        {/* Selections */}
        <div className="space-y-4 mb-10">
          {offices.map((office) => {
            const candidateId = selections[office.id];
            const candidate = office.candidates.find((c) => c.id === candidateId);
            const isAbstained = abstainedSet.has(office.id);
            return (
              <div key={office.id} className="bg-card border border-border rounded-lg overflow-hidden" data-testid={`review-office-${office.id}`}>
                <div className="px-4 py-2 bg-muted/30 border-b border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{office.title}</div>
                </div>
                <div className="px-4 py-3 flex items-center gap-3">
                  {isAbstained ? (
                    <>
                      <MinusCircle className="h-5 w-5 text-orange-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-orange-600 dark:text-orange-400 text-sm">Abstained</div>
                        <div className="text-xs text-muted-foreground">No vote cast for this office</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-foreground text-sm">{candidate?.fullName ?? "Unknown"}</div>
                        {candidate?.level && <div className="text-xs text-muted-foreground">{candidate.level}</div>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={submit.isPending || submitted}
            data-testid="button-submit-vote"
          >
            {submit.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting your vote...
              </>
            ) : (
              "Confirm & Submit My Vote"
            )}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLocation("/ballot")}
            disabled={submit.isPending}
            data-testid="button-go-back"
          >
            Go Back and Make Changes
          </Button>
        </div>
      </main>
    </div>
  );
}
