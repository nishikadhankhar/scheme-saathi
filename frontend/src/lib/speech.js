// Text to speech. Order of preference:
//   1. the backend's /api/tts MP3 (gTTS: good Indian-language voices on any phone),
//   2. the browser's speechSynthesis,
//   3. a timed "speaking" state, so the UI still behaves when nothing can talk.
// Browsers block audio before the first tap, so auto-speak waits for a user gesture.
import { useSyncExternalStore } from 'react';
import { api } from './api';

const BCP47 = {
  hi: 'hi-IN', en: 'en-IN', pa: 'pa-IN', mr: 'mr-IN', bn: 'bn-IN', ta: 'ta-IN',
  te: 'te-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', or: 'or-IN',
};
const BACKEND_TTS = new Set(['en', 'hi', 'kn', 'ta', 'te', 'ml', 'mr', 'bn', 'gu', 'pa', 'or']);
const MAX_TTS_CHARS = 1500;                  // backend limit on ?text=
const AUDIO_START_TIMEOUT_MS = 7000;         // slow 3G: give up on the MP3 and use the phone's voice

let speakingId = null;
let seq = 0;
let audio = null;
let timer = null;
let userActive = false;
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());
const set = (id) => { speakingId = id; emit(); };

if (typeof window !== 'undefined') {
  const mark = () => { userActive = true; };
  window.addEventListener('pointerdown', mark, { once: true, capture: true });
  window.addEventListener('keydown', mark, { once: true, capture: true });
}

function clip(text) {
  if (text.length <= MAX_TTS_CHARS) return text;
  const cut = text.slice(0, MAX_TTS_CHARS);
  const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('।'), cut.lastIndexOf('?'));
  return end > 200 ? cut.slice(0, end + 1) : cut;
}

function teardown() {
  clearTimeout(timer);
  timer = null;
  if (audio) { audio.onended = audio.onerror = audio.onplaying = null; audio.pause(); audio = null; }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

function browserVoice(token, text, lang, id) {
  const done = () => { if (token === seq) set(null); };
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
    timer = setTimeout(done, Math.min(9000, 900 + 55 * text.length));
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = BCP47[lang] || 'en-IN';
  u.rate = 0.9;
  u.onend = done;
  u.onerror = done;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

export const speech = {
  get userActive() { return userActive; },

  stop() {
    seq += 1;
    teardown();
    if (speakingId !== null) set(null);
  },

  stopIf(id) { if (speakingId === id) speech.stop(); },

  speak(id, text, lang = 'en') {
    const clean = (text || '').trim();
    if (!clean) return;
    speech.stop();
    const token = seq;
    set(id);
    const targetLang = (lang && lang !== 'en' && /^[\x00-\x7F]*$/.test(clean.replace(/[₹]/g, ''))) ? 'en' : (lang || 'en');
    if (!BACKEND_TTS.has(targetLang)) { browserVoice(token, clean, targetLang, id); return; }

    const el = new Audio(api.ttsUrl(clip(clean), targetLang));
    audio = el;
    const fallback = () => {
      if (token !== seq) return;
      teardown();
      browserVoice(token, clean, lang, id);
    };
    timer = setTimeout(fallback, AUDIO_START_TIMEOUT_MS);
    el.onplaying = () => { clearTimeout(timer); timer = null; };
    el.onended = () => { if (token === seq) { teardown(); set(null); } };
    el.onerror = fallback;
    el.play().catch((e) => {
      if (token !== seq) return;
      if (e?.name === 'NotAllowedError') { teardown(); set(null); } else fallback();
    });
  },

  /** Speak without being asked, but only once the person has touched the screen. */
  auto(id, text, lang) {
    if (userActive) speech.speak(id, text, lang);
  },
};

export function useSpeaking(id) {
  const speaking = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => speakingId,
    () => null,
  );
  return speaking === id;
}
