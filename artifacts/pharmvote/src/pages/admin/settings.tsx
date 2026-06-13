import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AdminLayout from "@/components/admin-layout";
import { useAdminSession } from "@/hooks/use-voter-session";
import { useGetElectionSettings, useUpdateElectionSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, AlertCircle, Link2, Copy, Check, Mail, MessageCircle, KeyRound, AtSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emailSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newEmail: z.string().email("Enter a valid email address"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type EmailFormData = z.infer<typeof emailSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

const schema = z.object({
  electionName: z.string().min(1, "Election name is required"),
  registrationStart: z.string().optional(),
  registrationEnd: z.string().optional(),
  votingStart: z.string().optional(),
  votingEnd: z.string().optional(),
  totalExpectedVoters: z.coerce.number().min(1, "Must be at least 1"),
  showLiveResults: z.boolean(),
});

type FormData = z.infer<typeof schema>;

function toLocalDatetime(isoString?: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AdminSettingsPage() {
  const session = useAdminSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetElectionSettings({ query: { refetchInterval: 30_000 } });
  const updateSettings = useUpdateElectionSettings();
  const [copied, setCopied] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { currentPassword: "", newEmail: "" },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const handleChangeEmail = async (formData: EmailFormData) => {
    setEmailPending(true);
    try {
      const res = await fetch("/api/admin/auth/me/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: formData.currentPassword, newEmail: formData.newEmail }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update email.");
      toast({ title: "Email updated", description: `Your login email is now ${json.email}.` });
      emailForm.reset();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setEmailPending(false);
    }
  };

  const handleChangePassword = async (formData: PasswordFormData) => {
    setPasswordPending(true);
    try {
      const res = await fetch("/api/admin/auth/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: formData.currentPassword, newPassword: formData.newPassword }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update password.");
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      passwordForm.reset();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setPasswordPending(false);
    }
  };

  const handleShareWhatsApp = () => {
    const msg = encodeURIComponent(`Register to vote in the PANS Executive Council Election 2026.\nClick the link below to register:\n${registrationUrl}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent("PANS Election — Voter Registration");
    const body = encodeURIComponent(`Dear Student,\n\nYou are invited to register for the PANS Executive Council Election 2026.\n\nClick the link below to register:\n${registrationUrl}\n\nYou will need your official matric number and school email address.\n\nRegards,\nElectoral Committee`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const isObserver = session.data?.role === "observer";

  const registrationUrl = `${window.location.origin}${import.meta.env.BASE_URL}register`;

  const handleCopy = () => {
    navigator.clipboard.writeText(registrationUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied!", description: "Registration link copied to clipboard." });
    });
  };

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      electionName: "",
      registrationStart: "",
      registrationEnd: "",
      votingStart: "",
      votingEnd: "",
      totalExpectedVoters: 900,
      showLiveResults: false,
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        electionName: data.electionName,
        registrationStart: toLocalDatetime(data.registrationStart),
        registrationEnd: toLocalDatetime(data.registrationEnd),
        votingStart: toLocalDatetime(data.votingStart),
        votingEnd: toLocalDatetime(data.votingEnd),
        totalExpectedVoters: data.totalExpectedVoters,
        showLiveResults: data.showLiveResults,
      });
    }
  }, [data]);

  const onSubmit = (formData: FormData) => {
    updateSettings.mutate(
      {
        data: {
          electionName: formData.electionName,
          registrationStart: formData.registrationStart ? new Date(formData.registrationStart).toISOString() : null,
          registrationEnd: formData.registrationEnd ? new Date(formData.registrationEnd).toISOString() : null,
          votingStart: formData.votingStart ? new Date(formData.votingStart).toISOString() : null,
          votingEnd: formData.votingEnd ? new Date(formData.votingEnd).toISOString() : null,
          totalExpectedVoters: formData.totalExpectedVoters,
          showLiveResults: formData.showLiveResults,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: "Settings saved", description: "Election settings have been updated." });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Failed to save settings.";
          toast({ title: "Save failed", description: msg, variant: "destructive" });
        },
      },
    );
  };

  return (
    <AdminLayout role={session.data?.role}>
      <div className="px-6 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground mb-2">Election Settings</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Configure election schedule, name, and display options.
        </p>

        {/* Registration Link Card */}
        <div className="bg-card border border-border rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Voter Registration Link</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Share this link with students so they can register to vote. Send it via email, WhatsApp, or your LMS.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm font-mono text-muted-foreground break-all border border-border select-all">
              {registrationUrl}
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" className="flex-1 gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20" onClick={handleShareWhatsApp}>
              <MessageCircle className="h-4 w-4" />Share on WhatsApp
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleShareEmail}>
              <Mail className="h-4 w-4" />Share via Email
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Students will need their official matric number and school email to register.
          </p>
        </div>

        {isObserver && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm mb-6">
            <AlertCircle className="h-4 w-4 shrink-0" />
            You have observer access — settings are read-only.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="electionName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Election Name</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isObserver} data-testid="input-election-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalExpectedVoters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Expected Voters</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} disabled={isObserver} data-testid="input-total-voters" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Used for registration rate calculations</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="registrationStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Opens</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} disabled={isObserver} data-testid="input-registration-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="registrationEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Closes</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} disabled={isObserver} data-testid="input-registration-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="votingStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voting Opens</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} disabled={isObserver} data-testid="input-voting-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="votingEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voting Closes</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} disabled={isObserver} data-testid="input-voting-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="showLiveResults"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        disabled={isObserver}
                        className="h-4 w-4 accent-primary"
                        data-testid="checkbox-show-live-results"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="cursor-pointer">Show live results to students</FormLabel>
                      <p className="text-xs text-muted-foreground">If enabled, students can view results after voting closes</p>
                    </div>
                  </FormItem>
                )}
              />

              {!isObserver && (
                <Button type="submit" disabled={updateSettings.isPending} data-testid="button-save-settings">
                  {updateSettings.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" />Save Settings</>
                  )}
                </Button>
              )}
            </form>
          </Form>
        )}

        {/* My Account */}
        <div className="mt-12">
          <h1 className="text-2xl font-bold text-foreground mb-2">My Account</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Update your login email or password. You must confirm your current password for both changes.
          </p>

          {/* Change Email */}
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <AtSign className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Change Email</h2>
            </div>
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(handleChangeEmail)} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="newEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your current password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" variant="outline" disabled={emailPending}>
                  {emailPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating...</> : <><AtSign className="h-4 w-4 mr-2" />Update Email</>}
                </Button>
              </form>
            </Form>
          </div>

          {/* Change Password */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
            </div>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your current password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="At least 8 characters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Re-enter new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" variant="outline" disabled={passwordPending}>
                  {passwordPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating...</> : <><KeyRound className="h-4 w-4 mr-2" />Update Password</>}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
