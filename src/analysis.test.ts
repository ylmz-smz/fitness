import { describe, expect, it } from "vitest";
import { analyzePoseFrames, deriveFrame } from "./analysis";
import { exerciseById } from "./exercises";
import type { PoseFrame } from "./types";

const frame = (timestamp: number, angles: Partial<PoseFrame["angles"]> = {}, visibility = 0.9): PoseFrame => ({
  timestamp,
  visibility,
  landmarks: Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility })),
  angles: { knee: 170, otherKnee: 170, elbow: 170, bodyLine: 178, torso: 8, heel: 0, hipOffset: 0.02, ...angles },
});

const sequence = (values: number[], metric: "knee" | "elbow", overrides: Partial<PoseFrame["angles"]> = {}) =>
  values.map((value, index) => frame(index / 15, { [metric]: value, ...overrides }));

describe("动作阶段与规则分析", () => {
  it("三维指标不受水平拍摄角度影响", () => {
    const image = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.9 }));
    const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
    Object.assign(world[11], { x: 0.1, y: -0.7, z: 0.1 });
    Object.assign(world[13], { x: 0.25, y: -0.45, z: 0.15 });
    Object.assign(world[15], { x: 0.35, y: -0.2, z: 0.25 });
    Object.assign(world[23], { x: 0, y: -0.2, z: 0 });
    Object.assign(world[25], { x: 0.2, y: 0.25, z: 0.1 });
    Object.assign(world[27], { x: 0.1, y: 0.75, z: 0.25 });
    Object.assign(world[29], { x: 0.1, y: 0.78, z: 0.2 });
    Object.assign(world[31], { x: 0.25, y: 0.82, z: 0.35 });
    Object.assign(world[24], world[23]);
    Object.assign(world[26], world[25]);
    Object.assign(world[28], world[27]);
    const rotate = (point: typeof world[number]) => ({ ...point, x: -point.z!, z: point.x });
    const original = deriveFrame(0, image, exerciseById.squat.landmarks, world);
    const rotated = deriveFrame(0, image, exerciseById.squat.landmarks, world.map(rotate));

    for (const metric of Object.keys(original.angles)) {
      expect(rotated.angles[metric]).toBeCloseTo(original.angles[metric], 8);
    }
  });

  it("识别一次达标深蹲", () => {
    const result = analyzePoseFrames(sequence([170, 170, 150, 140, 130, 110, 90, 90, 90, 120, 145, 155, 160, 165, 170], "knee"), exerciseById.squat);
    expect(result.totalReps).toBe(1);
    expect(result.validReps).toBe(1);
    expect(result.repetitions[0].issues).toHaveLength(0);
  });

  it("标记俯卧撑下降不足", () => {
    const result = analyzePoseFrames(sequence([170, 160, 145, 135, 120, 110, 100, 100, 100, 120, 145, 155, 165, 170], "elbow"), exerciseById.pushup);
    expect(result.totalReps).toBe(1);
    expect(result.validReps).toBe(0);
    expect(result.repetitions[0].issues.map((issue) => issue.ruleId)).toContain("depth");
  });

  it("标记弓步后腿参与不足", () => {
    const result = analyzePoseFrames(sequence([170, 160, 145, 130, 110, 90, 90, 90, 120, 145, 155, 165, 170], "knee").map((item, index, frames) => ({
      ...item,
      angles: { ...item.angles, otherKnee: index < 3 || index >= frames.length - 3 ? 170 : 150 },
    })), exerciseById.lunge);
    expect(result.totalReps).toBe(1);
    expect(result.repetitions[0].issues.map((issue) => issue.ruleId)).toContain("rear");
  });

  it("拒绝低置信度视频", () => {
    const frames = Array.from({ length: 12 }, (_, index) => frame(index / 15, {}, index < 9 ? 0.2 : 0.9));
    expect(analyzePoseFrames(frames, exerciseById.squat).failureReason).toContain("不够清晰");
  });

  it("不把未回到起始位的动作计数", () => {
    const result = analyzePoseFrames(sequence([170, 160, 145, 130, 110, 90, 90, 90, 110, 130], "knee"), exerciseById.squat);
    expect(result.totalReps).toBe(0);
    expect(result.failureReason).toContain("完整重复");
  });
});
