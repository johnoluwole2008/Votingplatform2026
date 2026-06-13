import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminSession } from "@/hooks/use-voter-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Settings2, TestTube, Mail, Clock, Trash2, Bell, BellOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  sending: "bg-primary/10 text-primary",
  sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

const GROUP_LABELS: Record<string, string> = {
  all_students: "All students on record",
  registered_voters: "Registered voters only (set password)",
  unregistered_only: "Students not yet registered",
};

export default function AdminEmailPage() {
  const session = useAdminSession();
  const { toast } = useToast();
  const isSuperAdmin = session.data?.role === "super_admin";
  const isObserver = session.data?.role === "observer";

  const [tab, setTab] = useState<"send" | "history" | "smtp">("send");

  // Send form
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientGroup, setRecipientGroup] = useState("all_students");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Phase notification
  const [isNotifying, setIsNotifying] = useState<"voting_open" | "voting_closed" | null>(null);
  const [notifyConfirmPhase, setNotifyConfirmPhase] = useState<"voting_open" | "voting_closed" | null>(null);

  // SMTP settings
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("PharmSci E-Voting");
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  // History
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) loadSmtpSettings();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (tab === "history") loadJobs();
  }, [tab]);

  const loadSmtpSettings = async () => {
    try {
      const r = await fetch("/api/admin/email/settings", { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setSmtpHost(d.host ?? "");
        setSmtpPort(String(d.port ?? 587));
        setSmtpUser(d.user ?? "");
        setSmtpFrom(d.from ?? "");
        setSmtpFromName(d.fromName ?? "PharmSci E-Voting");
        setSmtpConfigured(d.configured ?? false);
      }
    } catch {}
  };

  const loadJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const r = await fetch("/api/admin/email/jobs", { credentials: "include" });
      if (r.ok) { const d = await r.json(); setJobs(d.jobs ?? []); }
    } finally { setIsLoadingJobs(false); }
  };

  const handleSaveSmtp = async () => {
    setIsSavingSmtp(true);
    try {
      const r = await fetch("/api/admin/email/settings", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass || undefined, from: smtpFrom, fromName: smtpFromName }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setSmtpPass("");
      setSmtpConfigured(true);
      toast({ title: "SMTP settings saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setIsSavingSmtp(false); }
  };

  const handleTestSmtp = async () => {
    if (!testEmail) { toast({ title: "Enter a test email", variant: "destructive" }); return; }
    setIsTesting(true);
    try {
      const r = await fetch("/api/admin/email/test", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "Test email sent!", description: d.message });
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    } finally { setIsTesting(false); }
  };

  const handleSend = async () => {
    setIsSending(true);
    setConfirmOpen(false);
    try {
      const r = await fetch("/api/admin/email/send", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, recipientGroup, scheduledAt: scheduledAt || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: d.scheduled ? "Email scheduled!" : "Sending now!", description: d.message });
      setSubject(""); setBody(""); setScheduledAt("");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setIsSending(false); }
  };

  const handleCancelJob = async (id: number) => {
    await fetch(`/api/admin/email/jobs/${id}`, { method: "DELETE", credentials: "include" });
    loadJobs();
  };

  const handleNotifyPhase = async (phase: "voting_open" | "voting_closed") => {
    setIsNotifying(phase);
    setNotifyConfirmPhase(null);
    try {
      const r = await fetch("/api/admin/email/notify-phase", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "Notification sent!", description: d.message });
    } catch (err: any) {
      toast({ title: "Failed to send notification", description: err.message, variant: "destructive" });
    } finally { setIsNotifying(null); }
  };

  const insertPlaceholder = (tag: string) => {
    setBody((prev) => prev + tag);
  };

  return (
    <AdminLayout role={session.data?.role}>
      <div className="px-6 py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-2">
          <Mail className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Bulk Email</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Send registration or voting day announcements to students.</p>

        {!smtpConfigured && !isObserver && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg px-4 py-3 text-sm mb-6">
            <Bell className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-medium text-amber-800 dark:text-amber-300">SMTP not configured.</span>
              {isSuperAdmin ? <> Go to the <button onClick={() => setTab("smtp")} className="underline">SMTP Settings</button> tab to set up email sending.</> : " Ask a super admin to configure SMTP settings."}
            </div>
          </div>
        )}

        {/* Quick notification buttons */}
        {!isObserver && (
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Notifications — Registered Voters</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline" size="sm"
                disabled={!smtpConfigured || isNotifying !== null}
                onClick={() => setNotifyConfirmPhase("voting_open")}
              >
                {isNotifying === "voting_open" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Bell className="h-3.5 w-3.5 mr-1.5" />}
                Voting is Open
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={!smtpConfigured || isNotifying !== null}
                onClick={() => setNotifyConfirmPhase("voting_closed")}
              >
                {isNotifying === "voting_closed" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <BellOff className="h-3.5 w-3.5 mr-1.5" />}
                Voting is Closed
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Sends a pre-written notification to all registered voters instantly.</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 mb-6">
          {[
            { key: "send", label: "Compose & Send", icon: Send },
            { key: "history", label: "History", icon: Clock },
            ...(isSuperAdmin ? [{ key: "smtp", label: "SMTP Settings", icon: Settings2 }] : []),
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`flex items-center gap-2 flex-1 justify-center py-2 px-3 rounded-md text-sm transition-colors ${tab === key ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Compose Tab */}
        {tab === "send" && (
          <div className="space-y-5 bg-card border border-border rounded-xl p-6">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Recipients</label>
              <Select value={recipientGroup} onValueChange={setRecipientGroup} disabled={isObserver}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GROUP_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Subject</label>
              <Input placeholder="e.g. PANS Election — Voting Day Reminder" value={subject} onChange={e => setSubject(e.target.value)} disabled={isObserver} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">Message Body</label>
                {!isObserver && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Insert:</span>
                    {["[Name]", "[Email]", "[Matric]"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertPlaceholder(tag)}
                        className="text-xs bg-muted hover:bg-muted/80 text-foreground font-mono px-1.5 py-0.5 rounded border border-border transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Textarea
                placeholder={"Dear [Name],\n\nVoting is now open! Log in to cast your ballot.\n\n— PharmSci E-Voting Team"}
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={9}
                disabled={isObserver}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use <code className="bg-muted px-1 rounded">[Name]</code>, <code className="bg-muted px-1 rounded">[Email]</code>, or <code className="bg-muted px-1 rounded">[Matric]</code> — each email is personalised with the student's actual details.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Schedule (optional)
              </label>
              <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} disabled={isObserver} />
              <p className="text-xs text-muted-foreground mt-1">Leave blank to send immediately.</p>
            </div>
            {!isObserver && (
              <Button
                className="w-full"
                disabled={!subject || !body || !smtpConfigured || isSending}
                onClick={() => setConfirmOpen(true)}
              >
                {isSending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</> : <><Send className="h-4 w-4 mr-2" />{scheduledAt ? "Schedule Email" : "Send Now"}</>}
              </Button>
            )}
          </div>
        )}

        {/* History Tab */}
        {tab === "history" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={loadJobs} disabled={isLoadingJobs}>
                {isLoadingJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
            </div>
            {isLoadingJobs ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                <Mail className="h-8 w-8 mx-auto mb-3 opacity-30" />
                No emails sent yet.
              </div>
            ) : jobs.map((job: any) => (
              <div key={job.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground text-sm truncate">{job.subject}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {GROUP_LABELS[job.recipient_group] ?? job.recipient_group}
                      {job.sent_count > 0 && ` · ${job.sent_count} sent`}
                      {job.scheduled_at && ` · Scheduled: ${new Date(job.scheduled_at).toLocaleString()}`}
                    </div>
                    {job.error && <div className="text-xs text-destructive mt-1 truncate">{job.error}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[job.status] ?? STATUS_COLORS.pending}`}>
                      {job.status}
                    </span>
                    {(job.status === "pending" || job.status === "scheduled") && !isObserver && (
                      <button onClick={() => handleCancelJob(job.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2">{new Date(job.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        {/* SMTP Settings Tab */}
        {tab === "smtp" && isSuperAdmin && (
          <div className="space-y-5 bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground">Configure your SMTP server to enable bulk email sending. Works with Gmail, Outlook, or any SMTP provider.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium text-foreground block mb-1.5">SMTP Host</label>
                <Input placeholder="smtp.gmail.com" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium text-foreground block mb-1.5">Port</label>
                <Input placeholder="587" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">587 (TLS), 465 (SSL), 25 (plain)</p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-foreground block mb-1.5">SMTP Username</label>
                <Input placeholder="your@email.com" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-foreground block mb-1.5">SMTP Password / App Password</label>
                <Input type="password" placeholder={smtpConfigured ? "Leave blank to keep current password" : "Enter password"} value={smtpPass} onChange={e => setSmtpPass(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">For Gmail, use an <strong>App Password</strong> (not your Google account password).</p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-foreground block mb-1.5">From Address</label>
                <Input placeholder="elections@pharmsci.edu.ng" value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-foreground block mb-1.5">From Name</label>
                <Input placeholder="PharmSci E-Voting" value={smtpFromName} onChange={e => setSmtpFromName(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSaveSmtp} disabled={isSavingSmtp} className="w-full">
              {isSavingSmtp ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Save SMTP Settings"}
            </Button>
            <div className="border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Test Connection</h3>
              <div className="flex gap-2">
                <Input placeholder="send test to: you@example.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                <Button variant="outline" onClick={handleTestSmtp} disabled={isTesting || !smtpConfigured} className="shrink-0">
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><TestTube className="h-4 w-4 mr-2" />Test</>}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm send dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{scheduledAt ? "Schedule Email?" : "Send Email Now?"}</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-2">
            <p><strong className="text-foreground">To:</strong> {GROUP_LABELS[recipientGroup]}</p>
            <p><strong className="text-foreground">Subject:</strong> {subject}</p>
            {scheduledAt && <p><strong className="text-foreground">Scheduled:</strong> {new Date(scheduledAt).toLocaleString()}</p>}
            <p className="text-amber-600 dark:text-amber-400 text-xs">This will send individual emails to all matching students. This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</> : scheduledAt ? "Schedule" : "Send Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase notification confirm dialog */}
      <Dialog open={notifyConfirmPhase !== null} onOpenChange={(open) => { if (!open) setNotifyConfirmPhase(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {notifyConfirmPhase === "voting_open" ? "Notify voters: Voting is Open?" : "Notify voters: Voting is Closed?"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-2">
            <p><strong className="text-foreground">To:</strong> All registered voters</p>
            <p>
              {notifyConfirmPhase === "voting_open"
                ? "A pre-written notification will be sent immediately to all registered voters letting them know voting is open."
                : "A pre-written notification will be sent immediately to all registered voters letting them know voting has closed."}
            </p>
            <p className="text-amber-600 dark:text-amber-400 text-xs">This cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyConfirmPhase(null)}>Cancel</Button>
            <Button onClick={() => { if (notifyConfirmPhase) handleNotifyPhase(notifyConfirmPhase); }}>
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
