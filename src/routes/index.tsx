import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, PlayCircle, MessageCircleQuestion, GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";
import logo from "@/assets/shanti-logo.png";
import heroImage from "@/assets/hero-students.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shanti Education — Study Notes, Video Lessons & AI Tutor" },
      {
        name: "description",
        content:
          "Shanti Education gives students of class 1 to 12 free study PDFs, video lessons and an AI tutor that solves maths and science problems step by step.",
      },
      {
        property: "og:title",
        content: "Shanti Education — Study Notes, Video Lessons & AI Tutor",
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
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Shanti Education" width={40} height={40} className="size-10" />
          <span className="font-display text-lg font-semibold">Shanti Education</span>
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
        <section className="hero-gradient">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 md:grid-cols-2 md:pb-24 md:pt-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <GraduationCap className="size-3.5" /> Class 1 to Class 12
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] md:text-6xl">
                Everything a student needs, in one calm place.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
                Study notes, video lessons and a patient AI tutor that solves even hard maths
                problems step by step — free for every Shanti Education student.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Create your free account
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth">I already have an account</Link>
                </Button>
              </div>
            </div>
            <div className="relative">
              <img
                src={heroImage}
                alt="Students studying together with books and a laptop"
                width={1600}
                height={1008}
                className="w-full rounded-2xl border border-border object-cover shadow-[var(--shadow-lift)]"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-semibold md:text-3xl">Three ways we help you study</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="surface-panel p-6">
                <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="surface-panel hero-gradient flex flex-col items-start gap-5 p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">Ready to start?</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground md:text-base">
                Sign up with your email, pick your class, and your library and tutor are waiting.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Join Shanti Education
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Shanti Education. Learning for every student.
        </div>
      </footer>
    </div>
  );
}
