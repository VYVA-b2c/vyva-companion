import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, CheckCircle2, ChevronLeft, ChevronRight, Download, FilePlus2, ImagePlus, Loader2, Save, Search, Sparkles, Upload } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";

type Category = {
  slug: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
};

type LessonStatus = "draft" | "review" | "published" | "archived";
type LessonDifficulty = "easy" | "medium" | "deep";
type ImageFilter = "all" | "missing" | "with_image";

type Lesson = {
  id: string;
  externalId: string | null;
  categorySlug: string;
  language: string;
  title: string;
  hook: string;
  body: string;
  reflectionPrompt: string;
  sourceNotes: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  imagePrompt: string | null;
  estimatedMinutes: number;
  difficulty: LessonDifficulty;
  tags: string[];
  status: LessonStatus;
  isActive: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  updatedAt: string | null;
};

type LessonDraft = Omit<Lesson, "id" | "reviewedAt" | "reviewedBy" | "publishedAt" | "publishedBy" | "archivedAt" | "archivedBy" | "updatedAt"> & {
  id?: string;
  tagsText: string;
};

const coverageLanguages = ["en", "es", "fr", "de", "it", "pt"] as const;
type CoverageLanguage = typeof coverageLanguages[number];

const emptyLesson = (categorySlug = "general_knowledge"): LessonDraft => ({
  externalId: null,
  categorySlug,
  language: "en",
  title: "",
  hook: "",
  body: "",
  reflectionPrompt: "",
  sourceNotes: "",
  imageUrl: "",
  imageAlt: "",
  imagePrompt: "",
  estimatedMinutes: 3,
  difficulty: "easy",
  tags: [],
  tagsText: "",
  status: "draft",
  isActive: false,
});

function lessonToDraft(lesson: Lesson): LessonDraft {
  return {
    ...lesson,
    sourceNotes: lesson.sourceNotes ?? "",
    imageUrl: lesson.imageUrl ?? "",
    imageAlt: lesson.imageAlt ?? "",
    imagePrompt: lesson.imagePrompt ?? "",
    tagsText: lesson.tags.join(", "),
  };
}

function draftToPayload(draft: LessonDraft) {
  return {
    externalId: draft.externalId || null,
    categorySlug: draft.categorySlug,
    language: draft.language,
    title: draft.title,
    hook: draft.hook,
    body: draft.body,
    reflectionPrompt: draft.reflectionPrompt,
    sourceNotes: draft.sourceNotes || null,
    imageUrl: draft.imageUrl || null,
    imageAlt: draft.imageAlt || null,
    imagePrompt: draft.imagePrompt || null,
    estimatedMinutes: Number(draft.estimatedMinutes),
    difficulty: draft.difficulty,
    tags: draft.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
    status: draft.status,
    isActive: draft.status === "published" ? true : draft.isActive,
  };
}

function statusClass(status: LessonStatus) {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  if (status === "review") return "bg-sky-50 text-sky-700";
  return "bg-amber-50 text-amber-800";
}

function isPublishableStatus(status: LessonStatus) {
  return status === "draft" || status === "review";
}

function isCoverageLanguage(value: string): value is CoverageLanguage {
  return coverageLanguages.includes(value as CoverageLanguage);
}

function normalizeCoverageLanguage(language: string) {
  const normalized = language.toLowerCase().split(/[-_]/)[0] ?? "";
  return isCoverageLanguage(normalized) ? normalized : null;
}

type CoverageCounts = { published: number; pending: number; archived: number; total: number };

