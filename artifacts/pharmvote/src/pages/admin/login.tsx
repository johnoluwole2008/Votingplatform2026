import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useLoginAdmin, getGetAdminSessionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertCircle, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { useState } from "react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const login = useLoginAdmin();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: FormData) => {
    setErrorMsg(null);
    login.mutate(
      { data: { email: data.email, password: data.password } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminSessionQueryKey() });
          setLocation("/admin/dashboard");
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.message?.replace(/^HTTP \d+ [^:]+:\s*/, "") ?? "Authentication failed. Check your credentials.";
          setErrorMsg(msg);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="PharmSci Logo" className="h-16 w-16 object-contain mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground">Electoral Committee Access</h1>
          <p className="text-sm text-muted-foreground mt-1">Secure administrator portal</p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          {errorMsg && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-3 py-2.5 text-sm mb-5" data-testid="status-error">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@faculty.edu" {...field} data-testid="input-email" autoComplete="username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          data-testid="input-password"
                          autoComplete="current-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={login.isPending} data-testid="button-login">
                {login.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Authenticating...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowForgot((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {showForgot && (
            <div className="mt-4 flex items-start gap-2.5 bg-muted/60 border border-border rounded-lg px-3 py-3 text-xs text-muted-foreground">
              <KeyRound className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <p>
                Password resets are handled by the <span className="font-medium text-foreground">Super Administrator</span>.
                Ask them to log in and go to <span className="font-medium text-foreground">Admin Accounts → Reset Password</span> for your account.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
