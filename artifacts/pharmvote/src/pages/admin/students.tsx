import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminSession } from "@/hooks/use-voter-session";
import { useListStudentRecords, useImportStudentRecords } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Upload, Loader2, Database, Info, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const CSV_TEMPLATE =
  "Full Name,Email,Matric Number,Level,Personal Code\n" +
  "Ada Okonkwo,ada.okonkwo@students.uniben.edu.ng,PHA/2024/001,100L,MyCode123\n" +
  "Emeka Nwosu,emeka.nwosu@students.uniben.edu.ng,24/214PNP/106,300L,Pass4567\n";

function parseRfc4180(text: string): string[][] {
  const rows: string[][] = [];
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let i = 0;
  while (i <= s.length) {
    const row: string[] = [];
    while (true) {
      if (i >= s.length || s[i] === "\n") break;
      if (s[i] === '"') {
        i++;
        let field = "";
        while (i < s.length) {
          if (s[i] === '"' && s[i + 1] === '"') { field += '"'; i += 2; }
          else if (s[i] === '"') { i++; break; }
          else { field += s[i++]; }
        }
        row.push(field);
      } else {
        let field = "";
        while (i < s.length && s[i] !== "," && s[i] !== "\n") field += s[i++];
        row.push(field.trim());
      }
      if (i < s.length && s[i] === ",") { i++; }
      else break;
    }
    if (i < s.length && s[i] === "\n") i++;
    else if (i > s.length) break;
    if (row.length > 0 && row.some((f) => f.length > 0)) rows.push(row);
    if (i >= s.length) break;
  }
  return rows;
}

function normalizeLevel(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d{3}L$/.test(s)) return s;
  if (/^\d{3}$/.test(s)) {
    const n = parseInt(s, 10);
    if ([100, 200, 300, 400, 500, 600].includes(n)) return n + "L";
  }
  const m = s.match(/(\d{3})/);
  if (m) {
    const n = parseInt(m[1], 10);
    if ([100, 200, 300, 400, 500, 600].includes(n)) return n + "L";
  }
  if (/^[1-6]$/.test(s)) return parseInt(s, 10) * 100 + "L";
  return raw.trim();
}

