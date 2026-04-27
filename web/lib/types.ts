export type ProgramDayMeta = {
  day: number;
  videoId: string;
  covers: number[];
  title: string;
  duration_seconds: number;
  summary: string;
  audio_file: string | null;
  transcript_file: string | null;
};

export type ProgramKeypoint = { title: string; body: string };

export type ProgramFrameworkStep = { name: string; detail: string };
export type ProgramFramework = {
  name: string;
  description: string;
  steps: ProgramFrameworkStep[];
};

export type ProgramExerciseQuestion = {
  id: string;
  label: string;
  guidance: string;
};
export type ProgramExercise = {
  intro: string;
  questions: ProgramExerciseQuestion[];
};

export type ProgramDay = {
  day: number;
  videoId: string;
  covers: number[];
  title: string;
  duration_seconds: number;
  summary: string;
  keypoints: ProgramKeypoint[];
  frameworks: ProgramFramework[];
  exercise: ProgramExercise;
};

export type FrameworksIndex = {
  count: number;
  frameworks: (ProgramFramework & {
    introduced_day: number;
    introduced_title: string;
  })[];
};

export type DaysIndex = {
  count: number;
  days: ProgramDayMeta[];
};

export type Commitment = {
  id?: number;
  day: number;
  questionId: string;
  text: string;
  classification: "one-time" | "ongoing" | "unclassified";
  rationale?: string;
  status: "active" | "done" | "abandoned";
  createdAt: number;
  lastReviewedAt?: number;
};

export type ChatMessage = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type Memory = {
  id?: number;
  text: string;
  source?: string;
  createdAt: number;
};

export type Settings = {
  id: "default";
  apiKey?: string;
  baseURL?: string;
  model?: string;
  startDate?: string;
};

export type Profile = {
  id: "default";
  rawIntake: string;
  generatedSummary: string;
  updatedAt: number;
};

export type MomentumSynthesis = {
  id: "default";
  text: string;
  generatedAt: number;
  commitmentCount: number;
};

export type ExerciseFeedback = {
  verdict: "needs_work" | "good" | "great";
  comment: string;
  generatedAt: number;
  /** Snapshot of answers when feedback was generated, used to detect staleness. */
  answeredFor: Record<string, string>;
};

export type DayProgress = {
  day: number;
  completedAt?: number;
  audioPlayedAt?: number;
  exerciseAnswers: Record<string, string>;
  feedback?: ExerciseFeedback;
};
