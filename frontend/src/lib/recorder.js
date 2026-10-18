// Microphone recording for /api/transcribe (MediaRecorder), with pause/resume and a simple
// "did we hear anything?" check from the audio level.
//
// status: 'idle' | 'recording' | 'paused' | 'denied' | 'unsupported'
import { useCallback, useEffect, useRef, useState } from 'react';

const supported = () =>
  typeof window !== 'undefined' && !!window.MediaRecorder && !!navigator.mediaDevices?.getUserMedia;

function pickMime() {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return options.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
}

const fresh = () => ({ stream: null, mr: null, chunks: [], ctx: null, level: null, limit: null, fallback: null });

export function useRecorder({ maxMs = 120000, onLimit } = {}) {
  const [status, setStatus] = useState(() => (supported() ? 'idle' : 'unsupported'));
  const [heard, setHeard] = useState(false);
  const r = useRef(fresh());
  const limitRef = useRef(onLimit);
  limitRef.current = onLimit;

  const cleanup = useCallback(() => {
    const s = r.current;
    clearInterval(s.level);
    clearTimeout(s.limit);
    clearTimeout(s.fallback);
    s.stream?.getTracks().forEach((t) => t.stop());
    s.ctx?.close?.().catch(() => {});
    r.current = fresh();
  }, []);

  // If the browser already knows the mic is blocked, say so before the first tap.
  useEffect(() => {
    if (!supported()) return;
    navigator.permissions?.query({ name: 'microphone' })
      .then((p) => { if (p.state === 'denied') setStatus('denied'); })
      .catch(() => {});
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    if (!supported()) { setStatus('unsupported'); return false; }
    cleanup();
    setHeard(false);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      setStatus(e?.name === 'NotFoundError' ? 'unsupported' : 'denied');
      return false;
    }
    const mime = pickMime();
    let mr;
    try {
      mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setStatus('unsupported');
      return false;
    }
    const s = fresh();
    s.stream = stream;
    s.mr = mr;
    mr.ondataavailable = (e) => { if (e.data?.size) s.chunks.push(e.data); };
    mr.start(250);

    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      try {
        s.ctx = new AC();
        const an = s.ctx.createAnalyser();
        an.fftSize = 1024;
        s.ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.fftSize);
        let loud = 0;
        s.level = setInterval(() => {
          if (mr.state !== 'recording') return;
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (let i = 0; i < buf.length; i += 1) peak = Math.max(peak, Math.abs(buf[i] - 128));
          if (peak > 10) loud += 1;
          if (loud >= 3) setHeard(true);
        }, 120);
      } catch { s.fallback = setTimeout(() => setHeard(true), 2500); }
    } else {
      s.fallback = setTimeout(() => setHeard(true), 2500);
    }
    s.limit = setTimeout(() => limitRef.current?.(), maxMs);
    r.current = s;
    setStatus('recording');
    return true;
  }, [cleanup, maxMs]);

  const pause = useCallback(() => {
    const mr = r.current.mr;
    if (mr?.state === 'recording') { mr.pause(); setStatus('paused'); }
  }, []);

  const resume = useCallback(() => {
    const mr = r.current.mr;
    if (mr?.state === 'paused') { mr.resume(); setStatus('recording'); }
  }, []);

  /** Stop and return the recording as a Blob (null if nothing was recording). */
  const stop = useCallback(() => new Promise((resolve) => {
    const { mr, chunks } = r.current;
    if (!mr || mr.state === 'inactive') { cleanup(); setStatus('idle'); resolve(null); return; }
    const type = (mr.mimeType || 'audio/webm').split(';')[0];
    mr.onstop = () => {
      const blob = new Blob(chunks, { type });
      cleanup();
      setStatus('idle');
      resolve(blob);
    };
    mr.stop();
  }), [cleanup]);

  const discard = useCallback(() => {
    const { mr } = r.current;
    if (mr && mr.state !== 'inactive') { mr.onstop = null; mr.stop(); }
    cleanup();
    setHeard(false);
    setStatus((s) => (s === 'recording' || s === 'paused' ? 'idle' : s));
  }, [cleanup]);

  return { status, heard, start, pause, resume, stop, discard, blocked: status === 'denied' || status === 'unsupported' };
}