function coverageCellClass(counts: CoverageCounts, active = false) {
  if (active) return "border-purple-300 bg-purple-50 text-purple-800 ring-2 ring-purple-100";
  if (counts.published > 0) return "border-emerald-100 bg-emerald-50 text-emerald-800";
  if (counts.pending > 0) return "border-amber-100 bg-amber-50 text-amber-800";
  if (counts.archived > 0) return "border-slate-100 bg-slate-50 text-slate-600";
  return "border-[#eadfd5] bg-[#FFFCF8] text-[#8b7a73]";
}

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-[#4d4351]">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "h-11 w-full rounded-xl border border-[#E5D8CA] bg-white px-3 text-sm font-semibold text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";
const textareaClass = "min-h-[92px] w-full rounded-xl border border-[#E5D8CA] bg-white px-3 py-3 text-sm font-semibold leading-relaxed text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";
const lessonPageSizeOptions = [25, 50, 100];

const defaultTemplateCategories = [
  {
    slug: "science",
    label: "Science",
    description: "Short discoveries about the world and how it works.",
    color: "#2563EB",
    icon: "atom",
    sort_order: 10,
    is_active: true,
  },
  {
    slug: "language",
    label: "Language",
    description: "Words, meanings, memory, and communication.",
    color: "#7C3AED",
    icon: "languages",
    sort_order: 20,
    is_active: true,
  },
  {
    slug: "arts",
    label: "Arts",
    description: "Painting, design, craft, and creative observation.",
    color: "#DB2777",
    icon: "palette",
    sort_order: 30,
    is_active: true,
  },
  {
    slug: "general_knowledge",
    label: "General Knowledge",
    description: "Useful everyday facts and gentle trivia.",
    color: "#B45309",
    icon: "sparkles",
    sort_order: 40,
    is_active: true,
  },
  {
    slug: "music",
    label: "Music",
    description: "Songs, rhythm, instruments, and listening.",
    color: "#0F766E",
    icon: "music",
    sort_order: 50,
    is_active: true,
  },
  {
    slug: "history",
    label: "History",
    description: "Human stories, objects, places, and time.",
    color: "#92400E",
    icon: "landmark",
    sort_order: 60,
    is_active: true,
  },
  {
    slug: "nature",
    label: "Nature",
    description: "Plants, animals, seasons, and habitats.",
    color: "#0A7C4E",
    icon: "leaf",
    sort_order: 70,
    is_active: true,
  },
  {
    slug: "technology",
    label: "Technology",
    description: "Simple explanations of modern tools.",
    color: "#475569",
    icon: "cpu",
    sort_order: 80,
    is_active: true,
  },
];

function buildLearningContentTemplate(categories: Category[]) {
  const templateCategories = categories.length > 0
    ? categories.map((category) => ({
      slug: category.slug,
      label: category.label,
      description: category.description,
      color: category.color,
      icon: category.icon,
      sort_order: category.sortOrder,
      is_active: category.isActive,
    }))
    : defaultTemplateCategories;
  const sampleCategory = templateCategories.find((category) => category.is_active) ?? templateCategories[0] ?? defaultTemplateCategories[3];

  return {
    schema_version: "learning_content_pack_v1",
    supported_languages: coverageLanguages,
    upload_format: "grouped_translations",
    categories: templateCategories,
    lessons: [
      {
        external_id_base: `${sampleCategory.slug}-lesson-001`,
        category_slug: sampleCategory.slug,
        estimated_minutes: 3,
        difficulty: "easy",
        tags: ["starter", sampleCategory.slug],
        status: "draft",
        is_active: false,
        image_url: "https://example.com/learning/custom-lesson-image.png",
        image_prompt: "Describe the exact custom image for this lesson. Include the subject, setting, objects, mood, style, and what should not appear.",
        translations: {
          en: {
            title: "Replace with a clear English lesson title",
            hook: "Open with one inviting English sentence that makes the topic feel worth learning.",
            body: "Write a short, warm English learning snippet. Keep it practical, accurate, and easy to finish in a few minutes.",
            reflection_prompt: "End with one gentle English question that helps the learner connect the idea to memory or daily life.",
            image_alt: "Describe the custom image in plain English for screen readers.",
            source_notes: "Add source, citation, reviewer note, or internal provenance here.",
          },
          es: {
            title: "Replace with the Spanish lesson title",
            hook: "Write the Spanish hook for this lesson.",
            body: "Write the Spanish learning snippet for this lesson.",
            reflection_prompt: "Write the Spanish reflection prompt for this lesson.",
            image_alt: "Describe the custom image in Spanish for screen readers.",
            source_notes: "Optional Spanish reviewer note or source.",
          },
          fr: {
            title: "Replace with the French lesson title",
            hook: "Write the French hook for this lesson.",
            body: "Write the French learning snippet for this lesson.",
            reflection_prompt: "Write the French reflection prompt for this lesson.",
            image_alt: "Describe the custom image in French for screen readers.",
            source_notes: "Optional French reviewer note or source.",
          },
          de: {
            title: "Replace with the German lesson title",
            hook: "Write the German hook for this lesson.",
            body: "Write the German learning snippet for this lesson.",
            reflection_prompt: "Write the German reflection prompt for this lesson.",
            image_alt: "Describe the custom image in German for screen readers.",
            source_notes: "Optional German reviewer note or source.",
          },
          it: {
            title: "Replace with the Italian lesson title",
            hook: "Write the Italian hook for this lesson.",
            body: "Write the Italian learning snippet for this lesson.",
            reflection_prompt: "Write the Italian reflection prompt for this lesson.",
            image_alt: "Describe the custom image in Italian for screen readers.",
            source_notes: "Optional Italian reviewer note or source.",
          },
          pt: {
            title: "Replace with the Portuguese lesson title",
            hook: "Write the Portuguese hook for this lesson.",
            body: "Write the Portuguese learning snippet for this lesson.",
            reflection_prompt: "Write the Portuguese reflection prompt for this lesson.",
            image_alt: "Describe the custom image in Portuguese for screen readers.",
            source_notes: "Optional Portuguese reviewer note or source.",
          },
        },
      },
    ],
  };
}

function parseLearningContentPackText(text: string) {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch (error) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as unknown;
    }
    throw error;
  }
}

function responseErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as Record<string, unknown>;
  const primary =
    typeof body.error === "string" && body.error.trim()
      ? body.error.trim()
      : typeof body.message === "string" && body.message.trim()
        ? body.message.trim()
        : fallback;
  const details = [
    ...(Array.isArray(body.details)
      ? body.details.map((detail) => typeof detail === "string" ? detail.trim() : "").filter(Boolean)
      : typeof body.details === "string" && body.details.trim()
        ? [body.details.trim()]
        : []),
    ...(typeof body.detail === "string" && body.detail.trim() ? [body.detail.trim()] : []),
  ].filter((detail, index, all) => detail !== primary && all.indexOf(detail) === index);

  return [primary, ...details].join(" ");
}

