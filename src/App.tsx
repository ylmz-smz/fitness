import { useEffect, useRef, useState } from "react";
import { exerciseById, exercises } from "./exercises";
import type { AnalysisResult, ExerciseId, Point } from "./types";
import { analyzeVideo } from "./video";

const CONNECTIONS = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31], [24, 26], [26, 28], [28, 30], [30, 32]];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

function drawPose(canvas: HTMLCanvasElement, video: HTMLVideoElement, landmarks?: Point[]) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, width, height);
  if (!landmarks) return;
  context.strokeStyle = "#b7f34b";
  context.fillStyle = "#b7f34b";
  context.lineWidth = Math.max(3, width / 280);
  context.lineCap = "round";
  for (const [from, to] of CONNECTIONS) {
    const a = landmarks[from];
    const b = landmarks[to];
    if (!a || !b || (a.visibility ?? 1) < 0.45 || (b.visibility ?? 1) < 0.45) continue;
    context.beginPath();
    context.moveTo(a.x * width, a.y * height);
    context.lineTo(b.x * width, b.y * height);
    context.stroke();
  }
  landmarks.forEach((point) => {
    if ((point.visibility ?? 1) < 0.45) return;
    context.beginPath();
    context.arc(point.x * width, point.y * height, Math.max(4, width / 220), 0, Math.PI * 2);
    context.fill();
  });
}

