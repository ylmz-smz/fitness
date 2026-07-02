import type { ExerciseDefinition } from "./types";

// ponytail: 演示阈值集中在这里，教练校准后只改配置，不改分析流程。
export const exercises: ExerciseDefinition[] = [
  {
    id: "squat",
    name: "徒手深蹲",
    sourceName: "Band squat（动作说明已去除弹力带要求）",
    sourceId: "1004",
    instruction: "双脚约与肩同宽，收紧核心，臀部向后并屈膝下蹲，在可控深度停顿后推地站起。",
    cameraGuide: "侧面全身入镜。镜头与髋部同高，脚、膝、髋和肩不能出框。",
    landmarks: [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
    rules: [
      { id: "depth", label: "下蹲深度不足", message: "继续向后下方坐髋，在稳定范围内让大腿更接近平行。", severity: "需改进", threshold: 105, consecutiveFrames: 3 },
      { id: "torso", label: "躯干前倾偏大", message: "收紧核心并抬高胸口，避免上身继续向前折叠。", severity: "提醒", threshold: 42, consecutiveFrames: 3 },
      { id: "heel", label: "脚跟可能离地", message: "重心留在全脚掌，降低速度并保持脚跟压地。", severity: "需改进", threshold: 0.045, consecutiveFrames: 3 },
    ],
  },
  {
    id: "pushup",
    name: "俯卧撑",
    sourceName: "Push-up",
    sourceId: "0662",
    instruction: "从高位平板开始，身体保持直线，屈肘下降至胸部接近地面，再伸直手臂返回。",
    cameraGuide: "侧面全身入镜。镜头与躯干同高，手腕、肩、髋和脚踝清晰可见。",
    landmarks: [11, 12, 13, 14, 15, 16, 23, 24, 27, 28],
    rules: [
      { id: "depth", label: "下降幅度不足", message: "保持身体稳定，继续屈肘下降后再推起。", severity: "需改进", threshold: 90, consecutiveFrames: 3 },
      { id: "line", label: "身体没有保持直线", message: "同时收紧腹部和臀部，让肩、髋、踝保持成线。", severity: "需改进", threshold: 22, consecutiveFrames: 3 },
      { id: "hip", label: "髋部位置偏离", message: "避免塌腰或撅臀，让髋部回到肩踝连线附近。", severity: "提醒", threshold: 0.09, consecutiveFrames: 3 },
    ],
  },
  {
    id: "lunge",
    name: "前弓步",
    sourceName: "Forward lunge (male)",
    sourceId: "3470",
    instruction: "从站立位向前迈一大步，屈膝降低身体，保持躯干稳定，再用前脚推地回到起始位置。",
    cameraGuide: "侧面全身入镜。前后脚均可见，镜头与髋部同高，每次完整回到站立位。",
    landmarks: [11, 12, 23, 24, 25, 26, 27, 28],
    rules: [
      { id: "depth", label: "弓步深度不足", message: "在躯干稳定的前提下继续垂直降低身体。", severity: "需改进", threshold: 105, consecutiveFrames: 3 },
      { id: "rear", label: "后腿参与不足", message: "让后膝随身体下降，不要只弯曲前腿。", severity: "提醒", threshold: 135, consecutiveFrames: 3 },
      { id: "torso", label: "躯干前倾偏大", message: "收紧核心并保持胸口朝前，身体垂直下降。", severity: "提醒", threshold: 28, consecutiveFrames: 3 },
    ],
  },
];

export const exerciseById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise])) as Record<ExerciseDefinition["id"], ExerciseDefinition>;