export default function LearningLibraryAdminPage() {
  const [searchParams] = useSearchParams();
  const focusedLessonId = searchParams.get("focus");
  const [categories, setCategories] = useState<Category[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [coverageLessons, setCoverageLessons] = useState<Lesson[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<LessonDraft>(emptyLesson());
  const [statusFilter, setStatusFilter] = useState<LessonStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [imageFilter, setImageFilter] = useState<ImageFilter>("all");
  const [search, setSearch] = useState("");
  const [lessonPage, setLessonPage] = useState(1);
  const [lessonPageSize, setLessonPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [bulkGeneratingImages, setBulkGeneratingImages] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [editorMessage, setEditorMessage] = useState("");

  const selectedLesson = useMemo(() => lessons.find((lesson) => lesson.id === selectedId) ?? null, [lessons, selectedId]);
  const lessonById = useMemo(() => new Map(lessons.map((lesson) => [lesson.id, lesson])), [lessons]);
  const selectedLessonIdSet = useMemo(() => new Set(selectedLessonIds), [selectedLessonIds]);
  const lessonCount = lessons.length;
  const lessonPageCount = Math.max(1, Math.ceil(lessonCount / lessonPageSize));
  const boundedLessonPage = Math.min(lessonPage, lessonPageCount);
  const lessonPageStartIndex = lessonCount === 0 ? 0 : (boundedLessonPage - 1) * lessonPageSize;
  const lessonPageEndIndex = Math.min(lessonPageStartIndex + lessonPageSize, lessonCount);
  const visibleLessons = useMemo(
    () => lessons.slice(lessonPageStartIndex, lessonPageEndIndex),
    [lessonPageEndIndex, lessonPageStartIndex, lessons],
  );
  const publishableVisibleLessonIds = useMemo(
    () => visibleLessons.filter((lesson) => isPublishableStatus(lesson.status)).map((lesson) => lesson.id),
    [visibleLessons],
  );
  const selectedPublishableLessonIds = useMemo(
    () => selectedLessonIds.filter((id) => {
      const lesson = lessonById.get(id);
      return lesson ? isPublishableStatus(lesson.status) : false;
    }),
    [lessonById, selectedLessonIds],
  );
  const allVisibleDraftsSelected = publishableVisibleLessonIds.length > 0 && publishableVisibleLessonIds.every((id) => selectedLessonIdSet.has(id));
  const coverageRows = useMemo(() => {
    return categories.map((category) => {
      const languages = coverageLanguages.reduce((accumulator, language) => {
        accumulator[language] = { published: 0, pending: 0, archived: 0, total: 0 };
        return accumulator;
      }, {} as Record<CoverageLanguage, { published: number; pending: number; archived: number; total: number }>);

      for (const lesson of coverageLessons) {
        if (lesson.categorySlug !== category.slug) continue;
        const language = normalizeCoverageLanguage(lesson.language);
        if (!language) continue;
        const counts = languages[language];
        counts.total += 1;
        if (lesson.status === "published" && lesson.isActive) {
          counts.published += 1;
        } else if (isPublishableStatus(lesson.status)) {
          counts.pending += 1;
        } else {
          counts.archived += 1;
        }
      }

      return {
        category,
        total: Object.values(languages).reduce((sum, counts) => sum + counts.total, 0),
        languages,
      };
    });
  }, [categories, coverageLessons]);
  const coverageSummary = useMemo(() => {
    return coverageLessons.reduce(
      (summary, lesson) => {
        const language = normalizeCoverageLanguage(lesson.language);
        if (!language) return summary;
        summary.total += 1;
        if (lesson.status === "published" && lesson.isActive) summary.published += 1;
        if (isPublishableStatus(lesson.status)) summary.pending += 1;
        return summary;
      },
      { total: 0, published: 0, pending: 0 },
    );
  }, [coverageLessons]);
  const imageCoverageSummary = useMemo(() => {
    return coverageLessons.reduce(
      (summary, lesson) => {
        if (lesson.status !== "published" || !lesson.isActive) return summary;
        summary.total += 1;
        if (lesson.imageUrl?.trim()) {
          summary.ready += 1;
        } else {
          summary.missing += 1;
        }
        return summary;
      },
      { total: 0, ready: 0, missing: 0 },
    );
  }, [coverageLessons]);
  const imageCoveragePercent = imageCoverageSummary.total > 0
    ? Math.round((imageCoverageSummary.ready / imageCoverageSummary.total) * 100)
    : 0;

  const lessonQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", statusFilter);
    params.set("category", categoryFilter);
    params.set("language", languageFilter);
    params.set("image", imageFilter);
    if (search.trim()) params.set("search", search.trim());
    return `/api/admin/learning/lessons?${params.toString()}`;
  }, [categoryFilter, imageFilter, languageFilter, search, statusFilter]);

  async function loadData(options: { clearMessage?: boolean } = {}) {
    setLoading(true);
    if (options.clearMessage !== false) setMessage("");
    try {
      const [categoriesResponse, lessonsResponse, coverageResponse] = await Promise.all([
        apiFetch("/api/admin/learning/categories"),
        apiFetch(lessonQuery),
        apiFetch("/api/admin/learning/lessons?status=all&category=all&language=all"),
      ]);
      const [categoriesPayload, lessonsPayload, coveragePayload] = await Promise.all([
        categoriesResponse.json().catch(() => ({})),
        lessonsResponse.json().catch(() => ({})),
        coverageResponse.json().catch(() => ({})),
      ]);
      if (!categoriesResponse.ok) throw new Error(responseErrorMessage(categoriesPayload, "Could not load categories."));
      if (!lessonsResponse.ok) throw new Error(responseErrorMessage(lessonsPayload, "Could not load lessons."));
      if (!coverageResponse.ok) throw new Error(responseErrorMessage(coveragePayload, "Could not load language coverage."));
      const nextCategories = (categoriesPayload.categories ?? []) as Category[];
      const nextLessons = (lessonsPayload.lessons ?? []) as Lesson[];
      setCategories(nextCategories);
      setLessons(nextLessons);
      setCoverageLessons((coveragePayload.lessons ?? []) as Lesson[]);
      const focusedLesson = focusedLessonId ? nextLessons.find((lesson) => lesson.id === focusedLessonId) : null;
      const selectedLessonIsVisible = selectedId ? nextLessons.some((lesson) => lesson.id === selectedId) : false;
      if (focusedLesson) {
        setSelectedId(focusedLesson.id);
        setDraft(lessonToDraft(focusedLesson));
      } else if ((!selectedId || !selectedLessonIsVisible) && nextLessons[0]) {
        setSelectedId(nextLessons[0].id);
        setDraft(lessonToDraft(nextLessons[0]));
      } else if ((!selectedId || !selectedLessonIsVisible) && !nextLessons[0]) {
        setSelectedId("");
        const nextDraft = emptyLesson(categoryFilter === "all" ? nextCategories[0]?.slug ?? "general_knowledge" : categoryFilter);
        const focusedLanguage = normalizeCoverageLanguage(languageFilter);
        setDraft(focusedLanguage ? { ...nextDraft, language: focusedLanguage } : nextDraft);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Learning library could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonQuery]);

  useEffect(() => {
    setLessonPage(1);
  }, [lessonQuery]);

  useEffect(() => {
    setLessonPage((current) => Math.min(current, lessonPageCount));
  }, [lessonPageCount]);

  useEffect(() => {
    if (selectedLesson) setDraft(lessonToDraft(selectedLesson));
  }, [selectedLesson]);

  useEffect(() => {
    if (!focusedLessonId || selectedId !== focusedLessonId) return;
    document.getElementById(`learning-lesson-${focusedLessonId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedLessonId, selectedId]);

  useEffect(() => {
    const visibleLessonIds = new Set(lessons.map((lesson) => lesson.id));
    setSelectedLessonIds((current) => {
      const next = current.filter((id) => visibleLessonIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [lessons]);

  function toggleLessonSelection(lessonId: string) {
    setSelectedLessonIds((current) => (
      current.includes(lessonId)
        ? current.filter((id) => id !== lessonId)
        : [...current, lessonId]
    ));
  }

  function toggleVisibleDraftSelection() {
    setSelectedLessonIds((current) => {
      const next = new Set(current);
      if (allVisibleDraftsSelected) {
        for (const lessonId of publishableVisibleLessonIds) next.delete(lessonId);
      } else {
        for (const lessonId of publishableVisibleLessonIds) next.add(lessonId);
      }
      return [...next];
    });
  }

  async function saveLesson(nextStatus?: LessonStatus): Promise<Lesson | null> {
    const nextDraft = nextStatus ? { ...draft, status: nextStatus, isActive: nextStatus === "published" } : draft;
    setSaving(true);
    setMessage("");
    setEditorMessage("");
    try {
      const response = await apiFetch(nextDraft.id ? `/api/admin/learning/lessons/${nextDraft.id}` : "/api/admin/learning/lessons", {
        method: nextDraft.id ? "PATCH" : "POST",
        body: JSON.stringify(draftToPayload(nextDraft)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseErrorMessage(payload, "Lesson could not be saved."));
      const saved = payload.lesson as Lesson;
      setLessons((current) => {
        const exists = current.some((lesson) => lesson.id === saved.id);
        return exists ? current.map((lesson) => lesson.id === saved.id ? saved : lesson) : [saved, ...current];
      });
      setCoverageLessons((current) => {
        const exists = current.some((lesson) => lesson.id === saved.id);
        return exists ? current.map((lesson) => lesson.id === saved.id ? saved : lesson) : [saved, ...current];
      });
      setSelectedId(saved.id);
      setDraft(lessonToDraft(saved));
      const nextMessage = nextStatus === "published" ? "Lesson published." : nextStatus === "archived" ? "Lesson archived." : "Lesson saved.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
      return saved;
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Lesson could not be saved.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function generateLessonImage() {
    setGeneratingImage(true);
    setMessage("");
    setEditorMessage("");
    try {
      const saved = await saveLesson();
      if (!saved) return;

      setMessage("");
      setEditorMessage("Generating image...");
      const response = await apiFetch(`/api/admin/learning/lessons/${saved.id}/generate-image`, {
        method: "POST",
        body: JSON.stringify({
          imagePrompt: saved.imagePrompt || null,
          imageAlt: saved.imageAlt || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseErrorMessage(payload, "Lesson image could not be generated."));
      const generatedLesson = payload.lesson as Lesson;
      setLessons((current) => current.map((lesson) => lesson.id === generatedLesson.id ? generatedLesson : lesson));
      setCoverageLessons((current) => current.map((lesson) => lesson.id === generatedLesson.id ? generatedLesson : lesson));
      setSelectedId(generatedLesson.id);
      setDraft(lessonToDraft(generatedLesson));
      setMessage("Image generated and saved.");
      setEditorMessage("Image generated and saved.");
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Lesson image could not be generated.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
    } finally {
      setGeneratingImage(false);
    }
  }

  async function generateMissingImages() {
    setBulkGeneratingImages(true);
    setMessage("");
    setEditorMessage("");
    try {
      const response = await apiFetch("/api/admin/learning/lessons/generate-missing-images", {
        method: "POST",
        body: JSON.stringify({
          limit: 5,
          status: "published",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseErrorMessage(payload, "Missing lesson images could not be generated."));
      await loadData({ clearMessage: false });
      const summary = payload.summary ?? {};
      const generated = Number(summary.lessonsGenerated ?? 0);
      const failed = Number(summary.lessonsFailed ?? 0);
      const missingAfter = Number(summary.missingPublishedAfter ?? Math.max(0, imageCoverageSummary.missing - generated));
      const nextMessage = generated === 0 && failed === 0
        ? "All published lessons already have custom images."
        : failed > 0
          ? `Generated ${generated} image${generated === 1 ? "" : "s"}; ${failed} failed. ${missingAfter} published lesson${missingAfter === 1 ? "" : "s"} still need images.`
          : `Generated ${generated} image${generated === 1 ? "" : "s"}. ${missingAfter} published lesson${missingAfter === 1 ? "" : "s"} still need images.`;
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Missing lesson images could not be generated.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
    } finally {
      setBulkGeneratingImages(false);
    }
  }

  async function quickAction(action: "publish" | "archive") {
    if (!draft.id) {
      await saveLesson(action === "publish" ? "published" : "archived");
      return;
    }

    setSaving(true);
    setMessage("");
    setEditorMessage("");
    try {
      const response = await apiFetch(`/api/admin/learning/lessons/${draft.id}/${action}`, { method: "PATCH" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseErrorMessage(payload, `Lesson could not be ${action}ed.`));
      const saved = payload.lesson as Lesson;
      setLessons((current) => current.map((lesson) => lesson.id === saved.id ? saved : lesson));
      setCoverageLessons((current) => current.map((lesson) => lesson.id === saved.id ? saved : lesson));
      setSelectedId(saved.id);
      setDraft(lessonToDraft(saved));
      const nextMessage = action === "publish" ? "Lesson published." : "Lesson archived.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
      void loadData({ clearMessage: false });
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Lesson could not be updated.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  const startNewLesson = () => {
    setSelectedId("");
    setDraft(emptyLesson(categories[0]?.slug ?? "general_knowledge"));
    setEditorMessage("");
  };

  function focusCoverageCell(category: Category, language: CoverageLanguage, counts: CoverageCounts) {
    setCategoryFilter(category.slug);
    setLanguageFilter(language);
    setImageFilter("all");
    setSearch("");
    setLessonPage(1);
    if (counts.published > 0) {
      setStatusFilter("published");
      setEditorMessage("");
      return;
    }
    if (counts.archived > 0 && counts.pending === 0) {
      setStatusFilter("archived");
      setEditorMessage("");
      return;
    }
    setStatusFilter("all");
    if (counts.total === 0) {
      setSelectedId("");
      setDraft({ ...emptyLesson(category.slug), language });
      setEditorMessage(`Ready to create a ${language.toUpperCase()} lesson for ${category.label}.`);
    } else {
      setEditorMessage("");
    }
  }

  async function bulkPublishDrafts(lessonIds?: string[]) {
    const selectedIds = lessonIds ? [...new Set(lessonIds)] : [];
    const hasSelection = selectedIds.length > 0;
    setBulkPublishing(true);
    setMessage("");
    setEditorMessage("");
    try {
      const response = await apiFetch("/api/admin/learning/lessons/bulk-publish", {
        method: "PATCH",
        ...(hasSelection ? { body: JSON.stringify({ lessonIds: selectedIds }) } : {}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseErrorMessage(payload, "Lessons could not be published."));
      await loadData({ clearMessage: false });
      const count = payload.summary?.lessonsPublished ?? 0;
      const nextMessage = hasSelection
        ? count === 1 ? "Published 1 selected lesson." : `Published ${count} selected lessons.`
        : count === 1 ? "Published 1 draft lesson." : `Published ${count} draft lessons.`;
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
      if (hasSelection) {
        setSelectedLessonIds((current) => current.filter((id) => !selectedIds.includes(id)));
      }
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Lessons could not be published.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
    } finally {
      setBulkPublishing(false);
    }
  }

  async function importContentPack(file: File | null | undefined) {
    if (!file) return;
    setImporting(true);
    setMessage("");
    setEditorMessage("");
    try {
      const text = await file.text();
      const pack = parseLearningContentPackText(text);
      const response = await apiFetch("/api/admin/learning/import", {
        method: "POST",
        body: JSON.stringify(pack),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseErrorMessage(payload, "Content pack could not be imported."));
      }
      const summary = payload.summary ?? {};
      setSelectedId("");
      await loadData();
      setMessage(`Import complete. Categories: ${summary.categoriesCreated ?? 0} new, ${summary.categoriesUpdated ?? 0} updated. Lessons: ${summary.lessonsCreated ?? 0} new, ${summary.lessonsUpdated ?? 0} updated.`);
    } catch (error) {
      setMessage(error instanceof SyntaxError ? "Content pack must be valid JSON. Download the template, paste lesson content into it, then upload again." : error instanceof Error ? error.message : "Content pack could not be imported.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([JSON.stringify(buildLearningContentTemplate(categories), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "learning-library-template.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage("Learning library template download started.");
    setEditorMessage("");
  }

  return (
    <main className="min-h-screen bg-[#F7F2EB] px-5 py-6 text-[#2f2135]">
      <div className="mx-auto w-full max-w-7xl">
        <AdminPageHeader
          title="Learning library"
          subtitle="Create, review, publish, and archive curated lessons for Learn Something New."
        >
          <div className="flex flex-wrap gap-2">
            <input
              id="learning-content-pack-upload"
              type="file"
              accept="application/json,text/plain,.json,.txt"
              className="sr-only"
              disabled={importing}
              onChange={(event) => {
                void importContentPack(event.target.files?.[0]);
                event.target.value = "";
              }}
              data-testid="input-admin-learning-import"
            />
            <label
              htmlFor="learning-content-pack-upload"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-3 py-2 text-sm font-bold text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700"
            >
              {importing ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              Upload JSON/TXT
            </label>
            <button
              type="button"
              onClick={startNewLesson}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-purple-800"
              data-testid="button-admin-learning-create"
            >
              <FilePlus2 size={16} />
              Create lesson
            </button>
            <button
              type="button"
              disabled={bulkPublishing || saving || importing}
              onClick={() => void bulkPublishDrafts()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              data-testid="button-admin-learning-bulk-publish"
            >
              {bulkPublishing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Publish all drafts
            </button>
          </div>
        </AdminPageHeader>
        <AdminMenu />

        <section className="mt-4 rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm" aria-labelledby="learning-template-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">Content template</p>
              <h2 id="learning-template-title" className="mt-1 text-lg font-black text-[#2f2135]">Learning library JSON</h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-[#7d6b65]">
                Download a ready-to-fill multilingual file with the current categories, one sample lesson, custom image fields, and every field needed for bulk upload. Upload accepts .json files or plain .txt files containing JSON.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2f2135] px-4 text-sm font-black text-white transition hover:bg-purple-800"
              data-testid="button-admin-learning-template"
            >
              <Download size={16} />
              Download template
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-[#7d6b65]">
            <span className="rounded-full bg-[#FBF8F5] px-3 py-1">{categories.length || defaultTemplateCategories.length} categories</span>
            <span className="rounded-full bg-[#FBF8F5] px-3 py-1">{coverageLanguages.length} languages</span>
            <span className="rounded-full bg-[#FBF8F5] px-3 py-1">Grouped translations</span>
            <span className="rounded-full bg-[#FBF8F5] px-3 py-1">Custom image fields</span>
          </div>
        </section>

        {message ? (
          <p className="mt-4 rounded-2xl border border-[#eadfd5] bg-white px-4 py-3 text-sm font-bold text-[#5b4a46]" data-testid="admin-learning-message">
            {message}
          </p>
        ) : null}

        <section
          className="mt-5 rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm"
          aria-labelledby="learning-coverage-title"
          data-testid="admin-learning-coverage"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">Content coverage</p>
              <h2 id="learning-coverage-title" className="mt-1 text-lg font-black text-[#2f2135]">Language coverage</h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-[#7d6b65]">
                Published lesson availability by category and language. English remains the fallback when a learner's language is missing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-black text-[#7d6b65]">
              <span className="rounded-full bg-[#FBF8F5] px-3 py-1">{coverageSummary.published} live</span>
              <span className="rounded-full bg-[#FBF8F5] px-3 py-1">{coverageSummary.pending} draft</span>
              <span className="rounded-full bg-[#FBF8F5] px-3 py-1">{coverageSummary.total} total</span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[180px_repeat(6,minmax(86px,1fr))] gap-2 px-1 text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">
                <span>Category</span>
                {coverageLanguages.map((language) => <span key={language}>{language.toUpperCase()}</span>)}
              </div>
              <div className="mt-2 grid gap-2">
                {coverageRows.length === 0 ? (
                  <div className="rounded-2xl border border-[#eadfd5] bg-[#FFFCF8] px-4 py-6 text-center text-sm font-bold text-[#7d6b65]">
                    Coverage appears after categories load.
                  </div>
                ) : coverageRows.map((row) => (
                  <div
                    key={row.category.slug}
                    className="grid grid-cols-[180px_repeat(6,minmax(86px,1fr))] items-stretch gap-2"
                  >
                    <div className="rounded-xl border border-[#eadfd5] bg-[#FFFCF8] px-3 py-2">
                      <p className="truncate text-sm font-black text-[#2f2135]">{row.category.label}</p>
                      <p className="mt-0.5 text-xs font-bold text-[#8b7a73]">{row.total} lesson{row.total === 1 ? "" : "s"}</p>
                    </div>
                    {coverageLanguages.map((language) => {
                      const counts = row.languages[language];
                      const detail = counts.total === 0
                        ? "missing"
                        : counts.pending > 0
                          ? `${counts.pending} draft`
                          : counts.archived > 0 && counts.published === 0
                            ? `${counts.archived} archived`
                            : `${counts.total} total`;

                      const active = categoryFilter === row.category.slug && languageFilter === language;
                      return (
                        <button
                          type="button"
                          key={`${row.category.slug}-${language}`}
                          onClick={() => focusCoverageCell(row.category, language, counts)}
                          className={`rounded-xl border px-3 py-2 text-left transition hover:border-purple-200 hover:bg-purple-50 focus:outline-none focus:ring-4 focus:ring-purple-100 ${coverageCellClass(counts, active)}`}
                          aria-label={`${row.category.label} ${language.toUpperCase()} coverage: ${counts.published} live, ${detail}`}
                          data-testid={`admin-learning-coverage-cell-${row.category.slug}-${language}`}
                        >
                          <p className="text-sm font-black">{counts.published > 0 ? `${counts.published} live` : "0 live"}</p>
                          <p className="sr-only">{detail}</p>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          className="mt-5 rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm"
          aria-labelledby="learning-image-coverage-title"
          data-testid="admin-learning-image-coverage"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">Visual coverage</p>
              <h2 id="learning-image-coverage-title" className="mt-1 text-lg font-black text-[#2f2135]">Custom lesson images</h2>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#7d6b65]">
                Published lessons should have a lesson-specific image before they reach learners. Generate a small batch, review, then continue.
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#E9E0D8]" aria-label={`${imageCoveragePercent}% of published lessons have custom images`}>
                <div
                  className="h-full rounded-full bg-[#6D28D9] transition-all"
                  style={{ width: `${imageCoveragePercent}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:min-w-[360px]">
              <div className="flex flex-wrap gap-2 text-xs font-black text-[#7d6b65]">
                <span className="rounded-full bg-[#FBF8F5] px-3 py-1">{imageCoverageSummary.ready} ready</span>
                <span className="rounded-full bg-[#FBF8F5] px-3 py-1">{imageCoverageSummary.missing} missing</span>
                <span className="rounded-full bg-[#FBF8F5] px-3 py-1">{imageCoveragePercent}% covered</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("published");
                    setImageFilter("missing");
                    setSearch("");
                    setLessonPage(1);
                  }}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-[#FFFCF8] px-3 text-sm font-black text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700"
                  data-testid="button-admin-learning-show-missing-images"
                >
                  <ImagePlus size={16} />
                  Show missing visuals
                </button>
                <button
                  type="button"
                  disabled={bulkGeneratingImages || imageCoverageSummary.missing === 0}
                  onClick={() => void generateMissingImages()}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-3 text-sm font-black text-white transition hover:bg-[#5B21B6] disabled:opacity-60"
                  data-testid="button-admin-learning-generate-missing-images"
                >
                  {bulkGeneratingImages ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  {bulkGeneratingImages ? "Generating" : "Generate next 5"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_150px_150px_150px_150px]">
              <label className="relative block">
                <Search className="absolute left-3 top-3 text-[#8b7a73]" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search lessons"
                  className={`${inputClass} pl-9`}
                  data-testid="input-admin-learning-search"
                />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LessonStatus | "all")} className={inputClass}>
                <option value="all">All status</option>
                <option value="draft">Drafts</option>
                <option value="review">In review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputClass}>
                <option value="all">All categories</option>
                {categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
              </select>
              <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} className={inputClass}>
                <option value="all">All languages</option>
                {["en", "es", "fr", "de", "it", "pt"].map((language) => <option key={language} value={language}>{language.toUpperCase()}</option>)}
              </select>
              <select value={imageFilter} onChange={(event) => setImageFilter(event.target.value as ImageFilter)} className={inputClass} data-testid="select-admin-learning-image-filter">
                <option value="all">All visuals</option>
                <option value="missing">Missing visual</option>
                <option value="with_image">Has visual</option>
              </select>
            </div>
            <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[#eadfd5] bg-[#FFFCF8] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-[#7d6b65]">
                {selectedPublishableLessonIds.length > 0
                  ? `${selectedPublishableLessonIds.length} draft lesson${selectedPublishableLessonIds.length === 1 ? "" : "s"} selected`
                  : publishableVisibleLessonIds.length > 0 ? `${publishableVisibleLessonIds.length} draft lesson${publishableVisibleLessonIds.length === 1 ? "" : "s"} on this page can be selected` : "No drafts on this page to publish"}
              </p>
              <button
                type="button"
                disabled={bulkPublishing || selectedPublishableLessonIds.length === 0}
                onClick={() => void bulkPublishDrafts(selectedPublishableLessonIds)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
                data-testid="button-admin-learning-publish-selected"
              >
                {bulkPublishing && selectedPublishableLessonIds.length > 0 ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                Publish selected
              </button>
            </div>

            <div
              className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#eadfd5] bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              data-testid="admin-learning-list-controls"
            >
              <p className="text-sm font-bold text-[#7d6b65]" data-testid="admin-learning-list-count">
                {loading
                  ? "Loading lessons"
                  : lessonCount === 0
                    ? "No lessons"
                    : `Showing ${lessonPageStartIndex + 1}-${lessonPageEndIndex} of ${lessonCount} lessons`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-[#7d6b65]">
                  Rows
                  <select
                    value={lessonPageSize}
                    onChange={(event) => {
                      setLessonPageSize(Number(event.target.value));
                      setLessonPage(1);
                    }}
                    className="h-10 rounded-xl border border-[#E5D8CA] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                    data-testid="select-admin-learning-page-size"
                  >
                    {lessonPageSizeOptions.map((pageSize) => (
                      <option key={pageSize} value={pageSize}>{pageSize}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setLessonPage((current) => Math.max(1, current - 1))}
                  disabled={loading || lessonCount === 0 || boundedLessonPage <= 1}
                  className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-[#eadfd5] bg-[#FFFCF8] px-3 text-sm font-black text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700 disabled:opacity-50"
                  data-testid="button-admin-learning-page-prev"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <span className="min-w-[6rem] text-center text-sm font-black text-[#5b4a46]">
                  Page {lessonCount === 0 ? 0 : boundedLessonPage} of {lessonCount === 0 ? 0 : lessonPageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setLessonPage((current) => Math.min(lessonPageCount, current + 1))}
                  disabled={loading || lessonCount === 0 || boundedLessonPage >= lessonPageCount}
                  className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-[#eadfd5] bg-[#FFFCF8] px-3 text-sm font-black text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700 disabled:opacity-50"
                  data-testid="button-admin-learning-page-next"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-[#eadfd5]">
              <div className="max-h-[640px] overflow-auto">
                <div className="sticky top-0 z-10 grid min-w-[720px] grid-cols-[44px_minmax(0,1fr)_130px_100px_90px] items-center bg-[#FBF8F5] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#7d6b65]">
                  <label className="flex h-5 w-5 items-center justify-center" title="Select current page drafts">
                    <input
                      type="checkbox"
                      checked={allVisibleDraftsSelected}
                      disabled={publishableVisibleLessonIds.length === 0}
                      onChange={toggleVisibleDraftSelection}
                      className="h-4 w-4 rounded border-[#d8c8bb] text-purple-700"
                      aria-label="Select current page draft lessons"
                      data-testid="checkbox-admin-learning-select-visible-drafts"
                    />
                  </label>
                  <span>Lessons</span>
                  <span>Category</span>
                  <span>Status</span>
                  <span>Updated</span>
                </div>

                {loading ? (
                  <div className="flex min-h-48 min-w-[720px] items-center justify-center text-sm font-black text-purple-700">
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Loading lessons
                  </div>
                ) : lessons.length === 0 ? (
                  <div className="min-h-48 min-w-[720px] px-4 py-10 text-center text-sm font-bold text-[#7d6b65]">
                    No lessons match these filters.
                  </div>
                ) : visibleLessons.map((lesson) => {
                  const category = categories.find((candidate) => candidate.slug === lesson.categorySlug);
                  const active = lesson.id === draft.id;
                  const publishable = isPublishableStatus(lesson.status);
                  const selectedForPublish = selectedLessonIdSet.has(lesson.id);
                  return (
                    <div
                      key={lesson.id}
                      id={`learning-lesson-${lesson.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(lesson.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(lesson.id);
                        }
                      }}
                      className={`grid min-h-[82px] min-w-[720px] grid-cols-[44px_minmax(0,1fr)_130px_100px_90px] items-center gap-3 border-t border-[#eadfd5] px-4 py-3 text-left transition ${active ? "bg-[#F5F3FF]" : "bg-white hover:bg-[#FFFCF8]"}`}
                      data-testid={`button-admin-learning-lesson-${lesson.id}`}
                    >
                      <label className="flex h-8 w-8 items-center justify-center" title={publishable ? "Select for publishing" : "Already published or archived"}>
                        <input
                          type="checkbox"
                          checked={selectedForPublish}
                          disabled={!publishable}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleLessonSelection(lesson.id)}
                          className="h-4 w-4 rounded border-[#d8c8bb] text-purple-700 disabled:opacity-40"
                          aria-label={`Select ${lesson.title} for publishing`}
                          data-testid={`checkbox-admin-learning-select-${lesson.id}`}
                        />
                      </label>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-black text-[#2f2135]">{lesson.title}</span>
                        <span className="mt-1 flex min-w-0 items-center gap-2 text-xs font-semibold text-[#7d6b65]">
                          <span className="truncate">{lesson.hook}</span>
                          {lesson.imageUrl?.trim() ? null : (
                            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-800">
                              Missing visual
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="truncate text-sm font-bold text-[#5b4a46]">{category?.label ?? lesson.categorySlug}</span>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${statusClass(lesson.status)}`}>{lesson.status}</span>
                      <span className="text-xs font-bold text-[#7d6b65]">{formatDate(lesson.updatedAt)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">Lesson editor</p>
                <h2 className="mt-1 font-serif text-3xl">{draft.id ? "Edit lesson" : "Create lesson"}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(draft.status)}`}>{draft.status}</span>
            </div>

            <div className="mt-4 grid gap-3">
              <Field label="Title">
                <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={inputClass} data-testid="input-admin-learning-title" />
              </Field>
              <Field label="External ID">
                <input
                  value={draft.externalId ?? ""}
                  onChange={(event) => setDraft({ ...draft, externalId: event.target.value || null })}
                  placeholder="science-soap-001"
                  className={inputClass}
                  data-testid="input-admin-learning-external-id"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Category">
                  <select
                    value={draft.categorySlug}
                    onChange={(event) => setDraft({ ...draft, categorySlug: event.target.value })}
                    className={inputClass}
                    data-testid="select-admin-learning-editor-category"
                  >
                    {categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
                  </select>
                </Field>
                <Field label="Language">
                  <select
                    value={draft.language}
                    onChange={(event) => setDraft({ ...draft, language: event.target.value })}
                    className={inputClass}
                    data-testid="select-admin-learning-editor-language"
                  >
                    {["en", "es", "fr", "de", "it", "pt"].map((language) => <option key={language} value={language}>{language.toUpperCase()}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Hook">
                <textarea value={draft.hook} onChange={(event) => setDraft({ ...draft, hook: event.target.value })} className={textareaClass} data-testid="textarea-admin-learning-hook" />
              </Field>
              <Field label="Body / snippet">
                <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} className={`${textareaClass} min-h-[150px]`} data-testid="textarea-admin-learning-body" />
              </Field>
              <Field label="Reflection prompt">
                <textarea value={draft.reflectionPrompt} onChange={(event) => setDraft({ ...draft, reflectionPrompt: event.target.value })} className={textareaClass} data-testid="textarea-admin-learning-reflection" />
              </Field>
              <Field label="Custom image URL">
                <input
                  value={draft.imageUrl ?? ""}
                  onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })}
                  placeholder="https://..."
                  className={inputClass}
                  data-testid="input-admin-learning-image-url"
                />
              </Field>
              {draft.imageUrl ? (
                <div className="overflow-hidden rounded-2xl border border-[#eadfd5] bg-[#FFFCF8]" data-testid="admin-learning-image-preview">
                  <img
                    src={draft.imageUrl}
                    alt={draft.imageAlt || "Lesson custom image preview"}
                    className="aspect-[16/9] w-full object-cover"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#d8c8bb] bg-[#FFFCF8] px-4 py-5 text-sm font-bold text-[#7d6b65]">
                  No custom image yet. Add an image URL so this lesson does not use generic art.
                </div>
              )}
              <Field label="Image alt text">
                <input
                  value={draft.imageAlt ?? ""}
                  onChange={(event) => setDraft({ ...draft, imageAlt: event.target.value })}
                  placeholder="Plain description of the image"
                  className={inputClass}
                  data-testid="input-admin-learning-image-alt"
                />
              </Field>
              <Field label="Image prompt / brief">
                <textarea
                  value={draft.imagePrompt ?? ""}
                  onChange={(event) => setDraft({ ...draft, imagePrompt: event.target.value })}
                  placeholder="The exact prompt or creative brief used to create this lesson's custom image."
                  className={textareaClass}
                  data-testid="textarea-admin-learning-image-prompt"
                />
              </Field>
              <button
                type="button"
                disabled={saving || generatingImage}
                onClick={() => void generateLessonImage()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-3 text-sm font-black text-white transition hover:bg-[#5B21B6] disabled:opacity-60"
                data-testid="button-admin-learning-generate-image"
              >
                {generatingImage ? <Loader2 className="animate-spin" size={16} /> : <ImagePlus size={16} />}
                {generatingImage ? "Generating image" : "Generate image"}
              </button>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Estimated minutes">
                  <input type="number" min={1} max={15} value={draft.estimatedMinutes} onChange={(event) => setDraft({ ...draft, estimatedMinutes: Number(event.target.value) })} className={inputClass} />
                </Field>
                <Field label="Difficulty">
                  <select value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value as LessonDifficulty })} className={inputClass}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="deep">Deep</option>
                  </select>
                </Field>
              </div>
              <Field label="Tags">
                <input value={draft.tagsText} onChange={(event) => setDraft({ ...draft, tagsText: event.target.value })} placeholder="music, memory, listening" className={inputClass} />
              </Field>
              <Field label="Source notes">
                <textarea value={draft.sourceNotes ?? ""} onChange={(event) => setDraft({ ...draft, sourceNotes: event.target.value })} className={textareaClass} />
              </Field>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {editorMessage ? (
                <p
                  className="rounded-xl border border-[#eadfd5] bg-[#FFFCF8] px-3 py-2 text-sm font-black text-[#5b4a46] sm:col-span-3"
                  role="status"
                  data-testid="admin-learning-editor-message"
                >
                  {editorMessage}
                </p>
              ) : null}
              <button
                type="button"
                disabled={saving || generatingImage}
                onClick={() => void saveLesson()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-[#FFFCF8] px-3 text-sm font-black text-[#5b4a46] disabled:opacity-60"
                data-testid="button-admin-learning-save"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save
              </button>
              <button
                type="button"
                disabled={saving || generatingImage}
                onClick={() => void quickAction("publish")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white disabled:opacity-60"
                data-testid="button-admin-learning-publish"
              >
                <CheckCircle2 size={16} />
                Publish
              </button>
              <button
                type="button"
                disabled={saving || generatingImage}
                onClick={() => void quickAction("archive")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-700 px-3 text-sm font-black text-white disabled:opacity-60"
                data-testid="button-admin-learning-archive"
              >
                <Archive size={16} />
                Archive
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
