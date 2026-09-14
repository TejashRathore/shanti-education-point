import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

type AnswerInput = {
  questionId: string;
  selectedOption: number | null;
  writtenText: string;
};

/** Opens a test for the signed-in student and returns the paper without the answer key. */
export const getTestPaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { testId: string }) => {
    if (!input?.testId) throw new Error("Missing test.");
    return { testId: String(input.testId) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: test, error } = await supabaseAdmin
      .from("tests")
      .select("*")
      .eq("id", data.testId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!test || !test.published) throw new Error("This test is not available.");

    const now = Date.now();
    if (now < new Date(test.starts_at).getTime()) {
      throw new Error("This test has not started yet.");
    }
    if (now > new Date(test.ends_at).getTime()) {
      throw new Error("This test is closed.");
    }

    const { data: existing } = await supabaseAdmin
      .from("test_attempts")
      .select("id, submitted_at")
      .eq("test_id", data.testId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing?.submitted_at) throw new Error("You have already submitted this test.");

    let attemptId = existing?.id ?? null;
    if (!attemptId) {
      const { data: created, error: createError } = await supabaseAdmin
        .from("test_attempts")
        .insert({ test_id: data.testId, user_id: context.userId })
        .select("id")
        .single();
      if (createError) throw new Error(createError.message);
      attemptId = created.id;
    }

    const { data: questions } = await supabaseAdmin
      .from("test_questions")
      .select("id, position, kind, prompt, options, marks")
      .eq("test_id", data.testId)
      .order("position");

    return {
      attemptId,
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        subject: test.subject,
        classLevel: test.class_level,
        durationMinutes: test.duration_minutes,
        endsAt: test.ends_at,
      },
      questions: (questions ?? []).map((q) => ({
        id: q.id,
        kind: q.kind,
        prompt: q.prompt,
        marks: q.marks,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
      })),
    };
  });

/** Grades the multiple-choice part immediately and stores written answers for the teacher. */
export const submitTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { testId: string; answers: AnswerInput[] }) => {
    if (!input?.testId) throw new Error("Missing test.");
    return {
      testId: String(input.testId),
      answers: (input.answers ?? []).map((a) => ({
        questionId: String(a.questionId),
        selectedOption:
          a.selectedOption === null || a.selectedOption === undefined
            ? null
            : Number(a.selectedOption),
        writtenText: String(a.writtenText ?? ""),
      })),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: test } = await supabaseAdmin
      .from("tests")
      .select("id, ends_at")
      .eq("id", data.testId)
      .maybeSingle();
    if (!test) throw new Error("This test is not available.");

    const { data: attempt } = await supabaseAdmin
      .from("test_attempts")
      .select("id, submitted_at")
      .eq("test_id", data.testId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!attempt) throw new Error("Please open the test again before submitting.");
    if (attempt.submitted_at) throw new Error("You have already submitted this test.");

    const { data: questions } = await supabaseAdmin
      .from("test_questions")
      .select("id, kind, correct_option, marks")
      .eq("test_id", data.testId);

    const byId = new Map((questions ?? []).map((q) => [q.id, q]));
    const totalMarks = (questions ?? []).reduce((sum, q) => sum + (q.marks ?? 0), 0);

    let autoScore = 0;
    const rows = data.answers
      .filter((a) => byId.has(a.questionId))
      .map((a) => {
        const q = byId.get(a.questionId)!;
        let awarded = 0;
        let isCorrect: boolean | null = null;
        if (q.kind === "mcq") {
          isCorrect = a.selectedOption !== null && a.selectedOption === q.correct_option;
          awarded = isCorrect ? (q.marks ?? 0) : 0;
          autoScore += awarded;
        }
        return {
          attempt_id: attempt.id,
          question_id: q.id,
          selected_option: a.selectedOption,
          written_text: a.writtenText,
          awarded_marks: awarded,
          is_correct: isCorrect,
        };
      });

    await supabaseAdmin.from("test_answers").delete().eq("attempt_id", attempt.id);
    if (rows.length) {
      const { error: insertError } = await supabaseAdmin.from("test_answers").insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    const hasWritten = (questions ?? []).some((q) => q.kind === "written");
    const { error: updateError } = await supabaseAdmin
      .from("test_attempts")
      .update({
        submitted_at: new Date().toISOString(),
        auto_score: autoScore,
        total_marks: totalMarks,
        fully_graded: !hasWritten,
      })
      .eq("id", attempt.id);
    if (updateError) throw new Error(updateError.message);

    return { autoScore, totalMarks, needsTeacherGrading: hasWritten };
  });

