import AdminLayout from "@/components/admin-layout";
import { useAdminSession } from "@/hooks/use-voter-session";
import { useGetElectionResults } from "@workspace/api-client-react";
import { Loader2, Download, Trophy, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminResultsPage() {
  const session = useAdminSession();
  const { data, isLoading } = useGetElectionResults();

  const handleExport = () => {
    window.location.href = "/api/admin/results/export";
  };

  return (
    <AdminLayout role={session.data?.role}>
      <div className="px-6 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Election Results</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Live vote counts per office</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No results yet. Set up offices and candidates first.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.map((office) => (
              <div key={office.officeId} className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`office-results-${office.officeId}`}>
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">{office.officeTitle}</h2>
                  <span className="text-xs text-muted-foreground">{office.totalVotes} total votes</span>
                </div>
                <div className="p-5 space-y-4">
                  {[...office.candidates]
                    .sort((a, b) => b.voteCount - a.voteCount)
                    .map((c) => (
                      <div key={c.candidateId} data-testid={`candidate-result-${c.candidateId}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            {c.isWinner && <Trophy className="h-4 w-4 text-amber-500" />}
                            <span className={cn("text-sm font-medium", c.isWinner ? "text-foreground" : "text-muted-foreground")}>
                              {c.candidateName}
                            </span>
                            {c.isWinner && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                Winner
                              </span>
                            )}
                            {c.isTie && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                Tie
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {c.voteCount} <span className="text-xs text-muted-foreground font-normal">({c.percentage}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div
                            className={cn(
                              "rounded-full h-2.5 transition-all",
                              c.isWinner ? "bg-amber-400" : c.isTie ? "bg-amber-300" : "bg-primary/50",
                            )}
                            style={{ width: `${c.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