function detectColIdx(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const c of candidates) {
    const cn = c.toLowerCase().replace(/[^a-z0-9]/g, "");
    const idx = normalized.findIndex((h) => h.includes(cn) || cn.includes(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

type ParsedRecord = { fullName: string; email: string; matricNumber: string; level: string; personalCode?: string };

function parseCsv(text: string): { records: ParsedRecord[]; skipped: number; headerMap: Record<string, number> } {
  const rows = parseRfc4180(text);
  if (rows.length < 2) return { records: [], skipped: 0, headerMap: {} };
  const headers = rows[0];
  const nameIdx = detectColIdx(headers, ["fullname", "name", "studentname", "candidate"]);
  const emailIdx = detectColIdx(headers, ["email", "emailaddress", "mail"]);
  const matricIdx = detectColIdx(headers, ["matric", "matricnumber", "matricno", "studentid", "regnum", "registration"]);
  const levelIdx = detectColIdx(headers, ["level", "academiclevel", "class", "year"]);
  const codeIdx = detectColIdx(headers, ["personalcode", "code", "password", "pin", "accesscode", "passphrase"]);
  const fi = nameIdx !== -1 ? nameIdx : 0;
  const ei = emailIdx !== -1 ? emailIdx : 1;
  const mi = matricIdx !== -1 ? matricIdx : 2;
  const li = levelIdx !== -1 ? levelIdx : 3;
  const validLevels = ["100L", "200L", "300L", "400L", "500L", "600L"];
  const records: ParsedRecord[] = [];
  let skipped = 0;
  for (const parts of rows.slice(1)) {
    const fullName = parts[fi]?.trim() ?? "";
    const email = parts[ei]?.trim() ?? "";
    const matricNumber = (parts[mi]?.trim() ?? "").toUpperCase();
    const rawLevel = parts[li]?.trim() ?? "";
    const personalCode = codeIdx !== -1 ? parts[codeIdx]?.trim() : undefined;
    if (!fullName || !email || !matricNumber || !rawLevel) { skipped++; continue; }
    const level = normalizeLevel(rawLevel);
    if (!validLevels.includes(level)) { skipped++; continue; }
    records.push({ fullName, email, matricNumber, level, ...(personalCode && personalCode.length > 0 ? { personalCode } : {}) });
  }
  return { records, skipped, headerMap: { name: fi, email: ei, matric: mi, level: li, code: codeIdx } };
}

const LEVELS = ["100L", "200L", "300L", "400L", "500L", "600L"];

export default function AdminStudentsPage() {
  const session = useAdminSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListStudentRecords({
    page, limit: 50,
    ...(search ? { search } : {}),
    ...(level !== "all" ? { level } : {}),
  });

  const importRecords = useImportStudentRecords();
  const isObserver = session.data?.role === "observer";

  // Clear dialog
  const [clearOpen, setClearOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  // Manual add
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: "", email: "", matricNumber: "", level: "100L", personalCode: "" });
  const [isAdding, setIsAdding] = useState(false);

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "student-records-template.csv"; a.click();
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const { records, skipped } = parseCsv(text);
      if (records.length === 0) {
        toast({ title: "No valid records found", description: `${skipped} row(s) skipped. Check columns: Name, Email, Matric Number, Level.`, variant: "destructive" });
        return;
      }
      importRecords.mutate({ data: { records } }, {
        onSuccess: (result: any) => {
          queryClient.invalidateQueries({ queryKey: ["listStudentRecords"] });
          toast({ title: "Import complete", description: `Imported ${result.imported} records${skipped > 0 ? `, ${skipped} skipped` : ""}.` });
        },
        onError: (err: any) => toast({ title: "Import failed", description: err?.response?.data?.error ?? "Import failed", variant: "destructive" }),
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      const r = await fetch("/api/admin/student-records", {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "CLEAR" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      queryClient.invalidateQueries({ queryKey: ["listStudentRecords"] });
      toast({ title: "Records cleared", description: `${d.deleted} student records deleted.` });
      setClearOpen(false); setClearConfirmText("");
    } catch (err: any) {
      toast({ title: "Clear failed", description: err.message, variant: "destructive" });
    } finally { setIsClearing(false); }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    try {
      const r = await fetch("/api/admin/student-records/single", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      queryClient.invalidateQueries({ queryKey: ["listStudentRecords"] });
      toast({ title: "Student added", description: `${addForm.fullName} has been added.` });
      setAddOpen(false);
      setAddForm({ fullName: "", email: "", matricNumber: "", level: "100L", personalCode: "" });
    } catch (err: any) {
      toast({ title: "Add failed", description: err.message, variant: "destructive" });
    } finally { setIsAdding(false); }
  };

  return (
    <AdminLayout role={session.data?.role}>
      <div className="px-6 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Student Records</h1>
            {data && <p className="text-sm text-muted-foreground mt-0.5">{data.total.toLocaleString()} students on record</p>}
          </div>
          {!isObserver && (
            <div className="flex gap-2 flex-wrap justify-end">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>Download Template</Button>
              <label>
                <Button variant="outline" size="sm" asChild disabled={importRecords.isPending}>
                  <span className="cursor-pointer">
                    {importRecords.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Import CSV
                  </span>
                </Button>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} disabled={importRecords.isPending} />
              </label>
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />Add Student
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setClearOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />Clear All
              </Button>
            </div>
          )}
        </div>

        {!isObserver && (
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-6 text-sm">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">CSV Import Tips:</span>{" "}
              Headers are auto-detected — column order doesn't matter.
              Levels like <code className="text-xs bg-muted px-1 rounded">100</code>, <code className="text-xs bg-muted px-1 rounded">200 Level</code>, <code className="text-xs bg-muted px-1 rounded">300L</code> are accepted.
              Use <span className="font-medium text-foreground">Clear All</span> before importing records for a new election cycle.
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or matric number..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={level} onValueChange={(v) => { setLevel(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !data || data.students.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search || level !== "all" ? "No students match your filters." : "No student records yet. Import a CSV or add manually."}</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Matric Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Level</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Voted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.students.map((s: any) => (
                    <tr key={s.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground">{s.fullName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.matricNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{s.level}</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.hasVoted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Voted</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.total > 50 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
                  <p className="text-xs text-muted-foreground">Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, data.total)} of {data.total}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page * 50 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Clear All dialog */}
      <Dialog open={clearOpen} onOpenChange={(o) => { if (!o) { setClearOpen(false); setClearConfirmText(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Clear All Student Records?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>all {data?.total ?? ""} student records</strong>, including registration passwords and voting status. This cannot be undone.
              Use this to reset before a new election cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-foreground block mb-1.5">Type <strong>CLEAR</strong> to confirm</label>
            <Input value={clearConfirmText} onChange={e => setClearConfirmText(e.target.value)} placeholder="CLEAR" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setClearOpen(false); setClearConfirmText(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleClear} disabled={clearConfirmText !== "CLEAR" || isClearing}>
              {isClearing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Clearing…</> : "Clear All Records"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Student dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Student Manually</DialogTitle>
            <DialogDescription>Add a single student to the records. They can then register using these details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddStudent} className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Full Name</label>
              <Input required placeholder="e.g. Ada Okonkwo" value={addForm.fullName} onChange={e => setAddForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">School Email</label>
              <Input required type="email" placeholder="ada@students.pharmsci.edu.ng" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Matric Number</label>
                <Input required placeholder="PHA/2024/001" value={addForm.matricNumber} onChange={e => setAddForm(f => ({ ...f, matricNumber: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Level</label>
                <Select value={addForm.level} onValueChange={v => setAddForm(f => ({ ...f, level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Personal Code (optional)</label>
              <Input placeholder="Pre-set their voting password" value={addForm.personalCode} onChange={e => setAddForm(f => ({ ...f, personalCode: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Leave blank — student sets their own during registration.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isAdding}>
                {isAdding ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adding…</> : "Add Student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
