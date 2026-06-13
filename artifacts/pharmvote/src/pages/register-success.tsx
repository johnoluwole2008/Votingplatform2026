import { Link } from "wouter";
import { CheckCircle, Shield, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RegisterSuccessPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-end p-3">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">Registration Successful</h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          You are now registered to vote. A confirmation has been sent to your school email address.
          Keep your Matric Number and voting password safe — you will need them on Election Day.
        </p>

        <div className="bg-card border border-border rounded-xl p-6 mb-8 text-left space-y-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-foreground">What happens next?</div>
              <div className="text-sm text-muted-foreground mt-1">
                On Election Day, visit this platform and log in with your Matric Number and the voting password you just created.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-foreground">Important reminder</div>
              <div className="text-sm text-muted-foreground mt-1">
                You cannot change your registration details. If there is an error, contact the Electoral Committee directly.
              </div>
            </div>
          </div>
        </div>

        <Link href="/">
          <Button className="w-full" data-testid="button-back-home">
            Back to Home <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>
      </div>
    </div>
  );
}
