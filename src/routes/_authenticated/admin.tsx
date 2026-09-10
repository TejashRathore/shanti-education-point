import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  FileText,
  MessageSquare,
  PlayCircle,
  Star,
  Trash2,
  Users,
  Pencil,
  Plus,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-admin";
import { listStudents, setAdminByEmail } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Shanti Education" },
      {
        name: "description",
        content:
          "Manage notes, video lessons, students, reviews and feedback for Shanti Education.",
      },
      { property: "og:title", content: "Admin dashboard — Shanti Education" },
      {
        property: "og:description",
        content: "Manage study material, students and feedback for Shanti Education.",
      },
    ],
  }),
  component: AdminPage,
});

type MaterialRow = {
  id: string;
  class_level: number;
  subject: string;
  title: string;
  description: string;
  kind: string;
  url: string;
  duration_minutes: number | null;
};

const emptyMaterial = {
  class_level: 1,
  subject: "",
  title: "",
  description: "",
  kind: "pdf",
  url: "",
  duration_minutes: "" as string | number,
};

function AdminPage() {
  const isAdmin = useIsAdmin();

  if (isAdmin.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!isAdmin.data) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <ShieldCheck className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Teachers only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This area is for the Shanti Education team. Ask the owner to give your account
          access.
        </p>
        <Button asChild className="mt-6">
          <Link to="/library">Back to the library</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <h1 className="text-3xl font-semibold">Admin dashboard</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Add study material, follow how students are doing and read their feedback.
      </p>

      <Tabs defaultValue="overview" className="mt-7">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="materials">Notes &amp; videos</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Overview />
        </TabsContent>
        <TabsContent value="materials" className="mt-6">
          <MaterialsAdmin />
        </TabsContent>
        <TabsContent value="students" className="mt-6">
          <StudentsAdmin />
        </TabsContent>
        <TabsContent value="reviews" className="mt-6">
          <ReviewsAdmin />
        </TabsContent>
        <TabsContent value="feedback" className="mt-6">
          <FeedbackAdmin />
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          <TeamAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
}) {
  return (
    <div className="surface-panel flex items-center gap-4 p-5">
      <span className="flex size-10 items-center justify-center rounded-lg bg-secondary">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Overview() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [students, materials, threads, reviews, feedback, progress] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("materials").select("id", { count: "exact", head: true }),
        supabase.from("chat_threads").select("id", { count: "exact", head: true }),
        supabase.from("material_reviews").select("rating"),
        supabase.from("feedback").select("id", { count: "exact", head: true }),
        supabase.from("study_progress").select("status"),
      ]);
      const ratings = (reviews.data ?? []).map((r) => r.rating);
      const done = (progress.data ?? []).filter((p) => p.status === "completed").length;
      return {
        students: students.count ?? 0,
        materials: materials.count ?? 0,
        threads: threads.count ?? 0,
        feedback: feedback.count ?? 0,
        completed: done,
        avgRating: ratings.length
          ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
          : "—",
      };
    },
  });

  if (stats.isLoading) return <Skeleton className="h-28 w-full rounded-xl" />;
  const s = stats.data!;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Students signed up" value={s.students} icon={Users} />
      <StatCard label="Notes & videos" value={s.materials} icon={BookOpen} />
      <StatCard label="Tutor chats started" value={s.threads} icon={MessageSquare} />
      <StatCard label="Lessons completed" value={s.completed} icon={PlayCircle} />
      <StatCard label="Average rating" value={s.avgRating} icon={Star} />
      <StatCard label="Feedback messages" value={s.feedback} icon={FileText} />
    </div>
  );
}

