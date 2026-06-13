import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminSession } from "@/hooks/use-voter-session";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Loader2, Download, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EVENT_TYPES = [
  "registration_success",
  "registration_failed",
  "login_success",
  "login_failed",
  "vote_cast",
  "admin_login",
  "admin_logout",
  "admin_login_failed",
  "office_created",
  "office_updated",
  "office_deleted",
  "candidate_created",
  "candidate_deleted",
  "voter_record_edited",
  "voter_registration_deleted",
  "settings_updated",
  "admin_account_created",
  "admin_account_deleted",
  "student_records_imported",
];

const EVENT_COLORS: Record<string, string> = {
  registration_success: "bg-emerald-100 text-emerald-700",
  login_success: "bg-blue-100 text-blue-700",
  vote_cast: "bg-primary/10 text-primary",
  admin_login: "bg-purple-100 text-purple-700",
  registration_failed: "bg-amber-100 text-amber-700",
  login_failed: "bg-destructive/10 text-destructive",
  admin_login_failed: "bg-destructive/10 text-destructive",
  voter_registration_deleted: "bg-destructive/10 text-destructive",
  admin_account_deleted: "bg-destructive/10 text-destructive",
};

export default function AdminAuditPage() {
  const session = useAdminSession();
  const [eventType, setEventType] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListAuditLogs(
    { page, limit: 50, ...(eventType !== "all" ? { event: eventType } : {}) },
    { query: { refetchInterval: 15_000 } },
  );

  const handleExport = () => {
    window.location.href = "/api/admin/audit-logs/export";
  };

  return (
    <AdminLayout role={session.data?.role}>
      <div className="px-6 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
            {data && <p className="text-sm text-muted-foreground mt-0.5">{data.total.toLocaleString()} total events</p>}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="mb-4">
          <Select value={eventType} onValueChange={(v) => { setEventType(v); setPage(1); }}>
            <SelectTrigger className="w-60" data-testid="select-event-type">
              <SelectValue placeholder="All Event Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Event Types</SelectItem>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <ScrollText className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No audit events found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Event</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors" data-testid={`log-row-${log.id}`}>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          EVENT_COLORS[log.eventType] ?? "bg-muted text-muted-foreground"
                        )}>
                          {log.eventType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-xs truncate">{log.description}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {log.actorId ?? "—"} <span className="opacity-50">({log.actorType})</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{log.ipAddress ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
