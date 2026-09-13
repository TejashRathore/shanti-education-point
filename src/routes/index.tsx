import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, PlayCircle, MessageCircleQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import logo from "@/assets/shanti-education-point-logo.png.asset.json";
import heroImage from "@/assets/hero-students.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shanti Education Point — Study Notes & AI Tutor" },
      {
        name: "description",
        content:
          "Shanti Education Point gives class 1 to 12 students study PDFs, video lessons and precise AI tutoring for every subject.",
      },
      {
        property: "og:title",
        content: "Shanti Education Point — Study Notes & AI Tutor",
      },
      {
        property: "og:description",
        content:
          "Study PDFs, video lessons and a 24/7 AI tutor for class 1 to 12 students.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: BookOpen,
    title: "Notes & worksheets",
    body: "Chapter notes, practice sheets and solved papers for every class, ready to read or download.",
  },
  {
    icon: PlayCircle,
    title: "Video lessons",
    body: "Short, clear lessons that explain each concept the way a teacher would in class.",
  },
  {
    icon: MessageCircleQuestion,
    title: "AI tutor, any time",
    body: "Stuck at midnight? Ask the tutor. It works through maths problems step by step and checks its own answer.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:py-6">
        <div className="flex items-center gap-2.5">
          <img src={logo.url} alt="Shanti Education Point logo" width={62} height={38} className="h-10 w-auto" />
          <span className="font-display text-sm font-semibold sm:text-lg">Shanti Education Point</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/auth" search={{ mode: "signup" }}>
              Join free
            </Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="border-y border-border bg-secondary">
          <div className="mx-auto max-w-6xl px-5 pb-12 pt-10 md:pb-16 md:pt-16">
            <div className="max-w-4xl">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Learning for Class 1 to Class 12</p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] sm:text-5xl md:text-7xl">
                Learn clearly. Grow confidently.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Notes, video lessons and a kind AI tutor that explains difficult questions step by step, in language every student can understand.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/auth" search={{ mode: "signup" }}>Start learning <ArrowRight className="size-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth">Open your account</Link>
                </Button>
              </div>
            </div>
            <img
              src={heroImage}
              alt="Students studying together with books and a laptop"
              width={1600}
              height={1008}
              className="mt-10 aspect-[16/7] w-full rounded-lg object-cover object-center shadow-[var(--shadow-lift)]"
            />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-8 md:grid-cols-[0.7fr_1.3fr] md:gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Your learning toolkit</p>
              <h2 className="mt-3 text-2xl font-semibold md:text-3xl">Three simple ways to move forward</h2>
            </div>
            <div className="divide-y divide-border border-y border-border">
            {features.map((f) => (
              <article key={f.title} className="grid gap-4 py-6 sm:grid-cols-[auto_1fr] sm:gap-5">
                <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
                  <f.icon className="size-5" />
                </div>
                <div><h3 className="text-lg font-semibold">{f.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p></div>
              </article>
            ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="flex flex-col items-start gap-5 border-y border-border bg-secondary px-6 py-10 md:flex-row md:items-center md:justify-between md:px-10">
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">Ready to start?</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground md:text-base">
                Sign up with your email, pick your class, and your library and tutor are waiting.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Join Shanti Education Point
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Shanti Education Point. Learning for every student.
        </div>
      </footer>
    </div>
  );
}
