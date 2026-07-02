import type { AnalysisResult, ExerciseDefinition, FormIssue, Point, PoseFrame, RepetitionResult } from "./types";

const angle = (a: Point, b: Point, c: Point) => {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const cosine = (ab.x * cb.x + ab.y * cb.y) / (Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y) || 1);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
};

const distanceToLine = (point: Point, start: Point, end: Point) => {
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  return Math.abs((end.y - start.y) * point.x - (end.x - start.x) * point.y + end.x * start.y - end.y * start.x) / length;
};

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

export function deriveFrame(timestamp: number, landmarks: Point[], required: number[]): PoseFrame {
  const side = mean([11, 13, 15, 23, 25, 27].map((index) => landmarks[index]?.visibility ?? 0)) >=
    mean([12, 14, 16, 24, 26, 28].map((index) => landmarks[index]?.visibility ?? 0)) ? 0 : 1;
  const shoulder = landmarks[11 + side];
  const elbow = landmarks[13 + side];
  const wrist = landmarks[15 + side];
  const hip = landmarks[23 + side];
  const knee = landmarks[25 + side];
  const ankle = landmarks[27 + side];
  const heel = landmarks[29 + side];
  const toe = landmarks[31 + side];
  const otherHip = landmarks[24 - side];
  const otherKnee = landmarks[26 - side];
  const otherAnkle = landmarks[28 - side];
  const torsoFromVertical = Math.atan2(Math.abs(shoulder.x - hip.x), Math.abs(shoulder.y - hip.y) || 0.0001) * 180 / Math.PI;

  return {
    timestamp,
    landmarks,
    visibility: mean(required.map((index) => landmarks[index]?.visibility ?? 0)),
    angles: {
      knee: angle(hip, knee, ankle),
      otherKnee: angle(otherHip, otherKnee, otherAnkle),
      elbow: angle(shoulder, elbow, wrist),
      bodyLine: angle(shoulder, hip, ankle),
      torso: torsoFromVertical,
      heel: toe && heel ? toe.y - heel.y : 0,
      hipOffset: distanceToLine(hip, shoulder, ankle),
    },
  };
}

function smooth(frames: PoseFrame[]): PoseFrame[] {
  return frames.map((frame, index) => {
    const window = frames.slice(Math.max(0, index - 1), index + 2);
    return {
      ...frame,
      angles: Object.fromEntries(Object.keys(frame.angles).map((key) => [key, mean(window.map((item) => item.angles[key]))])),
    };
  });
}

type RepAccumulator = { startTime: number; frames: PoseFrame[]; reachedBottom: boolean };

function thresholds(exercise: ExerciseDefinition) {
  if (exercise.id === "pushup") return { metric: "elbow", start: 145, bottom: 105, finish: 150 };
  return { metric: "knee", start: 145, bottom: 115, finish: 150 };
}

