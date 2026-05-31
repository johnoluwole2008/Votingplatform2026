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
import { Loader2, Trash2, UserPlus, UserCog, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Valid email required"),
  name: z.string().min(2, "Name required"),
  password: z.string().min(8, "Min 8 characters"),
  role: z.enum(["super_admin", "editor", "observer"]),
});

type FormData = z.infer<typeof schema>;

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

  const { data, isLoading } = useListAdminAccounts();
  const createAccount = useCreateAdminAccount();
  const deleteAccount = useDeleteAdminAccount();

  const isSuperAdmin = session.data?.role === "super_admin";

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", name: "", password: "", role: "observer" },
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
          const msg = err?.response?.data?.error ?? "Failed to create account";
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
          const msg = err?.response?.data?.error ?? "Delete failed";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      },
    );
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
                          {!isSelf && (
                            <button
                              onClick={() => handleDelete(account.id, account.email)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              data-testid={`button-delete-account-${account.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
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
    </AdminLayout>
  );
}
