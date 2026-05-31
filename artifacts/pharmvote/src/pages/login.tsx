import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useLoginVoter, getGetVoterSessionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Lock, ArrowLeft, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const schema = z.object({
  matricNumber: z.string().min(1, "Matric number is required"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const login = useLoginVoter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { matricNumber: "", password: "" },
  });

  const onSubmit = (data: FormData) => {
    setErrorMsg(null);
    login.mutate(
      { data: { matricNumber: data.matricNumber, password: data.password } },
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
          const msg = err?.response?.data?.error ?? "Invalid credentials or voting is not currently open.";
          setErrorMsg(msg);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">PharmSci E-Voting — Voting Day Login</span>
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
                <p className="text-xs text-muted-foreground">Use your registration credentials</p>
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
                        <Input placeholder="Enter your matric number" {...field} data-testid="input-matric-number" autoComplete="username" />
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
                      <FormLabel>Voting Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Your voting password" {...field} data-testid="input-password" autoComplete="current-password" />
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

          <p className="text-xs text-muted-foreground text-center mt-4">
            Not yet registered?{" "}
            {/* Registration only available in registration phase */}
            <Link href="/register"><span className="text-primary cursor-pointer hover:underline">Register to vote</span></Link>
          </p>
        </div>
      </main>
    </div>
  );
}
