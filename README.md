# Form / 健身动作分析

浏览器本地运行的动作分析 MVP。支持徒手深蹲、俯卧撑和前弓步，可上传视频或使用摄像头录制。视频帧不会上传到服务器。

## 运行

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

生产构建与测试：

```bash
npm test
npm run build
```

首次分析需要联网加载固定版本的 MediaPipe WASM 和 Pose Landmarker Lite 模型。之后的视频解码、关键点提取和规则分析均在浏览器本地完成。

## 拍摄要求

- 单人侧面拍摄，完整展示肩、髋、膝、踝和脚。
- 相机固定并与髋部或躯干同高，光线充足，身体无遮挡。
- 从完整起始姿势开始，每次动作结束后回到起始姿势。
- 视频限制为 1-90 秒、最大 250 MB。

桌面 Chrome、Edge、Safari 及其移动端现代版本可上传视频。摄像头录制依赖 `getUserMedia` 和 `MediaRecorder`；不支持录制时仍可上传。

## 分析边界

阈值集中在 `src/exercises.ts`，当前仅用于产品验证，正式发布前必须由专业教练通过标注视频校准。本工具提供训练辅助反馈，不提供医学判断或伤病诊断。

动作文字参考 [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)，仅用于学习和非商业研究。上游当前 JSON 的媒体字段为空，仓库也未包含 README 所述图片和 GIF，因此本项目没有复制不可用的演示素材。
