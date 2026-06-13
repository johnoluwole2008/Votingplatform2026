import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useLoginVoter, getGetVoterSessionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Lock, ArrowLeft, AlertCircle, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const schema = z.object({
  matricNumber: z.string().min(1, "Matric number is required"),
  email: z.string().email("Enter a valid email address"),
  personalCode: z.string().min(1, "Personal code is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const login = useLoginVoter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { matricNumber: "", email: "", personalCode: "" },
  });

  const onSubmit = (data: FormData) => {
    setErrorMsg(null);
    login.mutate(
      { data: { matricNumber: data.matricNumber, email: data.email, personalCode: data.personalCode } },
      {
        onSuccess: (session) => {
          queryClient.invalidateQueries({ queryKey: getGetVoterSessionQueryKey() });
          if (session.hasVoted) {
            setLocation("/ballot/success");
          } else {
            setLocation("/ballot");
          }
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.message?.replace(/^HTTP \d+ [^:]+:\s*/, "") ?? "Invalid credentials or voting is not currently open.";
          setErrorMsg(msg);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="PharmSci Logo" className="h-8 w-8 object-contain" />
            <span className="font-semibold text-sm">PharmSci E-Voting — Voting Day Login</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link href="/">
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 cursor-pointer transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </span>
          </Link>

          <div className="bg-card border border-border rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Voting Day Login</h1>
                <p className="text-xs text-muted-foreground">Use your matric number, email, and personal code</p>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-4 py-3 text-sm mb-5" data-testid="status-error">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="matricNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matric Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. PHA/2024/001" {...field} data-testid="input-matric-number" autoComplete="username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Your school email address" {...field} data-testid="input-email" autoComplete="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="personalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personal Code</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showCode ? "text" : "password"}
                            placeholder="Your personal code from registration"
                            {...field}
                            data-testid="input-personal-code"
                            autoComplete="current-password"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCode((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                            aria-label={showCode ? "Hide code" : "Show code"}
                          >
                            {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" size="lg" disabled={login.isPending} data-testid="button-login">
                  {login.isPending ? "Verifying..." : "Access My Ballot"}
                </Button>
              </form>
            </Form>

            <p className="text-xs text-muted-foreground text-center mt-6">
              Account is locked after 5 failed attempts for 15 minutes. If you have trouble, contact the Electoral Committee.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
