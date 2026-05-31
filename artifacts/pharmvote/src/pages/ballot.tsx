import { useState } from "react";
import { useLocation } from "wouter";
import { useGetBallot, getGetBallotQueryOptions } from "@workspace/api-client-react";
import { useVoterSession } from "@/hooks/use-voter-session";
import { Loader2, Shield, CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function BallotPage() {
  const [, setLocation] = useLocation();
  const session = useVoterSession();
  const ballot = useGetBallot({
    query: { ...getGetBallotQueryOptions(), enabled: !!session.data, retry: false },
  });
  const [selections, setSelections] = useState<Record<number, number>>({});

  if (session.isLoading || ballot.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (ballot.isError) {
    const msg = (ballot.error as any)?.response?.data?.error;
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
          <h2 className="font-semibold text-foreground mb-2">Ballot Unavailable</h2>
          <p className="text-muted-foreground text-sm">{msg ?? "Voting is not currently open."}</p>
        </div>
      </div>
    );
  }

  if (!ballot.data) return null;

  const { offices, voterName, voterLevel } = ballot.data;
  const totalOffices = offices.length;
  const selectedCount = Object.keys(selections).length;
  const allSelected = selectedCount === totalOffices;

  const handleSelect = (officeId: number, candidateId: number) => {
    setSelections((s) => ({ ...s, [officeId]: candidateId }));
  };

  const handleReview = () => {
    // Store selections for review page
    sessionStorage.setItem("ballot_selections", JSON.stringify(selections));
    sessionStorage.setItem("ballot_offices", JSON.stringify(offices));
    setLocation("/ballot/review");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Faculty Elections — Ballot</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {selectedCount} / {totalOffices} selected
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Your Ballot</h1>
          <p className="text-sm text-muted-foreground">
            Hello <strong className="text-foreground">{voterName}</strong> ({voterLevel}). Select exactly one candidate per office. You must vote on all {totalOffices} offices before you can submit.
          </p>
        </div>

        {/* Progress */}
        <div className="bg-card border border-border rounded-lg p-4 mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{selectedCount} of {totalOffices} offices</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all duration-300"
              style={{ width: `${(selectedCount / totalOffices) * 100}%` }}
            />
          </div>
        </div>

        {/* Offices */}
        <div className="space-y-8">
          {offices.map((office, idx) => (
            <div key={office.id} className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`office-${office.id}`}>
              <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                    Office {idx + 1}
                  </div>
                  <h2 className="font-semibold text-foreground">{office.title}</h2>
                  {office.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{office.description}</p>
                  )}
                </div>
                {selections[office.id] !== undefined && (
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                )}
              </div>

              <div className="divide-y divide-border">
                {office.candidates.map((candidate) => {
                  const selected = selections[office.id] === candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      onClick={() => handleSelect(office.id, candidate.id)}
                      className={cn(
                        "w-full flex items-center gap-4 px-6 py-4 text-left transition-colors",
                        selected
                          ? "bg-primary/8 border-l-4 border-l-primary"
                          : "hover:bg-muted/50 border-l-4 border-l-transparent",
                      )}
                      data-testid={`candidate-${candidate.id}`}
                    >
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                          selected
                            ? "border-primary bg-primary"
                            : "border-border",
                        )}
                      >
                        {selected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground">{candidate.fullName}</div>
                        {candidate.level && (
                          <div className="text-xs text-muted-foreground">{candidate.level}</div>
                        )}
                        {candidate.bio && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{candidate.bio}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="mt-10 pt-6 border-t border-border">
          {!allSelected && (
            <p className="text-sm text-muted-foreground text-center mb-4">
              Please select a candidate for every office before proceeding.
            </p>
          )}
          <Button
            className="w-full"
            size="lg"
            disabled={!allSelected}
            onClick={handleReview}
            data-testid="button-review-ballot"
          >
            Review My Ballot <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </main>
    </div>
  );
}
