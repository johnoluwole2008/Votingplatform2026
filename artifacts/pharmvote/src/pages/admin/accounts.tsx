import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AdminLayout from "@/components/admin-layout";
import { useAdminSession } from "@/hooks/use-voter-session";
import { useListAdminAccounts, useCreateAdminAccount, useDeleteAdminAccount } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Trash2, UserPlus, UserCog, Shield, KeyRound, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Valid email required"),
  name: z.string().min(2, "Name required"),
  password: z.string().min(8, "Min 8 characters"),
  role: z.enum(["super_admin", "editor", "observer"]),
});

const resetSchema = z.object({
  password: z.string().min(8, "Min 8 characters"),
  confirm: z.string().min(1, "Please confirm password"),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});

type FormData = z.infer<typeof schema>;
type ResetData = z.infer<typeof resetSchema>;

const ROLE_LABELS: Record<string, { label: string; class: string }> = {
  super_admin: { label: "Super Admin", class: "bg-purple-100 text-purple-700" },
  editor: { label: "Editor", class: "bg-blue-100 text-blue-700" },
  observer: { label: "Observer", class: "bg-muted text-muted-foreground" },
};

export default function AdminAccountsPage() {
  const session = useAdminSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: number; email: string } | null>(null);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { data, isLoading } = useListAdminAccounts();
  const createAccount = useCreateAdminAccount();
  const deleteAccount = useDeleteAdminAccount();

  const isSuperAdmin = session.data?.role === "super_admin";

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", name: "", password: "", role: "observer" },
  });

  const resetForm = useForm<ResetData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = (formData: FormData) => {
    createAccount.mutate(
      { data: formData },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listAdminAccounts"] });
          toast({ title: "Account created", description: `${formData.email} has been added.` });
          form.reset();
          setShowForm(false);
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.response?.data?.error ?? "Failed to create account";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = (id: number, email: string) => {
    if (!confirm(`Delete admin account for ${email}? This cannot be undone.`)) return;
    deleteAccount.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listAdminAccounts"] });
          toast({ title: "Account deleted", description: `${email} has been removed.` });
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.response?.data?.error ?? "Delete failed";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      },
    );
  };

  const handleResetPassword = async (data: ResetData) => {
    if (!resetTarget) return;
    setIsResetting(true);
    try {
      const res = await fetch(`/api/admin/accounts/${resetTarget.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Reset failed");
      toast({ title: "Password reset", description: `Password updated for ${resetTarget.email}.` });
      setResetTarget(null);
      resetForm.reset();
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Reset failed", variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AdminLayout role={session.data?.role}>
      <div className="px-6 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Accounts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage electoral committee portal access</p>
          </div>
          {isSuperAdmin && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} data-testid="button-new-account">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          )}
        </div>

        {/* Create form */}
        {showForm && isSuperAdmin && (
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">New Admin Account</h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input {...field} data-testid="input-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" {...field} data-testid="input-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" {...field} data-testid="input-password" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="observer">Observer (read-only)</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" size="sm" disabled={createAccount.isPending} data-testid="button-create-account">
                    {createAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        {/* Accounts list */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <UserCog className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No admin accounts found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Login</th>
                  {isSuperAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((account) => {
                  const isSelf = account.id === session.data?.id;
                  const roleInfo = ROLE_LABELS[account.role] ?? ROLE_LABELS.observer;
                  return (
                    <tr key={account.id} className="hover:bg-muted/20" data-testid={`account-row-${account.id}`}>
                      <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                        {account.name}
                        {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{account.email}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", roleInfo.class)}>
                          {account.role === "super_admin" && <Shield className="h-3 w-3" />}
                          {roleInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {account.lastLogin ? new Date(account.lastLogin).toLocaleString() : "Never"}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => { setResetTarget({ id: account.id, email: account.email }); resetForm.reset(); }}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="Reset password"
                              data-testid={`button-reset-password-${account.id}`}
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                            {!isSelf && (
                              <button
                                onClick={() => handleDelete(account.id, account.email)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                data-testid={`button-delete-account-${account.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) { setResetTarget(null); resetForm.reset(); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-medium text-foreground">{resetTarget?.email}</span>.
            </DialogDescription>
          </DialogHeader>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="space-y-4 py-2">
              <FormField control={resetForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showNewPw ? "text" : "password"}
                        placeholder="Min 8 characters"
                        {...field}
                        className="pr-10"
                      />
                      <button type="button" tabIndex={-1}
                        onClick={() => setShowNewPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={resetForm.control} name="confirm" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPw ? "text" : "password"}
                        placeholder="Re-enter password"
                        {...field}
                        className="pr-10"
                      />
                      <button type="button" tabIndex={-1}
                        onClick={() => setShowConfirmPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setResetTarget(null); resetForm.reset(); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isResetting}>
                  {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reset Password
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
