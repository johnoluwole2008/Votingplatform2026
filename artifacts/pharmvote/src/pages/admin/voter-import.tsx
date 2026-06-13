import { useState, useRef } from "react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGetAdminSession } from "@workspace/api-client-react";
import { Upload, FileText, CheckCircle2, AlertCircle, X, Info } from "lucide-react";

const LEVEL_HINTS = ["100L", "200L", "300L", "400L", "500L", "600L"];

interface PreviewRow {
  matric: string;
  fullName: string;
  email: string;
  level: string;
}

interface PreviewResult {
  totalRows: number;
  preview: PreviewRow[];
  errors: string[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export default function AdminVoterImportPage() {
  const { data: me } = useGetAdminSession({ query: { retry: false } });
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [csvText, setCsvText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [hasHeader, setHasHeader] = useState(true);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState({ matric: 0, fullName: 1, email: 2, level: 3 });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const firstLine = text.split(/\r?\n/)[0] ?? "";
      const cols = firstLine.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      setHeaders(cols);
      autoDetectColumns(cols);
    };
    reader.readAsText(file);
  };

  const autoDetectColumns = (cols: string[]) => {
    const find = (keywords: string[]) =>
      cols.findIndex((c) =>
        keywords.some((k) => c.toLowerCase().includes(k.toLowerCase()))
      );
    const matricIdx = find(["matric", "reg", "registration"]);
    const nameIdx = find(["name", "full"]);
    const emailIdx = find(["email", "mail"]);
    const levelIdx = find(["level", "class", "year"]);
    setColumnMap({
      matric: matricIdx >= 0 ? matricIdx : 0,
      fullName: nameIdx >= 0 ? nameIdx : 1,
      email: emailIdx >= 0 ? emailIdx : 2,
      level: levelIdx >= 0 ? levelIdx : 3,
    });
  };

  const postJson = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
    return json;
  };

  const handlePreview = async () => {
    if (!csvText) return;
    setIsPreviewing(true);
    try {
      const data = await postJson("/api/admin/voter-import/preview", { csv: csvText, columnMap, hasHeader });
      setPreview(data);
    } catch (err: any) {
      toast({ title: "Preview failed", description: err?.message ?? "Could not parse CSV.", variant: "destructive" });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!csvText || !preview) return;
    setIsImporting(true);
    try {
      const data = await postJson("/api/admin/voter-import/csv", { csv: csvText, columnMap, hasHeader });
      setImportResult(data);
      setPreview(null);
      toast({ title: "Import complete", description: `${data.imported} records imported, ${data.skipped} skipped.` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err?.message ?? "Import failed. Try again.", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setCsvText("");
    setFileName("");
    setHeaders([]);
    setPreview(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <AdminLayout role={me?.role}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Voter Import</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bulk-import voter registrations from a CSV file (e.g., Google Form responses). Imported students
            will need to complete their registration on the website to set a voting password.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex gap-2"><span className="text-primary font-bold">1.</span><span>Export your Google Form responses as a CSV file.</span></div>
            <div className="flex gap-2"><span className="text-primary font-bold">2.</span><span>Upload the CSV here and map the columns to the required fields.</span></div>
            <div className="flex gap-2"><span className="text-primary font-bold">3.</span><span>Preview the data, then click Import.</span></div>
            <div className="flex gap-2"><span className="text-primary font-bold">4.</span><span>Imported students visit the registration page to set their voting password. Their matric + email will be recognised automatically.</span></div>
            <div className="flex items-start gap-2 mt-3 p-3 rounded-md bg-muted">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span>Level values in the CSV must be one of: {LEVEL_HINTS.join(", ")}. If they don't match, those rows will be skipped.</span>
            </div>
          </CardContent>
        </Card>

        {!importResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload CSV</CardTitle>
              <CardDescription>Select a CSV file from your Google Form export or any spreadsheet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!csvText ? (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-10 cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                  <span className="text-sm font-medium text-foreground">Click to upload CSV</span>
                  <span className="text-xs text-muted-foreground mt-1">Supports comma-separated .csv files</span>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
                </label>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm font-medium flex-1 truncate">{fileName}</span>
                  <button onClick={handleReset} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {csvText && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      id="hasHeader"
                      type="checkbox"
                      checked={hasHeader}
                      onChange={(e) => setHasHeader(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="hasHeader" className="text-sm text-foreground cursor-pointer">
                      First row is a header (column names)
                    </label>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Map columns</p>
                    <p className="text-xs text-muted-foreground">
                      Tell us which column in your CSV corresponds to each field. Column numbers start at 0.
                    </p>
                    {headers.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {headers.map((h, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{i}: {h}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {(["matric", "fullName", "email", "level"] as const).map((field) => (
                        <div key={field} className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground capitalize">
                            {field === "fullName" ? "Full Name" : field === "matric" ? "Matric Number" : field.charAt(0).toUpperCase() + field.slice(1)}
                          </label>
                          <select
                            value={columnMap[field]}
                            onChange={(e) => setColumnMap((prev) => ({ ...prev, [field]: Number(e.target.value) }))}
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {headers.length > 0
                              ? headers.map((h, i) => (
                                  <option key={i} value={i}>{i}: {h}</option>
                                ))
                              : Array.from({ length: 10 }, (_, i) => (
                                  <option key={i} value={i}>Column {i}</option>
                                ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handlePreview} disabled={isPreviewing} className="w-full">
                    {isPreviewing ? "Parsing..." : "Preview Import"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {preview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Preview
                <Badge variant="outline">{preview.totalRows} rows total</Badge>
              </CardTitle>
              <CardDescription>First 5 rows shown. Review before importing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Matric</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Full Name</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs">{row.matric}</td>
                        <td className="px-3 py-2">{row.fullName}</td>
                        <td className="px-3 py-2 text-xs">{row.email}</td>
                        <td className="px-3 py-2">
                          <Badge variant={LEVEL_HINTS.includes(row.level) ? "secondary" : "destructive"} className="text-xs">
                            {row.level || "—"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" /> {preview.errors.length} issue(s) found
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 max-h-28 overflow-y-auto">
                    {preview.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={handleImport} disabled={isImporting} className="flex-1">
                  {isImporting ? "Importing..." : `Import ${preview.totalRows} Records`}
                </Button>
                <Button variant="outline" onClick={handleReset}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {importResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" /> Import Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
                  <p className="text-sm text-muted-foreground mt-1">Records imported</p>
                </div>
                <div className="rounded-lg bg-muted border border-border p-4 text-center">
                  <p className="text-3xl font-bold text-foreground">{importResult.skipped}</p>
                  <p className="text-sm text-muted-foreground mt-1">Skipped (duplicates/errors)</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-muted-foreground">Skipped rows:</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto bg-muted rounded-md p-3">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Imported students can now visit the <strong>registration page</strong> on the website to set their voting password and complete registration.
              </p>

              <Button variant="outline" onClick={handleReset} className="w-full">Import Another File</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
