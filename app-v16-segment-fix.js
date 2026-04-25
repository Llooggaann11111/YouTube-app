function segmentWords(text) {
  return clean(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .slice(0, 40);
}

function chooseSegmentForClip(clip) {
  const copy = { ...clip };
  const duration = Number(copy.duration || 0);
  const text = `${copy.tags || ""} ${copy.credit || ""} ${copy.source || ""} ${copy.pageUrl || ""}`.toLowerCase();
  const sceneTokens = new Set(segmentWords(`${state.scene || ""} ${state.subject || ""}`));
  const iconicWords = new Set(["speech", "podium", "march", "protest", "court", "trial", "hearing", "eruption", "explosion", "launch", "goal", "ceremony", "interview", "debate", "performance", "experiment", "demonstration", "rescue", "historic", "famous", "iconic"]);
  let iconicScore = 0;
  for (const word of segmentWords(text)) {
    if (sceneTokens.has(word) || iconicWords.has(word)) iconicScore += 1;
  }

  let clipDuration = 25;
  if (duration > 0 && duration < 25) clipDuration = Math.min(duration, 30);
  if (duration > 0 && duration <= 30) clipDuration = duration;

  let startTime = 0;
  let reason = duration ? "source already short" : "duration unknown, use first 25 seconds";
  if (duration > 30) {
    const latestStart = Math.max(0, duration - clipDuration);
    if (copy.match === "exact" && iconicScore > 0) {
      startTime = Math.min(Math.max(8, duration * 0.18), latestStart);
      reason = "exact topic, starts near likely action point";
    } else if (iconicScore > 0) {
      startTime = Math.min(Math.max(5, duration * 0.12), latestStart);
      reason = "scene keywords found, starts near likely visual action";
    } else {
      startTime = Math.min(10, latestStart);
      reason = "long source, avoid using the full video";
    }
  }

  copy.startTime = Math.round(startTime * 100) / 100;
  copy.clipDuration = Math.round(clipDuration * 100) / 100;
  copy.trimToSeconds = copy.clipDuration;
  copy.endTime = Math.round((copy.startTime + copy.clipDuration) * 100) / 100;
  copy.needsTrim = duration > 30;
  copy.iconicScore = iconicScore;
  copy.segmentReason = reason;
  return copy;
}

function addClip(index) {
  const clip = state.clips[index];
  if (!clip) return;
  state.timeline.push(chooseSegmentForClip(clip));
  save();
  renderTimeline();
  renderPost();
  toast("Clip added as a short segment");
}

function getTimelineClip(index) {
  return chooseSegmentForClip(state.timeline[index] || {});
}

function getClipStart(clip) {
  const value = Number(clip.startTime || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getClipDuration(clip, fallback) {
  const value = Number(clip.clipDuration || clip.trimToSeconds || 25);
  if (Number.isFinite(value) && value > 0) return Math.min(30, Math.max(1, value));
  return Math.min(30, Math.max(1, fallback || 25));
}

const originalRenderTimeline = renderTimeline;
renderTimeline = function renderTimelineWithSegments() {
  const box = $("#timeline");
  if (!box) return;
  const count = $("#timelineCount");
  if (count) count.textContent = `${state.timeline.length} clips selected. Final length: ${state.length} seconds.`;
  box.innerHTML = state.timeline.length ? "" : `<div class="box">No clips added yet.</div>`;
  state.timeline.forEach((rawClip, index) => {
    const clip = chooseSegmentForClip(rawClip);
    state.timeline[index] = clip;
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div>
        <strong>Clip ${index + 1} · ${esc(clip.source)}</strong>
        <small>${esc(clip.license)}</small>
        <small>Using ${clip.startTime}s to ${clip.endTime}s, ${clip.clipDuration}s total</small>
        <small>${esc(clip.segmentReason || "short segment selected")}</small>
        <small>${esc(clip.pageUrl)}</small>
      </div>
      <button type="button" data-remove="${index}">×</button>`;
    box.appendChild(item);
  });
  $$('[data-remove]').forEach((button) => button.onclick = () => {
    state.timeline.splice(Number(button.dataset.remove), 1);
    save();
    renderTimeline();
    renderPost();
  });
  save();
};

async function renderVideo() {
  syncFromFields(true);
  const canvas = $("#canvas");
  if (!canvas || !canvas.captureStream || !window.MediaRecorder) {
    toast("This browser cannot render video.");
    return;
  }

  state.timeline = state.timeline.map(chooseSegmentForClip);
  save();
  renderTimeline();

  const ctx = canvas.getContext("2d");
  const totalDuration = Math.min(45, Math.max(25, Number(state.length) || 30));
  const videos = [];

  try {
    for (const clip of state.timeline) {
      videos.push(await loadVideo(clip.videoUrl));
    }
  } catch (_) {}

  const recorder = new MediaRecorder(canvas.captureStream(24), {
    mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm"
  });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const done = new Promise((resolve) => recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" })));

  recorder.start();
  const startClock = performance.now();

  function frame(now) {
    const t = Math.min((now - startClock) / 1000, totalDuration);
    const top = 430;
    const bottom = 110;

    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, 720, 1280);

    if (videos.length) {
      const segmentOnFinal = totalDuration / videos.length;
      const index = Math.min(videos.length - 1, Math.floor(t / segmentOnFinal));
      const video = videos[index];
      const clip = getTimelineClip(index);
      const clipStart = getClipStart(clip);
      const clipDuration = getClipDuration(clip, segmentOnFinal);
      const localTime = (t - index * segmentOnFinal) % clipDuration;
      const wantedTime = clipStart + localTime;

      try {
        const maxTime = Math.max(0, (video.duration || wantedTime + 1) - 0.25);
        video.currentTime = Math.min(wantedTime, maxTime);
        drawCover(ctx, video, 0, top, 720, 1280 - top - bottom);
      } catch (_) {}
    } else {
      ctx.fillStyle = "#1f6fb6";
      ctx.fillRect(0, top, 720, 1280 - top - bottom);
    }

    ctx.fillStyle = "#030303";
    ctx.fillRect(0, 0, 720, top);
    ctx.fillStyle = "#18f038";
    ctx.font = "900 56px -apple-system,Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DID YOU KNOW?", 360, 82);

    ctx.fillStyle = "white";
    ctx.font = "900 35px -apple-system,Segoe UI,sans-serif";
    wrapText(ctx, clean(state.fact), 360, 137, 660, 39, 7);

    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 1170, 720, 110);
    ctx.fillStyle = "white";
    ctx.font = "bold 29px -apple-system,Segoe UI,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("@FactPulse", 28, 1215);
    ctx.font = "bold 25px -apple-system,Segoe UI,sans-serif";
    ctx.fillText(makeTitle().slice(0, 38), 28, 1256);

    const progress = $("#progress");
    if (progress) progress.style.width = `${(t / totalDuration) * 100}%`;

    if (t < totalDuration) requestAnimationFrame(frame);
    else recorder.stop();
  }

  requestAnimationFrame(frame);
  renderedBlob = await done;
  const url = URL.createObjectURL(renderedBlob);
  const out = $("#videoOut");
  if (out) {
    out.innerHTML = `<video controls playsinline src="${url}"></video><a class="btn primary" href="${url}" download="factpulse-short.webm" style="margin-top:10px">Download styled video</a>`;
  }
  toast("Styled video rendered from selected short segments.");
}

window.addEventListener("DOMContentLoaded", () => {
  const button = $("#renderBtn");
  if (button) button.onclick = renderVideo;
  renderTimeline();
});
