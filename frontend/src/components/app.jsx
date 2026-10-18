import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { I18nContext, LANGUAGES, stringsFor } from '../lib/i18n';
import { api, bannerFor } from '../lib/api';
import { speech } from '../lib/speech';
import { store } from '../lib/store';
import { useRecorder } from '../lib/recorder';
import { ICON_FOR, schemeView } from '../lib/schemes';
import { LanguageSheet, LanguageTile, StatusBanner, TopBar, reducedMotion } from './ui';
import { SchemeDetailSheet } from './scheme-ui';
import {
  ListeningScreen, QuestionsScreen, ResultsScreen, SearchingScreen, SummaryScreen, WelcomeScreen,
} from './screens';

const EMPTY_CONV = { profile: {}, asked: [], stage: 'collecting', thread: [], last: null };
const MIN_AUDIO_BYTES = 1500;      // anything smaller is silence
const PREFETCH = 3;                // flashcards loaded in the background (Gemini free tier is ~8-10 calls/min)

function initialSession() {
  const s = store.get('session');
  if (s?.conv?.thread?.length) return { conv: s.conv, screen: s.conv.stage === 'confirming' ? 'summary' : 'questions' };
  return { conv: EMPTY_CONV, screen: 'welcome' };
}

export function SchemeSaathiApp({ initialLang = 'hi' }) {
  const boot = useMemo(initialSession, []);
  const [lang, setLang] = useState(() => store.get('lang') || initialLang);
  const [theme, setTheme] = useState(() => store.get('theme') || 'day');
  const [screen, setScreen] = useState(boot.screen);
  const [conv, setConv] = useState(boot.conv);
  const [busy, setBusy] = useState(null);                 // null | 'transcribing' | 'thinking'
  const [heardText, setHeardText] = useState('');
  const [error, setError] = useState(null);               // { kind, retry }
  const [sorry, setSorry] = useState(false);
  const [typing, setTyping] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [serverDown, setServerDown] = useState(null);     // from /api/health
  const [correcting, setCorrecting] = useState(false);
  const [results, setResults] = useState(null);
  const [cards, setCards] = useState({});
  const [openSlug, setOpenSlug] = useState(null);
  const [flipping, setFlipping] = useState(null);
  const [langSheet, setLangSheet] = useState(false);

  const convRef = useRef(conv);
  convRef.current = conv;
  const langRef = useRef(lang);
  langRef.current = lang;
  const epoch = useRef(0);                                // bumps on Start over so late replies are ignored
  const lastBlob = useRef(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const queue = useRef(Promise.resolve());

  /* ---------- page-level effects ---------- */
  useEffect(() => { document.documentElement.lang = lang; store.set('lang', lang); }, [lang]);
  useEffect(() => { document.documentElement.dataset.theme = theme; store.set('theme', theme); }, [theme]);
  useEffect(() => {
    if (conv.thread.length) store.set('session', { conv }); else store.remove('session');
  }, [conv]);

  const checkServer = useCallback(async () => {
    try {
      const h = await api.health();
      setServerDown(h.llm ? null : 'error');
      return true;
    } catch (e) {
      setServerDown(bannerFor(e).kind);
      return false;
    }
  }, []);
  useEffect(() => { checkServer(); }, [checkServer]);
  useEffect(() => {
    const on = () => { setOffline(false); checkServer(); };
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [checkServer]);

  /* ---------- talking to Saathi ---------- */
  const fail = useCallback((err, retry) => {
    const b = bannerFor(err);
    setError({ kind: b.kind, retry: b.retry ? retry : null });
  }, []);

  const startSearch = useCallback(() => {
    setError(null);
    setResults(null);
    setScreen('searching');
  }, []);

  const sendMessage = useCallback(async (text) => {
    const message = (text || '').trim();
    if (!message) return;
    const my = epoch.current;
    const c = convRef.current;
    setError(null);
    setSorry(false);
    setBusy('thinking');
    setHeardText(message);
    try {
      const res = await api.chat({
        message, stage: c.stage, profile: c.profile, asked: c.asked, language: langRef.current,
        history: c.thread.slice(-12).map(({ role, text: x }) => ({ role, text: x })),
      });
      if (my !== epoch.current) return;
      const icon = res.stage === 'confirming' ? 'person' : ICON_FOR[res.asking_about] || 'help';
      const next = {
        profile: res.profile, asked: res.asked, stage: res.stage, last: res,
        thread: [...c.thread, { role: 'user', text: message },
          { role: 'assistant', text: res.reply, icon, lang: res.language }],
      };
      setConv(next);
      setBusy(null);
      setHeardText('');
      setCorrecting(false);
      if (res.stage === 'confirmed') startSearch();
      else setScreen(res.stage === 'confirming' ? 'summary' : 'questions');
    } catch (err) {
      if (my !== epoch.current) return;
      setBusy(null);
      if (err.kind === 'bad-request') { setSorry(true); return; }
      fail(err, () => sendMessage(message));
    }
  }, [fail, startSearch]);

  const transcribeAndSend = useCallback(async (blob) => {
    const my = epoch.current;
    setError(null);
    setSorry(false);
    setBusy('transcribing');
    try {
      const { text } = await api.transcribe(blob);
      if (my !== epoch.current) return;
      lastBlob.current = null;
      if (!text || !text.trim()) { setBusy(null); setSorry(true); return; }
      await sendMessage(text);
    } catch (err) {
      if (my !== epoch.current) return;
      setBusy(null);
      if (err.kind === 'bad-request') { lastBlob.current = null; setSorry(true); return; }
      if (err.kind === 'too-long') lastBlob.current = null;
      else setTyping(true);                              // voice isn't getting through: offer typing too
      fail(err, lastBlob.current ? () => transcribeAndSend(lastBlob.current) : null);
    }
  }, [fail, sendMessage]);

  const finishRecording = useCallback(async () => {
    const blob = await recRef.current.stop();
    if (!blob || blob.size < MIN_AUDIO_BYTES) { setSorry(true); return; }
    lastBlob.current = blob;
    transcribeAndSend(blob);
  }, [transcribeAndSend]);

  const rec = useRecorder({ onLimit: () => finishRecording() });
  const recRef = useRef(rec);
  recRef.current = rec;

  const beginRecording = useCallback(async () => {
    speech.stop();                                       // don't record Saathi's own voice
    setError(null);
    setSorry(false);
    setHeardText('');
    return recRef.current.start();
  }, []);

  /* ---------- screen handlers ---------- */
  const goHome = useCallback(() => {
    epoch.current += 1;
    speech.stop();
    recRef.current.discard();
    lastBlob.current = null;
    store.remove('session');
    setConv(EMPTY_CONV);
    setResults(null);
    setCards({});
    queue.current = Promise.resolve();
    setOpenSlug(null);
    setFlipping(null);
    setError(null);
    setSorry(false);
    setTyping(false);
    setBusy(null);
    setHeardText('');
    setCorrecting(false);
    setScreen('welcome');
  }, []);

  const micFromWelcome = async () => {
    if (await beginRecording()) setScreen('listening');
  };
  const toggleRecording = () => (rec.status === 'recording' ? rec.pause() : rec.resume());
  const again = async () => { rec.discard(); await beginRecording(); };
  const micInQuestions = () => (rec.status === 'idle' ? beginRecording() : finishRecording());
  const correct = async () => {
    setCorrecting(true);
    setScreen('listening');
    await beginRecording();
  };
  const tellMore = async () => {
    setCorrecting(true);
    setScreen('listening');
    await beginRecording();
  };
  const sendFromChip = (text) => { speech.stop(); sendMessage(text); };
  const sendTyped = (text) => { speech.stop(); sendMessage(text); };

  /* ---------- scheme flashcards ---------- */
  const cardKey = useCallback((slug) => `${slug}|${langRef.current}`, []);
  const loadCard = useCallback((slug, { priority = false, force = false } = {}) => {
    const key = `${slug}|${langRef.current}`;
    const cur = cardsRef.current[key];
    if (!force && cur && (cur.status === 'ok' || cur.status === 'loading' || (cur.status === 'queued' && !priority))) return;
    const my = epoch.current;
    const run = () => api.card(slug, langRef.current, convRef.current.profile)
      .then((data) => { if (my === epoch.current) setCards((c) => ({ ...c, [key]: { status: 'ok', data } })); })
      .catch((error) => { if (my === epoch.current) setCards((c) => ({ ...c, [key]: { status: 'error', error } })); });
    if (priority) {
      setCards((c) => ({ ...c, [key]: { status: 'loading' } }));
      run();
      return;
    }
    setCards((c) => ({ ...c, [key]: { status: 'queued' } }));
    queue.current = queue.current.then(() => {
      if (cardsRef.current[key]?.status !== 'queued') return undefined;   // opened by hand meanwhile
      setCards((c) => ({ ...c, [key]: { status: 'loading' } }));
      return run();
    });
  }, []);

  useEffect(() => {
    if (screen !== 'results' || !results) return;
    results.schemes.slice(0, PREFETCH).forEach((s) => loadCard(s.slug));
  }, [screen, results, lang, loadCard]);

  const openScheme = (slug) => {
    loadCard(slug, { priority: true });
    if (reducedMotion()) { setOpenSlug(slug); return; }
    setFlipping(slug);
    setTimeout(() => setOpenSlug(slug), 420);
    setTimeout(() => setFlipping(null), 900);
  };
  const retryCard = (slug) => loadCard(slug, { priority: true, force: true });

  /* ---------- render ---------- */
  const t = useMemo(() => stringsFor(lang), [lang]);
  const ctx = useMemo(() => ({ lang, t }), [lang, t]);
  const wide = screen === 'results';

  // Pinned status: no internet beats everything; then a server that is down; then this screen's own error.
  let banner = null;
  if (offline) banner = { kind: 'offline', action: () => { setOffline(!navigator.onLine); checkServer(); } };
  else if (serverDown && screen !== 'searching') banner = { kind: serverDown, action: checkServer };
  else if (error && screen !== 'searching') banner = { kind: error.kind, action: error.retry || undefined };

  const openScheme_ = openSlug && results?.schemes.find((s) => s.slug === openSlug);
  const cardState = openSlug ? cards[cardKey(openSlug)] : null;

  return (
    <I18nContext.Provider value={ctx}>
      <div className="min-h-screen bg-surface text-ink">
        <TopBar showRestart={screen !== 'welcome'} onRestart={goHome} onLanguage={() => setLangSheet(true)} />
        <main className={`mx-auto w-full px-4 pb-16 pt-6 ${wide ? 'max-w-column lg:max-w-[1000px]' : 'max-w-column'}`}>
          {banner && <div className="mb-6"><StatusBanner kind={banner.kind} onAction={banner.action} /></div>}
          {screen === 'welcome' && (
            <WelcomeScreen lang={lang} rec={rec} busy={busy} onPickLanguage={setLang}
              onMic={micFromWelcome} onSendText={sendTyped} />
          )}
          {screen === 'listening' && (
            <ListeningScreen lang={lang} rec={rec} busy={busy} heardText={heardText} sorry={sorry}
              prompt={correcting ? t.correctPrompt : t.tapToSpeak}
              onDone={finishRecording} onToggle={toggleRecording} onAgain={again} onStart={beginRecording}
              onSendText={sendTyped} />
          )}
          {screen === 'questions' && (
            <QuestionsScreen lang={lang} conv={conv} rec={rec} busy={busy} sorry={sorry} typing={typing}
              onChip={sendFromChip} onMic={micInQuestions} onSendText={sendTyped} />
          )}
          {screen === 'summary' && (
            <SummaryScreen lang={lang} conv={conv} onConfirm={startSearch} onCorrect={correct} />
          )}
          {screen === 'searching' && (
            <SearchingScreen profile={conv.profile} lang={lang} offline={offline}
              onDone={(res) => { setResults(res); setScreen('results'); }} />
          )}
          {screen === 'results' && results && (
            <ResultsScreen lang={lang} results={results} cards={cards} cardKey={cardKey} flippingSlug={flipping}
              onOpen={openScheme} onTellMore={tellMore} onRetrySearch={startSearch} />
          )}
        </main>

        {openScheme_ && (
          <SchemeDetailSheet
            view={schemeView(openScheme_, cardState?.data, lang)}
            official={openScheme_.name}
            card={cardState?.data}
            state={cardState}
            whyList={openScheme_.why || []}
            onClose={() => setOpenSlug(null)}
            onRetry={() => retryCard(openSlug)}
          />
        )}
        {langSheet && (
          <LanguageSheet current={lang} theme={theme}
            onTheme={() => setTheme((x) => (x === 'sunlight' ? 'day' : 'sunlight'))}
            onPick={setLang} onClose={() => setLangSheet(false)}
            tiles={(current, pick) => LANGUAGES.map((l) => (
              <LanguageTile key={l.code} language={l} selected={l.code === current} onSelect={pick} />
            ))} />
        )}
      </div>
    </I18nContext.Provider>
  );
}
