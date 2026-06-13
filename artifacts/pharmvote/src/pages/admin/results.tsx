import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminSession } from "@/hooks/use-voter-session";
import { useGetElectionResults } from "@workspace/api-client-react";
import { Loader2, Download, Trophy, BarChart3, PieChart as PieIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const CHART_COLORS = [
  "hsl(183,100%,38%)",
  "hsl(200,80%,50%)",
  "hsl(160,65%,42%)",
  "hsl(220,70%,58%)",
  "hsl(280,55%,55%)",
  "hsl(40,80%,55%)",
];

type ViewMode = "bars" | "bar-chart" | "pie-chart";

export default function AdminResultsPage() {
  const session = useAdminSession();
  const { data, isLoading, dataUpdatedAt } = useGetElectionResults({ query: { refetchInterval: 10_000 } });
  const [viewMode, setViewMode] = useState<ViewMode>("bars");

  const handleExport = (format: "csv" | "pdf") => {
    window.location.href = `/api/admin/results/export?format=${format}`;
  };

  return (
    <AdminLayout role={session.data?.role}>
      <div className="px-6 py-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Election Results</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <p className="text-sm text-muted-foreground">
                Live — refreshes every 10s
                {dataUpdatedAt > 0 && (
                  <span className="ml-1 text-xs">
                    · updated {Math.round((Date.now() - dataUpdatedAt) / 1000)}s ago
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode("bars")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                  viewMode === "bars" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BarChart3 className="h-3 w-3" /> Bars
              </button>
              <button
                onClick={() => setViewMode("bar-chart")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                  viewMode === "bar-chart" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BarChart3 className="h-3 w-3" /> Bar
              </button>
              <button
                onClick={() => setViewMode("pie-chart")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                  viewMode === "pie-chart" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <PieIcon className="h-3 w-3" /> Pie
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleExport("csv")} data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} data-testid="button-export-pdf">
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
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

                <div className="p-5">
                  {viewMode === "bars" && (
                    <div className="space-y-4">
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
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
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
                  )}

                  {viewMode === "bar-chart" && (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={[...office.candidates]
                          .sort((a, b) => b.voteCount - a.voteCount)
                          .map((c) => ({ name: c.candidateName, votes: c.voteCount }))}
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
                            }))}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            outerRadius={85}
                            label={({ percent }) =>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
