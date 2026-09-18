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
  skill: { id: string; code: string; name: string };
  part: { id: string; code: string; name: string };
  /** 0..2 entries — see SkillPartDTO.questionTypeRollCount. Empty for Speaking / Writing Task 2. */
  questionTypes: QuestionTypeRef[];
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
  source: "manual";
  skill: { id: string; code: string; name: string };
  part: { id: string; code: string; name: string };
  questionType: QuestionTypeRef | null;
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
  practiceLog: { rolledAt: string; source: RollSource; part: { code: string; name: string } }[];
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
  cambridgeAvg: number | null;
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

export interface EngineConfigDTO {
  decay_exponent: string;
  weekly_threshold_days: string;
  frequency_adjustment_factor: string;
  frequency_adjustment_cap: string;
  overall_prediction_rounding_mode: string;
  count_soft_reset_threshold: string;
}
