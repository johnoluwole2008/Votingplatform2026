import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useRegisterVoter } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  matricNumber: z.string().min(3, "Matric number is required"),
  email: z.string().email("Enter a valid school email address"),
  fullName: z.string().min(2, "Full name is required"),
  level: z.enum(["100L", "200L", "300L", "400L", "500L", "600L"], { required_error: "Select your academic level" }),
  password: z.string().min(8, "Password must be at least 8 characters").regex(/(?=.*[a-zA-Z])(?=.*\d)/, "Password must contain letters and numbers"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const register = useRegisterVoter();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { matricNumber: "", email: "", fullName: "", password: "", confirmPassword: "" },
  });

  const onSubmit = (data: FormData) => {
    register.mutate(
      { data: { matricNumber: data.matricNumber, email: data.email, fullName: data.fullName, level: data.level, password: data.password } },
      {
        onSuccess: () => {
          setLocation("/register/success");
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? err?.message ?? "Registration failed. Please check your details and try again.";
          toast({ title: "Registration failed", description: msg, variant: "destructive" });
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
          <span className="font-semibold text-sm">PharmSci E-Voting — Student Registration</span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <Link href="/">
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 cursor-pointer transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </span>
          </Link>

          <div className="bg-card border border-border rounded-xl shadow-sm p-8">
            <h1 className="text-2xl font-bold text-foreground mb-1">Voter Registration</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Register to vote in the Faculty elections. Fill in your details exactly once — your information becomes your voter record.
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="matricNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matric Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. PHA/2021/001" {...field} data-testid="input-matric-number" autoComplete="off" />
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
                      <FormLabel>School Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@students.faculty.edu.ng" {...field} data-testid="input-email" />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Must match your email on record in the school portal</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your full legal name" {...field} data-testid="input-full-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Academic Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-level">
                            <SelectValue placeholder="Select your level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["100L", "200L", "300L", "400L", "500L", "600L"].map((l) => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Min 8 characters, letters and numbers"
                            {...field}
                            data-testid="input-password"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword((s) => !s)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">You will use this password to log in on Election Day</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Repeat your password" {...field} data-testid="input-confirm-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={register.isPending}
                  data-testid="button-submit-registration"
                >
                  {register.isPending ? "Verifying and registering..." : "Complete Registration"}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </main>
    </div>
  );
}
