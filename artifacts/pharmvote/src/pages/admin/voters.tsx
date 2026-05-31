import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminSession } from "@/hooks/use-voter-session";
import { useListVoters, useDeleteVoter } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Download, Trash2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AdminVotersPage() {
  const session = useAdminSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [voted, setVoted] = useState("all");
  const [page, setPage] = useState(1);

  const params = {
    page,
    limit: 50,
    ...(search ? { search } : {}),
    ...(level !== "all" ? { level } : {}),
    ...(voted !== "all" ? { voted: voted === "yes" ? "true" : "false" } : {}),
  };

  const { data, isLoading } = useListVoters(params);
  const deleteVoter = useDeleteVoter();

  const isObserver = session.data?.role === "observer";

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete ${name}'s registration? This cannot be undone.`)) return;
    deleteVoter.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listVoters"] });
          toast({ title: "Voter deleted", description: `${name}'s registration has been removed.` });
        },
        onError: () => {
          toast({ title: "Delete failed", variant: "destructive" });
        },
      },
    );
  };

  const handleExport = () => {
    window.location.href = "/api/admin/voters/export";
  };

  return (
    <AdminLayout role={session.data?.role}>
      <div className="px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Voter Registrations</h1>
            {data && <p className="text-sm text-muted-foreground mt-0.5">{data.total.toLocaleString()} total registered voters</p>}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or matric..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              data-testid="input-search"
            />
          </div>
          <Select value={level} onValueChange={(v) => { setLevel(v); setPage(1); }}>
            <SelectTrigger className="w-36" data-testid="select-level">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {["100L", "200L", "300L", "400L", "500L", "600L"].map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={voted} onValueChange={(v) => { setVoted(v); setPage(1); }}>
            <SelectTrigger className="w-36" data-testid="select-voted">
              <SelectValue placeholder="All Voters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Has Voted</SelectItem>
              <SelectItem value="no">Not Yet Voted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !data || data.voters.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No voters found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Matric No.</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Level</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Registered</th>
                    {!isObserver && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.voters.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/20 transition-colors" data-testid={`voter-row-${v.id}`}>
                      <td className="px-4 py-3 font-medium text-foreground">{v.fullName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.matricNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.level}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{v.email}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", v.hasVoted ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                          {v.hasVoted ? "Voted" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(v.registrationTimestamp).toLocaleDateString()}
                      </td>
                      {!isObserver && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDelete(v.id, v.fullName)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            data-testid={`button-delete-voter-${v.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {data && data.total > data.limit && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>Showing {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {data.total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * data.limit >= data.total}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