/** Admin: every submission for one test, with the student's details and answers. */
export const listTestSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { testId: string }) => ({ testId: String(input.testId) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: attempts } = await supabaseAdmin
      .from("test_attempts")
      .select("*")
      .eq("test_id", data.testId)
      .order("submitted_at", { ascending: false });

    const { data: questions } = await supabaseAdmin
      .from("test_questions")
      .select("id, position, kind, prompt, marks, correct_option, options")
      .eq("test_id", data.testId)
      .order("position");

    const attemptIds = (attempts ?? []).map((a) => a.id);
    const { data: answers } = attemptIds.length
      ? await supabaseAdmin.from("test_answers").select("*").in("attempt_id", attemptIds)
      : { data: [] as never[] };

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name");
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return {
      questions: (questions ?? []).map((q) => ({
        id: q.id,
        kind: q.kind,
        prompt: q.prompt,
        marks: q.marks,
      })),
      attempts: (attempts ?? []).map((a) => ({
        id: a.id,
        studentName: nameById.get(a.user_id) || "Student",
        submittedAt: a.submitted_at,
        autoScore: a.auto_score,
        manualScore: a.manual_score,
        totalMarks: a.total_marks,
        fullyGraded: a.fully_graded,
        answers: (answers ?? [])
          .filter((ans) => ans.attempt_id === a.id)
          .map((ans) => ({
            id: ans.id,
            questionId: ans.question_id,
            selectedOption: ans.selected_option,
            writtenText: ans.written_text,
            awardedMarks: ans.awarded_marks,
            isCorrect: ans.is_correct,
          })),
      })),
    };
  });

/** Admin: give marks to one written answer and refresh the attempt total. */
export const gradeWrittenAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { answerId: string; marks: number }) => ({
    answerId: String(input.answerId),
    marks: Math.max(0, Number(input.marks) || 0),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: answer } = await supabaseAdmin
      .from("test_answers")
      .select("id, attempt_id, question_id")
      .eq("id", data.answerId)
      .maybeSingle();
    if (!answer) throw new Error("That answer no longer exists.");

    const { data: question } = await supabaseAdmin
      .from("test_questions")
      .select("marks")
      .eq("id", answer.question_id)
      .maybeSingle();
    const capped = Math.min(data.marks, question?.marks ?? data.marks);

    await supabaseAdmin
      .from("test_answers")
      .update({ awarded_marks: capped })
      .eq("id", answer.id);

    const { data: all } = await supabaseAdmin
      .from("test_answers")
      .select("awarded_marks, question_id, is_correct")
      .eq("attempt_id", answer.attempt_id);

    const { data: attempt } = await supabaseAdmin
      .from("test_attempts")
      .select("test_id")
      .eq("id", answer.attempt_id)
      .maybeSingle();

    const { data: questions } = await supabaseAdmin
      .from("test_questions")
      .select("id, kind")
      .eq("test_id", attempt?.test_id ?? "");

    const writtenIds = new Set(
      (questions ?? []).filter((q) => q.kind === "written").map((q) => q.id),
    );
    const manualScore = (all ?? [])
      .filter((a) => writtenIds.has(a.question_id))
      .reduce((sum, a) => sum + (a.awarded_marks ?? 0), 0);

    await supabaseAdmin
      .from("test_attempts")
      .update({ manual_score: manualScore, fully_graded: true })
      .eq("id", answer.attempt_id);

    return { manualScore };
  });
