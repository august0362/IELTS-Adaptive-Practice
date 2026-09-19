export interface SkillPartDTO {
  id: string;
  skillId: string;
  code: string;
  name: string;
  baseRatio: number;
  occurrenceCount: number;
  lastAppearedAt: string | null;
  questionTypeRollCount: number;
}

export interface QuestionTypeDTO {
  id: string;
  skillId: string;
  code: string;
  name: string;
  baseRatio: number;
  occurrenceCount: number;
  lastAppearedAt: string | null;
}

export interface SkillDTO {
  id: string;
  code: string;
  name: string;
  occurrenceCount: number;
  lastAppearedAt: string | null;
  parts: SkillPartDTO[];
  /** Empty for Speaking — see PROJECT_CONTEXT.md section 5.7. */
  questionTypes: QuestionTypeDTO[];
}

export interface QuestionTypeRef {
  id: string;
  code: string;
  name: string;
}

export interface RollResultItem {
  /** rollResults.id — target for PATCH /api/results/:id/accuracy when this is Reading/Listening. */
  id: string;
  skill: { id: string; code: string; name: string };
  part: { id: string; code: string; name: string };
  /** 0..2 entries — see SkillPartDTO.questionTypeRollCount. Empty for Speaking / Writing Task 2. */
  questionTypes: QuestionTypeRef[];
  questionsAnswered: number | null;
  questionsCorrect: number | null;
}

export interface RollResponse {
  sessionId: string;
  results: RollResultItem[];
}

export type RollSource = "roll" | "manual";

export interface HistorySession {
  id: string;
  rolledAt: string;
  source: RollSource;
  results: RollResultItem[];
}

export interface HistoryResponse {
  total: number;
  items: HistorySession[];
}

export interface PracticeRequest {
  skillCode: string;
  partCode: string;
  /** Omit when the part has no question types (questionTypeRollCount === 0). */
  questionTypeCode?: string;
}

export interface PracticeResponse {
  sessionId: string;
  /** rollResults.id — target for PATCH /api/results/:id/accuracy when this is Reading/Listening. */
  resultId: string;
  source: "manual";
  skill: { id: string; code: string; name: string };
  part: { id: string; code: string; name: string };
  questionType: QuestionTypeRef | null;
}

export interface AccuracyRequest {
  questionsAnswered: number;
  questionsCorrect: number;
}

export interface AccuracyResponse {
  id: string;
  questionsAnswered: number;
  questionsCorrect: number;
}

export interface TopicDTO {
  id: string;
  name: string;
  createdAt: string;
}

export interface QuestionTypeStat {
  code: string;
  name: string;
  count: number;
  percentage: number;
}

export interface SkillStatsResponse {
  skill: { id: string; code: string; name: string };
  practiceLog: {
    rolledAt: string;
    source: RollSource;
    part: { code: string; name: string };
    questionsAnswered: number | null;
    questionsCorrect: number | null;
  }[];
  /** null when the skill has no question types (Speaking). */
  questionTypeStats: QuestionTypeStat[] | null;
}

export interface NoteDTO {
  id: string;
  noteDate: string;
  tags: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CambridgeTestDTO {
  id: string;
  testDate: string;
  testName: string;
  readingBand: number;
  listeningBand: number;
  writingBand: number;
  speakingBand: number;
  overallBand: number;
  note: string | null;
  createdAt: string;
}

export interface SkillPredictionResultDTO {
  predictedBand: number | null;
  rawPredictedBand: number | null;
  cambridgeEwma: number | null;
  /** null when this skill has no accuracy component (Writing/Speaking), or none logged yet. */
  accuracyEwma: number | null;
  frequencyDelta: number;
  sampleSize: number;
}

export interface FourSkillCounts {
  reading: number;
  listening: number;
  writing: number;
  speaking: number;
}

export interface PredictionResponseDTO {
  perSkill: {
    reading: SkillPredictionResultDTO;
    listening: SkillPredictionResultDTO;
    writing: SkillPredictionResultDTO;
    speaking: SkillPredictionResultDTO;
  };
  overall: number | null;
  sampleSizePerSkill: FourSkillCounts;
  practiceCount30dPerSkill: FourSkillCounts;
  hasEnoughData: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  message: string;
  /** Prior turns of the same conversation, oldest first. Empty/omitted for the first message. */
  history?: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
}

export interface EngineConfigDTO {
  decay_exponent: string;
  weekly_threshold_days: string;
  frequency_adjustment_factor: string;
  overall_prediction_rounding_mode: string;
  count_soft_reset_threshold: string;
  cambridge_ewma_alpha: string;
  accuracy_ewma_alpha: string;
}