function MaterialsAdmin() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialRow | null>(null);
  const [form, setForm] = useState({ ...emptyMaterial });

  const materials = useQuery({
    queryKey: ["admin-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("class_level")
        .order("subject");
      if (error) throw error;
      return data as MaterialRow[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        class_level: Number(form.class_level),
        subject: form.subject.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        kind: form.kind,
        url: form.url.trim(),
        duration_minutes:
          form.kind === "video" && form.duration_minutes !== ""
            ? Number(form.duration_minutes)
            : null,
      };
      if (!payload.title || !payload.subject || !payload.url) {
        throw new Error("Title, subject and link are required.");
      }
      if (editing) {
        const { error } = await supabase.from("materials").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("materials").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Material updated" : "Material added");
      setOpen(false);
      setEditing(null);
      setForm({ ...emptyMaterial });
      queryClient.invalidateQueries({ queryKey: ["admin-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material removed");
      queryClient.invalidateQueries({ queryKey: ["admin-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function startEdit(m: MaterialRow) {
    setEditing(m);
    setForm({
      class_level: m.class_level,
      subject: m.subject,
      title: m.title,
      description: m.description,
      kind: m.kind,
      url: m.url,
      duration_minutes: m.duration_minutes ?? "",
    });
    setOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {materials.data?.length ?? 0} items in the library
        </p>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setEditing(null);
              setForm({ ...emptyMaterial });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> Add material
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit material" : "Add a new material"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="class">Class</Label>
                  <select
                    id="class"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.class_level}
                    onChange={(e) => setForm({ ...form, class_level: Number(e.target.value) })}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => (
                      <option key={c} value={c}>
                        Class {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="kind">Type</Label>
                  <select
                    id="kind"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  >
                    <option value="pdf">Notes / PDF</option>
                    <option value="video">Video lesson</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Mathematics"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Chapter 3 — Fractions"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="description">Short description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="url">Link (PDF or YouTube)</Label>
                <Input
                  id="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              {form.kind === "video" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="duration">Length in minutes</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  />
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-5 grid gap-3">
        {materials.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          : (materials.data ?? []).map((m) => (
              <div
                key={m.id}
                className="surface-panel flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Class {m.class_level}</Badge>
                    <Badge variant="outline">{m.subject}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {m.kind === "pdf" ? "PDF" : "Video"}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-sm font-medium">{m.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.url}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => startEdit(m)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Remove "${m.title}"?`)) remove.mutate(m.id);
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
      </div>
    </div>
  );
}

function StudentsAdmin() {
  const fetchStudents = useServerFn(listStudents);
  const students = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => fetchStudents(),
  });

  if (students.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (students.error) {
    return (
      <p className="text-sm text-destructive">
        Could not load the student list. Please refresh the page.
      </p>
    );
  }

  return (
    <div className="surface-panel overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="p-3">Student</th>
            <th className="p-3">Class</th>
            <th className="p-3">Opened</th>
            <th className="p-3">Completed</th>
            <th className="p-3">Minutes</th>
            <th className="p-3">Last active</th>
          </tr>
        </thead>
        <tbody>
          {(students.data ?? []).map((s) => (
            <tr key={s.id} className="border-b border-border/60 last:border-0">
              <td className="p-3">
                <p className="font-medium">{s.fullName || "—"}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </td>
              <td className="p-3">
                {s.isAdmin ? <Badge>Admin</Badge> : s.classLevel ? `Class ${s.classLevel}` : "—"}
              </td>
              <td className="p-3">{s.opened}</td>
              <td className="p-3">{s.completed}</td>
              <td className="p-3">{s.minutes}</td>
              <td className="p-3 text-xs text-muted-foreground">
                {s.lastSeen ? new Date(s.lastSeen).toLocaleDateString() : "never"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewsAdmin() {
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_reviews")
        .select("id, rating, comment, created_at, material_id, materials(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("material_reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review removed");
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
  });

  if (reviews.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if ((reviews.data ?? []).length === 0) {
    return <p className="text-sm text-muted-foreground">No reviews from students yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {(reviews.data ?? []).map((r) => (
        <div key={r.id} className="surface-panel flex items-start gap-3 p-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-current" />
                ))}
              </span>
              <span className="text-sm font-medium">
                {(r as { materials?: { title?: string } }).materials?.title ?? "Material"}
              </span>
            </div>
            {r.comment ? <p className="mt-1.5 text-sm">{r.comment}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => remove.mutate(r.id)}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function FeedbackAdmin() {
  const queryClient = useQueryClient();
  const feedback = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { error } = await supabase.from("feedback").update({ resolved }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-feedback"] }),
  });

  if (feedback.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if ((feedback.data ?? []).length === 0) {
    return <p className="text-sm text-muted-foreground">No feedback yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {(feedback.data ?? []).map((f) => (
        <div key={f.id} className="surface-panel flex items-start gap-3 p-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{f.category}</Badge>
              {f.resolved ? <Badge variant="secondary">Handled</Badge> : null}
            </div>
            <p className="mt-2 text-sm">{f.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(f.created_at).toLocaleString()}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggle.mutate({ id: f.id, resolved: !f.resolved })}
          >
            {f.resolved ? "Reopen" : "Mark handled"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function TeamAdmin() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const changeAdmin = useServerFn(setAdminByEmail);

  const mutate = useMutation({
    mutationFn: (makeAdmin: boolean) => changeAdmin({ data: { email, makeAdmin } }),
    onSuccess: (_result, makeAdmin) => {
      toast.success(makeAdmin ? "Admin access given" : "Admin access removed");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="surface-panel max-w-lg p-6">
      <h2 className="text-base font-semibold">Give someone admin access</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The person must have signed up on the site first. Then enter their email here.
      </p>
      <div className="mt-4 grid gap-3">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teacher@example.com"
          type="email"
        />
        <div className="flex gap-2">
          <Button onClick={() => mutate.mutate(true)} disabled={mutate.isPending || !email}>
            Make admin
          </Button>
          <Button
            variant="outline"
            onClick={() => mutate.mutate(false)}
            disabled={mutate.isPending || !email}
          >
            Remove admin
          </Button>
        </div>
      </div>
    </div>
  );
}
