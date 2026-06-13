import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AdminLayout from "@/components/admin-layout";
import { useAdminSession } from "@/hooks/use-voter-session";
import {
  useListOffices,
  useCreateOffice,
  useUpdateOffice,
  useDeleteOffice,
  useCreateCandidate,
  useDeleteCandidate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Vote, ChevronDown, ChevronUp, UserPlus, Pencil, Check, X, ImageIcon, Upload } from "lucide-react";
import { useRef } from "react";
import { useToast } from "@/hooks/use-toast";

const officeSchema = z.object({
  title: z.string().min(1, "Office title required"),
  description: z.string().optional(),
  displayOrder: z.coerce.number().default(0),
});

const candidateSchema = z.object({
  fullName: z.string().min(2, "Candidate name required"),
  bio: z.string().optional(),
  level: z.string().optional(),
  photoUrl: z.string().optional().or(z.literal("")),
  officeId: z.number(),
});

const editOfficeSchema = z.object({
  title: z.string().min(1, "Office title required"),
  description: z.string().optional(),
  displayOrder: z.coerce.number().default(0),
});

type OfficeFormData = z.infer<typeof officeSchema>;
type CandidateFormData = z.infer<typeof candidateSchema>;
type EditOfficeFormData = z.infer<typeof editOfficeSchema>;

interface OfficeWithCandidates {
  id: number;
  title: string;
  description?: string | null;
  displayOrder: number;
  candidates: { id: number; fullName: string; bio?: string | null; level?: string | null; photoUrl?: string | null }[];
}

