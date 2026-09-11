import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  FileText,
  PlayCircle,
  ExternalLink,
  Clock,
  CheckCircle2,
  Star,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Study library — Shanti Education" },
      {
        name: "description",
        content:
          "Browse notes, worksheets and video lessons for class 1 to 12 in the Shanti Education study library.",
      },
      { property: "og:title", content: "Study library — Shanti Education" },
      {
        property: "og:description",
        content: "Notes, worksheets and video lessons for class 1 to 12.",
      },
    ],
  }),
  component: Library,
});

type Material = {
  id: string;
  class_level: number;
  subject: string;
  title: string;
  description: string;
  kind: "pdf" | "video";
  url: string;
  duration_minutes: number | null;
};

const CLASSES = Array.from({ length: 12 }, (_, i) => i + 1);

function Library() {
  const [classLevel, setClassLevel] = useState<number | null>(null);
  const [kind, setKind] = useState<"all" | "pdf" | "video">("all");
  const [search, setSearch] = useState("");

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, class_level")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const materialsQuery = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("class_level")
        .order("subject");
      if (error) throw error;
      return data as Material[];
    },
  });

  const progressQuery = useQuery({
    queryKey: ["my-progress"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_progress")
        .select("material_id, status");
      if (error) throw error;
      return data;
    },
  });

  const reviewsQuery = useQuery({
    queryKey: ["all-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_reviews")
        .select("material_id, rating, user_id");
      if (error) throw error;
      return data;
    },
  });

  const activeClass = classLevel ?? profileQuery.data?.class_level ?? null;

  const items = useMemo(() => {
    const all = materialsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    return all.filter((m) => {
      if (activeClass && m.class_level !== activeClass) return false;
      if (kind !== "all" && m.kind !== kind) return false;
      if (
        term &&
        !`${m.title} ${m.subject} ${m.description}`.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [materialsQuery.data, activeClass, kind, search]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Study library</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {profileQuery.data?.full_name
              ? `Welcome back, ${profileQuery.data.full_name.split(" ")[0]}. `
              : ""}
            Notes, worksheets and video lessons for every class.
          </p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a chapter or subject"
          className="w-full max-w-xs"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={activeClass === null ? "default" : "outline"}
          onClick={() => setClassLevel(null)}
        >
          All classes
        </Button>
        {CLASSES.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={activeClass === c ? "default" : "outline"}
            onClick={() => setClassLevel(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["all", "pdf", "video"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={kind === k ? "secondary" : "ghost"}
            onClick={() => setKind(k)}
          >
            {k === "all" ? "Everything" : k === "pdf" ? "Notes & PDFs" : "Videos"}
          </Button>
        ))}
      </div>

      {materialsQuery.isLoading ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          Nothing here yet for this filter. Try another class or subject.
        </p>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => {
            const mine = (reviewsQuery.data ?? []).filter((r) => r.material_id === m.id);
            const avg = mine.length
              ? mine.reduce((a, r) => a + r.rating, 0) / mine.length
              : null;
            return (
              <MaterialCard
                key={m.id}
                material={m}
                done={(progressQuery.data ?? []).some(
                  (p) => p.material_id === m.id && p.status === "completed",
                )}
                averageRating={avg}
                reviewCount={mine.length}
              />
            );
          })}
        </div>
      )}

      <FeedbackBox />
    </div>
  );
}

function FeedbackBox() {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");

  const send = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Please sign in again.");
      if (!message.trim()) throw new Error("Please write a short message first.");
      const { error } = await supabase
        .from("feedback")
        .insert({ user_id: userData.user.id, category, message: message.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      toast.success("Thank you! Your message has reached your teachers.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="surface-panel mt-14 max-w-2xl p-6">
      <h2 className="text-lg font-semibold">Tell us what you need</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Missing a chapter? Something confusing? Write to your teachers here.
      </p>
      <div className="mt-4 grid gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "general", label: "General" },
            { id: "request", label: "Please add this topic" },
            { id: "problem", label: "Something is broken" },
          ].map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={category === c.id ? "secondary" : "ghost"}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </Button>
          ))}
        </div>
        <Textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message here..."
        />
        <Button
          className="self-start"
          onClick={() => send.mutate()}
          disabled={send.isPending}
        >
          <Send className="size-4" /> Send to teachers
        </Button>
      </div>
    </section>
  );
}

function youtubeId(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  return match?.[1] ?? null;
}

function MaterialCard({
  material,
  done,
  averageRating,
  reviewCount,
}: {
  material: Material;
  done: boolean;
  averageRating: number | null;
  reviewCount: number;
}) {
  const videoId = material.kind === "video" ? youtubeId(material.url) : null;
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState(0);

  const markDone = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Please sign in again.");
      const { data: existing } = await supabase
        .from("study_progress")
        .select("id")
        .eq("material_id", material.id)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      const status = done ? "opened" : "completed";
      if (existing) {
        const { error } = await supabase
          .from("study_progress")
          .update({ status })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("study_progress").insert({
          user_id: userData.user.id,
          material_id: material.id,
          status,
          minutes_spent: material.duration_minutes ?? 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-progress"] });
      if (!done) toast.success("Well done! Keep going. 🎉");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rate = useMutation({
    mutationFn: async (rating: number) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Please sign in again.");
      const { data: existing } = await supabase
        .from("material_reviews")
        .select("id")
        .eq("material_id", material.id)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("material_reviews")
          .update({ rating })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("material_reviews").insert({
          user_id: userData.user.id,
          material_id: material.id,
          rating,
          comment: "",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-reviews"] });
      toast.success("Thanks for rating this lesson!");
    },
    onError: (error: Error) => toast.error(error.message),
  });


  return (
    <article className="surface-panel flex flex-col overflow-hidden">
      {videoId ? (
        <div className="aspect-video w-full bg-muted">
          <iframe
            className="size-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title={material.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Class {material.class_level}</Badge>
          <Badge variant="outline">{material.subject}</Badge>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            {material.kind === "pdf" ? (
              <>
                <FileText className="size-3.5" /> PDF
              </>
            ) : (
              <>
                <Clock className="size-3.5" /> {material.duration_minutes} min
              </>
            )}
          </span>
        </div>
        <h3 className="mt-3 text-base font-semibold leading-snug">{material.title}</h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
          {material.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={material.url} target="_blank" rel="noreferrer noopener">
              {material.kind === "pdf" ? (
                <FileText className="size-4" />
              ) : (
                <PlayCircle className="size-4" />
              )}
              {material.kind === "pdf" ? "Open PDF" : "Watch on YouTube"}
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
          <Button
            size="sm"
            variant={done ? "secondary" : "ghost"}
            onClick={() => markDone.mutate()}
            disabled={markDone.isPending}
          >
            <CheckCircle2 className="size-4" />
            {done ? "Done" : "Mark as done"}
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
          <span className="flex items-center gap-0.5" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`Rate ${star} out of 5`}
                onMouseEnter={() => setHovered(star)}
                onClick={() => rate.mutate(star)}
                className="p-0.5 text-amber-500"
              >
                <Star
                  className={`size-4 ${
                    star <= (hovered || Math.round(averageRating ?? 0))
                      ? "fill-current"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </span>
          <span className="text-xs text-muted-foreground">
            {averageRating
              ? `${averageRating.toFixed(1)} from ${reviewCount} student${reviewCount === 1 ? "" : "s"}`
              : "Be the first to rate"}
          </span>
        </div>
      </div>
    </article>
  );
}
