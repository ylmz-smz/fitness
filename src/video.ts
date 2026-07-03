import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { analyzePoseFrames, deriveFrame } from "./analysis";
import type { AnalysisResult, ExerciseDefinition } from "./types";

const VERSION = "0.10.35";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const waitFor = (target: EventTarget, event: string) => new Promise<void>((resolve, reject) => {
  const done = () => { cleanup(); resolve(); };
  const failed = () => { cleanup(); reject(new Error("视频无法读取，请换用 MP4、WebM 或 MOV 文件。")); };
  const cleanup = () => { target.removeEventListener(event, done); target.removeEventListener("error", failed); };
  target.addEventListener(event, done);
  target.addEventListener("error", failed);
});

const seek = async (video: HTMLVideoElement, time: number) => {
  if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2) return;
  video.currentTime = time;
  await waitFor(video, "seeked");
};

export async function analyzeVideo(
  blob: Blob,
  exercise: ExerciseDefinition,
  onProgress: (progress: number) => void,
): Promise<AnalysisResult> {
  if (!blob.size) throw new Error("视频文件为空。请选择有效视频。");
  if (blob.size > 250 * 1024 * 1024) throw new Error("视频不能超过 250 MB。");

  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  let landmarker: PoseLandmarker | undefined;
  try {
    await waitFor(video, "loadedmetadata");
    if (video.readyState < 2) await waitFor(video, "loadeddata");
    if (!Number.isFinite(video.duration) || video.duration < 1) throw new Error("视频至少需要 1 秒。");
    if (video.duration > 90) throw new Error("首版仅分析 90 秒以内的视频，请先裁剪。");

    onProgress(0.03);
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });

    const step = 1 / 15;
    const frames = [];
    for (let time = 0, index = 0; time < video.duration; time += step, index += 1) {
      await seek(video, Math.min(time, Math.max(0, video.duration - 0.001)));
      const result = landmarker.detectForVideo(video, Math.round(time * 1000));
      const landmarks = result.landmarks[0];
      const worldLandmarks = result.worldLandmarks[0];
      if (landmarks && worldLandmarks) frames.push(deriveFrame(time, landmarks, exercise.landmarks, worldLandmarks));
      onProgress(0.08 + 0.9 * Math.min(1, time / video.duration));
      if (index % 5 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    onProgress(1);
    return analyzePoseFrames(frames, exercise);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("分析失败，请刷新后重试。");
  } finally {
    landmarker?.close();
    URL.revokeObjectURL(url);
  }
}