function summarizeRep(exercise: ExerciseDefinition, active: RepAccumulator, index: number): RepetitionResult {
  const values = (key: string) => active.frames.map((frame) => frame.angles[key]);
  const min = (key: string) => Math.min(...values(key));
  const max = (key: string) => Math.max(...values(key));
  const issues: FormIssue[] = [];
  const addIssue = (ruleId: string, value: number, timestamp: number) => {
    const rule = exercise.rules.find((item) => item.id === ruleId);
    if (rule) issues.push({ ruleId, label: rule.label, message: rule.message, severity: rule.severity, timestamp, value });
  };
  const at = (key: string, mode: "min" | "max") => active.frames.reduce((best, frame) =>
    mode === "min" ? (frame.angles[key] < best.angles[key] ? frame : best) : (frame.angles[key] > best.angles[key] ? frame : best));
  const sustained = (ruleId: string, key: string, test: (value: number) => boolean, mode: "min" | "max") => {
    const rule = exercise.rules.find((item) => item.id === ruleId)!;
    let run: PoseFrame[] = [];
    for (const frame of active.frames) {
      run = test(frame.angles[key]) ? [...run, frame] : [];
      if (run.length >= rule.consecutiveFrames) return run.reduce((best, item) => mode === "min" ? (item.angles[key] < best.angles[key] ? item : best) : (item.angles[key] > best.angles[key] ? item : best));
    }
  };

  if (exercise.id === "pushup") {
    const depth = min("elbow");
    const lineError = 180 - min("bodyLine");
    if (depth > exercise.rules[0].threshold) addIssue("depth", depth, at("elbow", "min").timestamp);
    const badLine = sustained("line", "bodyLine", (value) => 180 - value > exercise.rules[1].threshold, "min");
    const badHip = sustained("hip", "hipOffset", (value) => value > exercise.rules[2].threshold, "max");
    if (badLine) addIssue("line", 180 - badLine.angles.bodyLine, badLine.timestamp);
    if (badHip) addIssue("hip", badHip.angles.hipOffset, badHip.timestamp);
    return { index, startTime: active.startTime, endTime: active.frames.at(-1)!.timestamp, valid: active.reachedBottom && issues.every((issue) => issue.severity !== "需改进"), issues, metrics: { minElbow: depth, maxBodyLineError: lineError } };
  }

  const depth = min("knee");
  if (depth > exercise.rules[0].threshold) addIssue("depth", depth, at("knee", "min").timestamp);
  if (exercise.id === "squat") {
    const badTorso = sustained("torso", "torso", (value) => value > exercise.rules[1].threshold, "max");
    const badHeel = sustained("heel", "heel", (value) => value > exercise.rules[2].threshold, "max");
    if (badTorso) addIssue("torso", badTorso.angles.torso, badTorso.timestamp);
    if (badHeel) addIssue("heel", badHeel.angles.heel, badHeel.timestamp);
  } else {
    const rearDepth = min("otherKnee");
    if (rearDepth > exercise.rules[1].threshold) addIssue("rear", rearDepth, at("otherKnee", "min").timestamp);
    const badTorso = sustained("torso", "torso", (value) => value > exercise.rules[2].threshold, "max");
    if (badTorso) addIssue("torso", badTorso.angles.torso, badTorso.timestamp);
  }
  return { index, startTime: active.startTime, endTime: active.frames.at(-1)!.timestamp, valid: active.reachedBottom && issues.every((issue) => issue.severity !== "需改进"), issues, metrics: { minKnee: depth, maxTorso: max("torso") } };
}

export function analyzePoseFrames(rawFrames: PoseFrame[], exercise: ExerciseDefinition): AnalysisResult {
  const validFrames = smooth(rawFrames.filter((frame) => frame.visibility >= 0.55)).map((frame) => exercise.id === "lunge" ? {
    ...frame,
    angles: { ...frame.angles, knee: Math.min(frame.angles.knee, frame.angles.otherKnee), otherKnee: Math.max(frame.angles.knee, frame.angles.otherKnee) },
  } : frame);
  const confidence = rawFrames.length ? validFrames.length / rawFrames.length : 0;
  const base = { exerciseId: exercise.id, totalReps: 0, validReps: 0, confidence, repetitions: [] as RepetitionResult[], frames: validFrames };
  if (rawFrames.length < 8) return { ...base, failureReason: "视频过短或没有检测到完整动作。" };
  if (confidence < 0.65) return { ...base, failureReason: "身体关键点不够清晰。请确保全身入镜、光线充足且无遮挡。" };

  const limit = thresholds(exercise);
  let active: RepAccumulator | undefined;
  let belowStart = 0;
  let aboveFinish = 0;

  for (const frame of validFrames) {
    const value = frame.angles[limit.metric];
    belowStart = value < limit.start ? belowStart + 1 : 0;
    if (!active && belowStart >= 3) active = { startTime: frame.timestamp, frames: [], reachedBottom: false };
    if (!active) continue;
    active.frames.push(frame);
    if (value < limit.bottom) active.reachedBottom = true;
    aboveFinish = value > limit.finish ? aboveFinish + 1 : 0;
    if (aboveFinish >= 3 && active.frames.length >= 6) {
      base.repetitions.push(summarizeRep(exercise, active, base.repetitions.length + 1));
      active = undefined;
      belowStart = 0;
      aboveFinish = 0;
    }
  }

  base.totalReps = base.repetitions.length;
  base.validReps = base.repetitions.filter((rep) => rep.valid).length;
  return base.totalReps ? base : { ...base, failureReason: "没有识别到完整重复。请从起始姿势完成动作并回到起始位置。" };
}
