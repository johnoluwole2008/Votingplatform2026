import { useEffect } from "react";
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
import { Loader2, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { data, isLoading } = useGetElectionSettings();
  const updateSettings = useUpdateElectionSettings();

  const isObserver = session.data?.role === "observer";

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
      </div>
    </AdminLayout>
  );
}
