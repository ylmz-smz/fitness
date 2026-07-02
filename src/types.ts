export type ExerciseId = "squat" | "pushup" | "lunge";
export type Severity = "提醒" | "需改进";

export interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseFrame {
  timestamp: number;
  landmarks: Point[];
  visibility: number;
  angles: Record<string, number>;
}

export interface ExerciseRule {
  id: string;
  label: string;
  message: string;
  severity: Severity;
  threshold: number;
  consecutiveFrames: number;
}

export interface ExerciseDefinition {
  id: ExerciseId;
  name: string;
  sourceName: string;
  sourceId: string;
  instruction: string;
  cameraGuide: string;
  landmarks: number[];
  rules: ExerciseRule[];
}

export interface FormIssue {
  ruleId: string;
  label: string;
  message: string;
  severity: Severity;
  timestamp: number;
  value: number;
}

export interface RepetitionResult {
  index: number;
  startTime: number;
  endTime: number;
  valid: boolean;
  issues: FormIssue[];
  metrics: Record<string, number>;
}

export interface AnalysisResult {
  exerciseId: ExerciseId;
  totalReps: number;
  validReps: number;
  confidence: number;
  repetitions: RepetitionResult[];
  frames: PoseFrame[];
  failureReason?: string;
}

