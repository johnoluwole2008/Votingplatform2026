import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Trophy, BarChart3, Loader2, Lock, ArrowLeft, CheckCircle, PieChart as PieIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

interface Candidate {
  candidateId: number;
  candidateName: string;
  bio: string | null;
  level: string | null;
  voteCount: number;
  percentage: number;
  isWinner: boolean;
  isTie: boolean;
}

interface OfficeResult {
  officeId: number;
  officeTitle: string;
  description: string | null;
  totalVotes: number;
  candidates: Candidate[];
}

interface ResultsResponse {
  phase: string;
  electionName: string;
  results: OfficeResult[];
}

const CHART_COLORS = [
  "hsl(183,100%,38%)",
  "hsl(200,80%,50%)",
  "hsl(160,65%,42%)",
  "hsl(220,70%,58%)",
  "hsl(280,55%,55%)",
  "hsl(40,80%,55%)",
];

function usePublicResults() {
  return useQuery<ResultsResponse, Error>({
    queryKey: ["election-results-public"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/election/results`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Results not available");
      }
      return res.json();
    },
    retry: false,
    refetchInterval: 30_000,
  });
}

type ViewMode = "bars" | "bar-chart" | "pie-chart";

export default function ResultsPage() {
  const { data, isLoading, error } = usePublicResults();
  const [viewMode, setViewMode] = useState<ViewMode>("bars");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Election Results</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading results…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Results Not Available</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                {error.message === "Results not available"
                  ? "The electoral committee has not yet released the results."
                  : error.message}
              </p>
            </div>
            <Link href="/" className="text-sm text-primary hover:underline">
              Return to home
            </Link>
          </div>
        ) : data ? (
          <>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h1 className="text-2xl font-bold text-foreground">Results</h1>
                </div>
                <p className="text-sm text-muted-foreground">{data.electionName}</p>
              </div>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button
                  onClick={() => setViewMode("bars")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    viewMode === "bars" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" /> Progress
                </button>
                <button
                  onClick={() => setViewMode("bar-chart")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    viewMode === "bar-chart" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" /> Bar Chart
                </button>
                <button
                  onClick={() => setViewMode("pie-chart")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    viewMode === "pie-chart" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <PieIcon className="h-3.5 w-3.5" /> Pie Chart
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {data.results.map((office) => (
                <div
                  key={office.officeId}
                  className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-foreground">{office.officeTitle}</h2>
                      {office.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{office.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {office.totalVotes} vote{office.totalVotes !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="p-5">
                    {viewMode === "bars" && (
                      <div className="space-y-5">
                        {office.candidates.map((c, i) => (
                          <div key={c.candidateId}>
                            <div className="flex items-start justify-between mb-2 gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={cn(
                                  "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                  i === 0 && office.totalVotes > 0 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground",
                                )}>
                                  {i + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn("text-sm font-medium", c.isWinner ? "text-foreground" : "text-muted-foreground")}>
                                      {c.candidateName}
                                    </span>
                                    {c.level && <span className="text-xs text-muted-foreground">· {c.level}</span>}
                                    {c.isWinner && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                        <Trophy className="h-3 w-3" /> Winner
                                      </span>
                                    )}
                                    {c.isTie && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Tied</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <span className="text-sm font-semibold text-foreground">{c.percentage}%</span>
                                <p className="text-xs text-muted-foreground">{c.voteCount} votes</p>
                              </div>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={cn(
                                  "rounded-full h-2 transition-all duration-700",
                                  c.isWinner ? "bg-amber-400" : c.isTie ? "bg-amber-300" : "bg-primary/40",
                                )}
                                style={{ width: `${c.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                        {office.totalVotes === 0 && (
                          <p className="text-center text-sm text-muted-foreground py-2">No votes recorded yet.</p>
                        )}
                      </div>
                    )}

                    {viewMode === "bar-chart" && (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={[...office.candidates]
                            .sort((a, b) => b.voteCount - a.voteCount)
                            .map((c) => ({ name: c.candidateName, votes: c.voteCount, winner: c.isWinner }))}
                          margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: 12,
                            }}
                            formatter={(value: any) => [`${value} votes`, "Votes"]}
                          />
                          <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                            {office.candidates.map((c, i) => (
                              <Cell key={c.candidateId} fill={c.isWinner ? "hsl(43,80%,55%)" : CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}

                    {viewMode === "pie-chart" && (
                      office.totalVotes === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">No votes yet.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={office.candidates.map((c, i) => ({
                                name: c.candidateName,
                                value: c.voteCount,
                                fill: c.isWinner ? "hsl(43,80%,55%)" : CHART_COLORS[i % CHART_COLORS.length],
                              }))}
                              dataKey="value"
                              cx="50%"
                              cy="50%"
                              outerRadius={90}
                              label={({ name, percent }) =>
                                percent > 0.05 ? `${Math.round(percent * 100)}%` : ""
                              }
                              labelLine={false}
                            >
                              {office.candidates.map((c, i) => (
                                <Cell key={c.candidateId} fill={c.isWinner ? "hsl(43,80%,55%)" : CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Legend
                              iconType="circle"
                              iconSize={8}
                              formatter={(value) => (
                                <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{value}</span>
                              )}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                fontSize: 12,
                              }}
                              formatter={(value: any) => [`${value} votes`]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )
                    )}
                  </div>

                  {office.candidates.some((c) => c.isWinner) && (
                    <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2 dark:bg-amber-950/20 dark:border-amber-900">
                      <CheckCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <p className="text-sm text-amber-800 dark:text-amber-400">
                        <strong>{office.candidates.find((c) => c.isWinner)?.candidateName}</strong>
                        {" "}elected as{" "}
                        <strong>{office.officeTitle}</strong>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground mt-8">
              Results are updated every 30 seconds. Verified by the Faculty Electoral Committee.
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
