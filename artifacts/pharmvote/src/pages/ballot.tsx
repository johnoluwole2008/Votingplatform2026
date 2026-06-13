import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetBallot, getGetBallotQueryOptions } from "@workspace/api-client-react";
import { useVoterSession } from "@/hooks/use-voter-session";
import { Loader2, Shield, CheckCircle, AlertCircle, ChevronRight, MinusCircle, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export default function BallotPage() {
  const [, setLocation] = useLocation();
  const session = useVoterSession();
  const ballot = useGetBallot({
    query: { ...getGetBallotQueryOptions(), enabled: !!session.data, retry: false },
  });
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [abstained, setAbstained] = useState<Set<number>>(new Set());
  const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (!expandedPhoto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpandedPhoto(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedPhoto]);

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
  const doneCount = selectedCount + abstained.size;
  const allDone = doneCount === totalOffices;

  const handleSelect = (officeId: number, candidateId: number) => {
    setSelections((s) => ({ ...s, [officeId]: candidateId }));
    setAbstained((a) => { const next = new Set(a); next.delete(officeId); return next; });
  };

  const handleAbstain = (officeId: number) => {
    setAbstained((a) => { const next = new Set(a); next.add(officeId); return next; });
    setSelections((s) => { const next = { ...s }; delete next[officeId]; return next; });
  };

  const handleReview = () => {
    sessionStorage.setItem("ballot_selections", JSON.stringify(selections));
    // Strip photoUrl (can be large base64) — review page only needs id/title/name/level
    const slimOffices = offices.map((o) => ({
      id: o.id,
      title: o.title,
      candidates: o.candidates.map((c) => ({ id: c.id, fullName: c.fullName, level: c.level ?? null })),
    }));
    sessionStorage.setItem("ballot_offices", JSON.stringify(slimOffices));
    sessionStorage.setItem("ballot_abstained", JSON.stringify([...abstained]));
    setLocation("/ballot/review");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Photo lightbox */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpandedPhoto(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={expandedPhoto.url}
              alt={expandedPhoto.name}
              className="w-full rounded-xl object-cover shadow-2xl"
            />
            <div className="mt-3 text-center text-white font-medium text-sm">{expandedPhoto.name}</div>
          </div>
        </div>
      )}
      <header className="border-b border-border bg-card px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Faculty Elections — Ballot</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{doneCount} / {totalOffices} complete</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Your Ballot</h1>
          <p className="text-sm text-muted-foreground">
            Hello <strong className="text-foreground">{voterName}</strong> ({voterLevel}). Select a candidate or abstain for each office.
          </p>
        </div>

        {/* Progress */}
        <div className="bg-card border border-border rounded-lg p-4 mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{doneCount} of {totalOffices} offices</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all duration-300"
              style={{ width: `${(doneCount / totalOffices) * 100}%` }}
            />
          </div>
        </div>

        {/* Offices */}
        <div className="space-y-8">
          {offices.map((office, idx) => {
            const isAbstained = abstained.has(office.id);
            const hasSelection = selections[office.id] !== undefined;
            const isDone = isAbstained || hasSelection;
            return (
              <div key={office.id} className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`office-${office.id}`}>
                <div className={cn(
                  "px-6 py-4 border-b border-border flex items-center justify-between",
                  isAbstained ? "bg-orange-50 dark:bg-orange-950/20" : "bg-muted/30"
                )}>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                      Office {idx + 1}
                    </div>
                    <h2 className="font-semibold text-foreground">{office.title}</h2>
                    {office.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{office.description}</p>
                    )}
                  </div>
                  {isDone && (
                    isAbstained
                      ? <MinusCircle className="h-5 w-5 text-orange-500 shrink-0" />
                      : <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  )}
                </div>

                <div className={cn("divide-y divide-border", isAbstained && "opacity-50 pointer-events-none")}>
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
                        {/* Photo or radio */}
                        {(candidate as any).photoUrl ? (
                          <div className="relative group shrink-0">
                            <img
                              src={(candidate as any).photoUrl}
                              alt={candidate.fullName}
                              className="h-10 w-10 rounded-full object-cover border-2 border-border cursor-zoom-in"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPhoto({ url: (candidate as any).photoUrl, name: candidate.fullName });
                              }}
                            />
                            <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                              <ZoomIn className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                              selected ? "border-primary bg-primary" : "border-border",
                            )}
                          >
                            {selected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {(candidate as any).photoUrl && (
                              <div className={cn(
                                "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                                selected ? "border-primary bg-primary" : "border-border",
                              )}>
                                {selected && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                              </div>
                            )}
                            <div className="font-medium text-sm text-foreground">{candidate.fullName}</div>
                          </div>
                          {candidate.level && (
                            <div className="text-xs text-muted-foreground mt-0.5">{candidate.level}</div>
                          )}
                          {candidate.bio && (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{candidate.bio}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Abstain option */}
                <div className={cn(
                  "px-6 py-3 border-t border-dashed border-border flex items-center justify-between",
                  isAbstained ? "bg-orange-50/50 dark:bg-orange-950/10" : ""
                )}>
                  <button
                    onClick={() => isAbstained ? undefined : handleAbstain(office.id)}
                    className={cn(
                      "flex items-center gap-2 text-xs transition-colors",
                      isAbstained
                        ? "text-orange-600 font-medium cursor-default"
                        : "text-muted-foreground hover:text-orange-500",
                    )}
                    disabled={isAbstained}
                    data-testid={`abstain-${office.id}`}
                  >
                    <MinusCircle className="h-3.5 w-3.5" />
                    {isAbstained ? "Abstained from this office" : "Abstain from this office"}
                  </button>
                  {isAbstained && (
                    <button
                      onClick={() => setAbstained((a) => { const next = new Set(a); next.delete(office.id); return next; })}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Undo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit */}
        <div className="mt-10 pt-6 border-t border-border">
          {!allDone && (
            <p className="text-sm text-muted-foreground text-center mb-4">
              Please vote or abstain for every office before proceeding.
            </p>
          )}
          <Button
            className="w-full"
            size="lg"
            disabled={!allDone}
            onClick={handleReview}
            data-testid="button-review-ballot"
          >
            Review My Ballot <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
          {abstained.size > 0 && allDone && (
            <p className="text-xs text-center text-muted-foreground mt-3">
              You are abstaining from {abstained.size} office{abstained.size !== 1 ? "s" : ""}.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
