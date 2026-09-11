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
          {items.map((m) => (
            <MaterialCard key={m.id} material={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function youtubeId(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  return match?.[1] ?? null;
}

function MaterialCard({ material }: { material: Material }) {
  const videoId = material.kind === "video" ? youtubeId(material.url) : null;

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
        <Button asChild variant="outline" size="sm" className="mt-4 self-start">
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
      </div>
    </article>
  );
}