export default function AdminOfficesPage() {
  const session = useAdminSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedOffice, setExpandedOffice] = useState<number | null>(null);
  const [addingCandidateFor, setAddingCandidateFor] = useState<number | null>(null);
  const [editingOfficeId, setEditingOfficeId] = useState<number | null>(null);
  const [showOfficeForm, setShowOfficeForm] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);

  const { data: offices, isLoading } = useListOffices();
  const createOffice = useCreateOffice();
  const updateOffice = useUpdateOffice();
  const deleteOffice = useDeleteOffice();
  const createCandidate = useCreateCandidate();
  const deleteCandidate = useDeleteCandidate();

  const isObserver = session.data?.role === "observer";

  const officeForm = useForm<OfficeFormData>({
    resolver: zodResolver(officeSchema),
    defaultValues: { title: "", description: "", displayOrder: (offices?.length ?? 0) + 1 },
  });

  const editOfficeForm = useForm<EditOfficeFormData>({
    resolver: zodResolver(editOfficeSchema),
    defaultValues: { title: "", description: "", displayOrder: 0 },
  });

  const candidateForm = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: { fullName: "", bio: "", level: "", photoUrl: "", officeId: 0 },
  });

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true);
    try {
      const reqRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, folder: "candidate-photos" }),
      });
      if (!reqRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, objectPath } = await reqRes.json();
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed");
      const servedUrl = `/api/storage/objects/${objectPath}`;
      candidateForm.setValue("photoUrl", servedUrl);
      setPhotoPreview(URL.createObjectURL(file));
      toast({ title: "Photo uploaded!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setPhotoUploading(false); }
  };

  const handleCreateOffice = (data: OfficeFormData) => {
    createOffice.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listOffices"] });
          toast({ title: "Office created" });
          officeForm.reset();
          setShowOfficeForm(false);
        },
        onError: () => toast({ title: "Failed to create office", variant: "destructive" }),
      },
    );
  };

  const handleStartEdit = (office: OfficeWithCandidates) => {
    editOfficeForm.reset({
      title: office.title,
      description: office.description ?? "",
      displayOrder: office.displayOrder,
    });
    setEditingOfficeId(office.id);
  };

  const handleSaveEdit = (data: EditOfficeFormData) => {
    if (!editingOfficeId) return;
    updateOffice.mutate(
      { id: editingOfficeId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listOffices"] });
          toast({ title: "Office updated" });
          setEditingOfficeId(null);
        },
        onError: () => toast({ title: "Failed to update office", variant: "destructive" }),
      },
    );
  };

  const handleDeleteOffice = (id: number, title: string) => {
    if (!confirm(`Delete office "${title}" and all its candidates?`)) return;
    deleteOffice.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listOffices"] });
          toast({ title: "Office deleted" });
        },
        onError: () => toast({ title: "Delete failed", variant: "destructive" }),
      },
    );
  };

  const handleCreateCandidate = (data: CandidateFormData) => {
    createCandidate.mutate(
      {
        data: {
          officeId: data.officeId,
          fullName: data.fullName,
          bio: data.bio,
          level: data.level,
          photoUrl: data.photoUrl || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listOffices"] });
          toast({ title: "Candidate added" });
          candidateForm.reset();
          setPhotoPreview(null);
          setAddingCandidateFor(null);
        },
        onError: () => toast({ title: "Failed to add candidate", variant: "destructive" }),
      },
    );
  };

  const handleDeleteCandidate = (id: number, name: string) => {
    if (!confirm(`Remove candidate "${name}"?`)) return;
    deleteCandidate.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listOffices"] });
          toast({ title: "Candidate removed" });
        },
        onError: () => toast({ title: "Delete failed", variant: "destructive" }),
      },
    );
  };

  return (
    <AdminLayout role={session.data?.role}>
      <div className="px-6 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Offices & Candidates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {offices ? `${offices.length} offices, ${offices.reduce((n, o) => n + o.candidates.length, 0)} candidates` : "Loading..."}
            </p>
          </div>
          {!isObserver && (
            <Button size="sm" onClick={() => setShowOfficeForm((s) => !s)} data-testid="button-add-office">
              <Plus className="h-4 w-4 mr-2" />
              Add Office
            </Button>
          )}
        </div>

        {/* New office form */}
        {showOfficeForm && !isObserver && (
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">New Office</h2>
            <Form {...officeForm}>
              <form onSubmit={officeForm.handleSubmit(handleCreateOffice)} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={officeForm.control} name="title" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Office Title</FormLabel>
                      <FormControl><Input placeholder="e.g. President" {...field} data-testid="input-office-title" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={officeForm.control} name="displayOrder" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Order</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={officeForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl><Textarea placeholder="Brief description of the role" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-3">
                  <Button type="submit" size="sm" disabled={createOffice.isPending} data-testid="button-create-office">
                    {createOffice.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create Office
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowOfficeForm(false)}>Cancel</Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        {/* Offices list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : !offices || offices.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-xl">
            <Vote className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No offices set up yet.</p>
            {!isObserver && <p className="text-xs mt-1">Click "Add Office" to get started.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {(offices as unknown as OfficeWithCandidates[]).map((office) => (
              <div key={office.id} className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`office-card-${office.id}`}>

                {/* Edit mode */}
                {editingOfficeId === office.id ? (
                  <div className="px-5 py-4">
                    <Form {...editOfficeForm}>
                      <form onSubmit={editOfficeForm.handleSubmit(handleSaveEdit)} className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <FormField control={editOfficeForm.control} name="title" render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel className="text-xs">Office Title</FormLabel>
                              <FormControl><Input {...field} data-testid={`input-edit-title-${office.id}`} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={editOfficeForm.control} name="displayOrder" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Order</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={editOfficeForm.control} name="description" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Description (optional)</FormLabel>
                            <FormControl><Input {...field} placeholder="Brief description" /></FormControl>
                          </FormItem>
                        )} />
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={updateOffice.isPending}>
                            {updateOffice.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                            Save
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditingOfficeId(null)}>
                            <X className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/20"
                    onClick={() => setExpandedOffice(expandedOffice === office.id ? null : office.id)}
                  >
                    <div>
                      <div className="font-semibold text-foreground">{office.title}</div>
                      {office.description && <div className="text-xs text-muted-foreground mt-0.5">{office.description}</div>}
                      <div className="text-xs text-muted-foreground mt-1">{office.candidates.length} candidate{office.candidates.length !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isObserver && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartEdit(office); }}
                            className="text-muted-foreground hover:text-primary p-1 transition-colors"
                            title="Edit office"
                            data-testid={`button-edit-office-${office.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteOffice(office.id, office.title); }}
                            className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                            data-testid={`button-delete-office-${office.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {expandedOffice === office.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                )}

                {expandedOffice === office.id && editingOfficeId !== office.id && (
                  <div className="border-t border-border">
                    {office.candidates.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0" data-testid={`candidate-card-${c.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          {c.photoUrl ? (
                            <img
                              src={c.photoUrl}
                              alt={c.fullName}
                              className="h-9 w-9 rounded-full object-cover shrink-0 border border-border"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <ImageIcon className="h-4 w-4 text-muted-foreground opacity-50" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground">{c.fullName}</div>
                            {c.level && <div className="text-xs text-muted-foreground">{c.level}</div>}
                            {c.bio && <div className="text-xs text-muted-foreground line-clamp-1">{c.bio}</div>}
                          </div>
                        </div>
                        {!isObserver && (
                          <button
                            onClick={() => handleDeleteCandidate(c.id, c.fullName)}
                            className="text-muted-foreground hover:text-destructive p-1 transition-colors shrink-0"
                            data-testid={`button-delete-candidate-${c.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    {!isObserver && (
                      <div className="px-5 py-3">
                        {addingCandidateFor === office.id ? (
                          <Form {...candidateForm}>
                            <form
                              onSubmit={candidateForm.handleSubmit((d) => handleCreateCandidate({ ...d, officeId: office.id }))}
                              className="space-y-3"
                            >
                              <div className="grid grid-cols-2 gap-3">
                                <FormField control={candidateForm.control} name="fullName" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Full Name</FormLabel>
                                    <FormControl><Input {...field} placeholder="Candidate name" data-testid="input-candidate-name" /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={candidateForm.control} name="level" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Level (optional)</FormLabel>
                                    <FormControl><Input {...field} placeholder="e.g. 400L" /></FormControl>
                                  </FormItem>
                                )} />
                              </div>
                              <FormField control={candidateForm.control} name="bio" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Bio (optional)</FormLabel>
                                  <FormControl><Input {...field} placeholder="Brief bio or tagline" /></FormControl>
                                </FormItem>
                              )} />
                              <FormField control={candidateForm.control} name="photoUrl" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs flex items-center gap-1.5">
                                    <ImageIcon className="h-3 w-3" />
                                    Photo (optional)
                                  </FormLabel>
                                  <div className="flex items-center gap-3">
                                    {(photoPreview || field.value) && (
                                      <img
                                        src={photoPreview ?? field.value}
                                        alt="Preview"
                                        className="h-12 w-12 rounded-full object-cover border border-border"
                                      />
                                    )}
                                    <div className="flex flex-col gap-1 flex-1">
                                      <input
                                        ref={photoFileRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
                                      />
                                      <Button
                                        type="button" variant="outline" size="sm"
                                        disabled={photoUploading}
                                        onClick={() => photoFileRef.current?.click()}
                                        className="justify-start"
                                      >
                                        {photoUploading
                                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Uploading…</>
                                          : <><Upload className="h-3.5 w-3.5 mr-1.5" />{field.value ? "Replace photo" : "Upload photo"}</>}
                                      </Button>
                                      {field.value && (
                                        <button
                                          type="button"
                                          className="text-xs text-muted-foreground hover:text-destructive text-left"
                                          onClick={() => { field.onChange(""); setPhotoPreview(null); }}
                                        >Remove photo</button>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground">Choose from gallery or camera. Shown on the ballot.</p>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <div className="flex gap-2">
                                <Button type="submit" size="sm" disabled={createCandidate.isPending} data-testid="button-add-candidate">
                                  {createCandidate.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                  Add Candidate
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => setAddingCandidateFor(null)}>Cancel</Button>
                              </div>
                            </form>
                          </Form>
                        ) : (
                          <button
                            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                            onClick={() => { setAddingCandidateFor(office.id); candidateForm.reset(); setPhotoPreview(null); }}
                            data-testid={`button-add-candidate-${office.id}`}
                          >
                            <UserPlus className="h-4 w-4" />
                            Add Candidate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
