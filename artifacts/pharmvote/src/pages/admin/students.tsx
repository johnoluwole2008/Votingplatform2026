import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminSession } from "@/hooks/use-voter-session";
import { useListStudentRecords, useImportStudentRecords } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Upload, Loader2, Database, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CSV_TEMPLATE = "matric_number,email,full_name,level\nPHA/2024/001,student001@faculty.edu,Full Student Name,100L\n";

function parseCsv(text: string): { matricNumber: string; email: string; fullName: string; level: string }[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  return lines.slice(1).flatMap((line) => {
    const parts = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    if (parts.length < 4) return [];
    const [matricNumber, email, fullName, level] = parts;
    if (!matricNumber || !email || !fullName || !level) return [];
    return [{ matricNumber, email, fullName, level }];
  });
}

export default function AdminStudentsPage() {
  const session = useAdminSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListStudentRecords({
    page,
    limit: 50,
    ...(search ? { search } : {}),
    ...(level !== "all" ? { level } : {}),
  });

  const importRecords = useImportStudentRecords();
  const isObserver = session.data?.role === "observer";

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-records-template.csv";
    a.click();
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const records = parseCsv(text);
      if (records.length === 0) {
        toast({ title: "Import failed", description: "No valid records found in CSV.", variant: "destructive" });
        return;
      }

      importRecords.mutate(
        { data: { records } },
        {
          onSuccess: (result: any) => {
            queryClient.invalidateQueries({ queryKey: ["listStudentRecords"] });
            toast({
              title: "Import complete",
              description: `Imported ${result.imported} records${result.errors > 0 ? `, ${result.errors} errors` : ""}.`,
            });
          },
          onError: () => {
            toast({ title: "Import failed", variant: "destructive" });
          },
        },
      );
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <AdminLayout role={session.data?.role}>
      <div className="px-6 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Student Records</h1>
            {data && (
              <p className="text-sm text-muted-foreground mt-0.5">{data.total.toLocaleString()} students on record</p>
            )}
          </div>
          {!isObserver && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="button-download-template">
                Download Template
              </Button>
              <label>
                <Button
                  variant="default"
                  size="sm"
                  asChild
                  disabled={importRecords.isPending}
                  data-testid="button-import"
                >
                  <span className="cursor-pointer">
                    {importRecords.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Import CSV
                  </span>
                </Button>
                <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
              </label>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6 text-sm text-muted-foreground">
          Student records are the <strong className="text-foreground">source of truth</strong> used to verify voter registrations.
          Import your official student list here before opening registration. The CSV must have columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">matric_number, email, full_name, level</code>.
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
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
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !data || data.students.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No student records yet.</p>
              {!isObserver && (
                <p className="text-xs mt-1">Import a CSV file to populate the student list.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Matric No.</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Full Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Level</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Registered?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.students.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors" data-testid={`student-row-${s.id}`}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.matricNumber}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{s.fullName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.level}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{s.email}</td>
                      <td className="px-4 py-3">
                        {s.isRegistered ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                            <CheckCircle className="h-3.5 w-3.5" /> Registered
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not yet</span>
                        )}
                      </td>
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
