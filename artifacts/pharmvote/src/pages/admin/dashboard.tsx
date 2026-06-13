import AdminLayout from "@/components/admin-layout";
import { useGetDashboardStats, useGetTurnoutTimeline, useGetResultsPreview, getGetDashboardStatsQueryOptions } from "@workspace/api-client-react";
import { useAdminSession } from "@/hooks/use-voter-session";
import { Loader2, Users, Vote, TrendingUp, Activity, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function StatCard({ label, value, sub, icon: Icon, color = "text-primary" }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: any;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-sm text-muted-foreground font-medium">{label}</div>
        <div className={`h-8 w-8 rounded-md bg-muted flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const styles: Record<string, string> = {
    setup: "bg-muted text-muted-foreground",
    registration: "bg-emerald-100 text-emerald-800",
    voting: "bg-primary/20 text-primary",
    results: "bg-amber-100 text-amber-800",
    audit: "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    setup: "Setup Mode",
    registration: "Registration Open",
    voting: "Voting Open",
    results: "Results Phase",
    audit: "Audit Phase",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[phase] ?? styles.setup}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${phase === "voting" ? "bg-primary animate-pulse" : "bg-current opacity-50"}`} />
      {labels[phase] ?? phase}
    </span>
  );
}

export default function AdminDashboardPage() {
  const session = useAdminSession();
  const stats = useGetDashboardStats({
    query: { ...getGetDashboardStatsQueryOptions(), refetchInterval: 15000 },
  });
  const timeline = useGetTurnoutTimeline({ query: { refetchInterval: 30_000 } });
  const preview = useGetResultsPreview({ query: { refetchInterval: 30_000 } });
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <AdminLayout role={session.data?.role}>
      <div className="px-6 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Live Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {stats.data ? <PhaseBadge phase={stats.data.phase} /> : "Loading status..."}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Stat Cards */}
        {stats.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : stats.data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Registered Voters"
                value={stats.data.totalRegistered.toLocaleString()}
                sub={`of ${stats.data.totalExpected} expected (${stats.data.registrationRate}%)`}
                icon={Users}
              />
              <StatCard
                label="Votes Cast"
                value={stats.data.totalVoted.toLocaleString()}
                sub={`${stats.data.turnoutRate}% turnout among registered`}
                icon={Vote}
                color="text-emerald-600"
              />
              <StatCard
                label="Turnout Rate"
                value={`${stats.data.turnoutRate}%`}
                sub="of registered voters have voted"
                icon={TrendingUp}
                color="text-amber-600"
              />
              <StatCard
                label="Election Status"
                value={stats.data.votingOpen ? "Voting Open" : stats.data.registrationOpen ? "Registration" : stats.data.phase}
                sub={stats.data.votingOpen ? "Accepting ballots now" : ""}
                icon={Activity}
                color={stats.data.votingOpen ? "text-primary" : "text-muted-foreground"}
              />
            </div>

            {/* Level breakdown */}
            <div className="bg-card border border-border rounded-lg p-5 mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-4">Participation by Level</h2>
              <div className="space-y-3">
                {stats.data.byLevel.map((row) => {
                  const regPct = stats.data.totalExpected > 0
                    ? Math.round((row.registered / (stats.data.totalExpected / 6)) * 100)
                    : 0;
                  const votedPct = row.registered > 0 ? Math.round((row.voted / row.registered) * 100) : 0;
                  return (
                    <div key={row.level} data-testid={`level-${row.level}`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-foreground">{row.level}</span>
                        <span className="text-muted-foreground">
                          {row.voted} voted / {row.registered} registered
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 relative">
                        <div
                          className="bg-primary/30 rounded-full h-2 absolute left-0 top-0"
                          style={{ width: `${Math.min(regPct, 100)}%` }}
                        />
                        <div
                          className="bg-primary rounded-full h-2 absolute left-0 top-0"
                          style={{ width: row.registered > 0 ? `${Math.min((row.voted / row.registered) * 100, 100)}%` : "0%" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}

        {/* Results preview */}
        {preview.data && preview.data.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Preliminary Results</h2>
            <div className="space-y-5">
              {preview.data.map((office) => (
                <div key={office.officeId}>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{office.officeTitle}</div>
                  <div className="space-y-1.5">
                    {[...office.candidates]
                      .sort((a, b) => b.voteCount - a.voteCount)
                      .map((c) => (
                        <div key={c.candidateId} className="flex items-center gap-3">
                          <div className="w-28 text-xs text-foreground font-medium truncate">{c.candidateName}</div>
                          <div className="flex-1 bg-muted rounded-full h-2 relative">
                            <div
                              className={`rounded-full h-2 transition-all ${c.isWinner ? "bg-emerald-500" : c.isTie ? "bg-amber-400" : "bg-primary/50"}`}
                              style={{ width: `${c.percentage}%` }}
                            />
                          </div>
                          <div className="w-16 text-right text-xs text-muted-foreground">{c.voteCount} ({c.percentage}%)</div>
                          {c.isWinner && <span className="text-xs text-emerald-600 font-medium">Leading</span>}
                          {c.isTie && <span className="text-xs text-amber-600 font-medium">Tie</span>}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
