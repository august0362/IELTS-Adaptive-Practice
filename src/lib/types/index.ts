export interface SkillPartDTO {
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
}

export interface RollResultItem {
  skill: { id: string; code: string; name: string };
  part: { id: string; code: string; name: string };
}

export interface RollResponse {
  sessionId: string;
  results: RollResultItem[];
}

export interface HistorySession {
  id: string;
  rolledAt: string;
  results: RollResultItem[];
}

export interface HistoryResponse {
  total: number;
  items: HistorySession[];
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

export interface EngineConfigDTO {
  decay_exponent: string;
  weekly_threshold_days: string;
  frequency_adjustment_factor: string;
  frequency_adjustment_cap: string;
  overall_prediction_rounding_mode: string;
  count_soft_reset_threshold: string;
}