function App() {
  const [exerciseId, setExerciseId] = useState<ExerciseId>("squat");
  const [blob, setBlob] = useState<Blob>();
  const [videoUrl, setVideoUrl] = useState("");
  const [result, setResult] = useState<AnalysisResult>();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exercise = exerciseById[exerciseId];

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    stream?.getTracks().forEach((track) => track.stop());
  }, [stream, videoUrl]);

  useEffect(() => {
    if (previewRef.current && stream) previewRef.current.srcObject = stream;
  }, [stream]);

  const useBlob = (nextBlob: Blob) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setBlob(nextBlob);
    setVideoUrl(URL.createObjectURL(nextBlob));
    setResult(undefined);
    setError("");
    setProgress(0);
  };

  const startCamera = async () => {
    setError("");
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } });
      setStream(nextStream);
    } catch {
      setError("无法访问摄像头。请允许权限，或改用视频上传。 ");
    }
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? { mimeType: "video/webm;codecs=vp9" } : undefined);
    recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
    recorder.onstop = () => useBlob(new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" }));
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    stream?.getTracks().forEach((track) => track.stop());
    setStream(undefined);
    setIsRecording(false);
  };

  const analyze = async () => {
    if (!blob) return;
    setError("");
    setResult(undefined);
    setIsAnalyzing(true);
    try {
      setResult(await analyzeVideo(blob, exercise, setProgress));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "分析失败，请重试。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateOverlay = () => {
    const video = playbackRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !result?.frames.length) return;
    const frame = result.frames.reduce((closest, item) => Math.abs(item.timestamp - video.currentTime) < Math.abs(closest.timestamp - video.currentTime) ? item : closest);
    drawPose(canvas, video, frame.landmarks);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="回到顶部">FORM<span>/</span></a>
        <p>本地动作分析</p>
        <span className="privacy">视频不上传</span>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="kicker">动作质量，而不只是次数</p>
          <h1>把每一次动作<br />拆成可改进的数据。</h1>
        </div>
        <p className="intro-copy">上传或录制一段侧面视频。姿态识别在浏览器本地运行，并定位到每次动作的具体问题。</p>
      </section>

      <section className="workspace" aria-label="动作分析工作区">
        <aside className="exercise-panel">
          <h2>选择动作</h2>
          <div className="exercise-list" role="radiogroup" aria-label="动作">
            {exercises.map((item) => (
              <button key={item.id} className={item.id === exerciseId ? "exercise active" : "exercise"} role="radio" aria-checked={item.id === exerciseId} onClick={() => { setExerciseId(item.id); setResult(undefined); }}>
                <span>{item.name}</span><small>{item.sourceId}</small>
              </button>
            ))}
          </div>
          <div className="guide">
            <h3>拍摄要求</h3>
            <p>{exercise.cameraGuide}</p>
            <h3>动作说明</h3>
            <p>{exercise.instruction}</p>
          </div>
        </aside>

        <div className="input-panel">
          {!stream && !videoUrl && (
            <div className="empty-state">
              <span className="frame-mark" aria-hidden="true">＋</span>
              <h2>准备一段侧面视频</h2>
              <p>支持 MP4、WebM、MOV，最长 90 秒，文件不超过 250 MB。</p>
              <div className="actions">
                <label className="button primary">
                  选择视频
                  <input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" onChange={(event) => event.target.files?.[0] && useBlob(event.target.files[0])} />
                </label>
                <button className="button secondary" onClick={startCamera} disabled={!navigator.mediaDevices || !window.MediaRecorder}>打开摄像头</button>
              </div>
              {(!navigator.mediaDevices || !window.MediaRecorder) && <p className="support-note">当前浏览器不支持录制，但仍可上传视频。</p>}
            </div>
          )}

          {stream && (
            <div className="video-stage">
              <video ref={previewRef} autoPlay muted playsInline />
              <div className="camera-frame" aria-hidden="true" />
              <div className="stage-actions">
                {!isRecording ? <button className="button primary" onClick={startRecording}>开始录制</button> : <button className="button danger" onClick={stopRecording}>停止录制</button>}
                {!isRecording && <button className="button ghost" onClick={() => { stream.getTracks().forEach((track) => track.stop()); setStream(undefined); }}>取消</button>}
              </div>
            </div>
          )}

          {videoUrl && (
            <div className="video-stage">
              <video ref={playbackRef} src={videoUrl} controls playsInline onTimeUpdate={updateOverlay} onSeeked={updateOverlay} />
              {result && <canvas ref={canvasRef} className="pose-canvas" aria-hidden="true" />}
              <div className="stage-actions">
                <button className="button primary" onClick={analyze} disabled={isAnalyzing}>{isAnalyzing ? "正在分析" : result ? "重新分析" : "开始分析"}</button>
                <label className="button ghost">更换视频<input type="file" accept="video/*" onChange={(event) => event.target.files?.[0] && useBlob(event.target.files[0])} /></label>
              </div>
            </div>
          )}

          {isAnalyzing && <div className="progress" role="status"><span style={{ width: `${Math.round(progress * 100)}%` }} /><p>本地分析中 {Math.round(progress * 100)}%</p></div>}
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </section>

      {result && (
        <section className="results" aria-live="polite">
          <div className="result-heading">
            <div><p className="kicker">分析结果</p><h2>{result.failureReason ? "这段视频暂时无法评分" : `${result.validReps} / ${result.totalReps} 次动作达标`}</h2></div>
            <dl><div><dt>识别置信度</dt><dd>{Math.round(result.confidence * 100)}%</dd></div><div><dt>动作</dt><dd>{exercise.name}</dd></div></dl>
          </div>
          {result.failureReason ? <p className="failure">{result.failureReason}</p> : (
            <div className="rep-list">
              {result.repetitions.map((rep) => (
                <article className="rep" key={rep.index}>
                  <div className="rep-meta"><span>第 {rep.index} 次</span><strong className={rep.valid ? "good" : "needs-work"}>{rep.valid ? "达标" : "需改进"}</strong><time>{formatTime(rep.startTime)} - {formatTime(rep.endTime)}</time></div>
                  {rep.issues.length ? <ul>{rep.issues.map((issue) => <li key={issue.ruleId}><button onClick={() => { if (playbackRef.current) { playbackRef.current.currentTime = issue.timestamp; playbackRef.current.play().catch(() => undefined); } }}><span>{issue.label}</span><time>{formatTime(issue.timestamp)}</time></button><p>{issue.message}</p></li>)}</ul> : <p className="clean-rep">动作幅度与躯干控制未发现明显问题。</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <footer>
        <p>训练辅助工具，不提供医疗诊断。初始阈值需由专业教练校准。</p>
        <p>动作说明来源：hasaneyldrm/exercises-dataset，仅限学习与非商业研究。</p>
      </footer>
    </main>
  );
}

export default App;
