import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon, SaathiMark } from './icons';
import { speech, useSpeaking } from '../lib/speech';
import { useI18n, hasUiTranslation, languageOf } from '../lib/i18n';
import { CATEGORY_STYLE } from '../lib/schemes';

export const cx = (...a) => a.filter(Boolean).join(' ');
export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Auto-speak a screen's main text once the person has touched the screen. */
export function useAutoSpeak(text, lang, enabled = true) {
  const id = useId();
  useEffect(() => {
    if (enabled && text) speech.auto(id, text, lang);
  }, [id, text, lang, enabled]);
}

/* ------------------------------------------------------------------ ListenButton */
export function ListenButton({ text, lang, size = 'md', tone = 'plain', className }) {
  const { t, lang: ui } = useI18n();
  const id = useId();
  const speaking = useSpeaking(id);
  useEffect(() => () => speech.stopIf(id), [id]);
  const tones = {
    plain: 'bg-surface-sunken border-line-strong text-ink',
    warm: 'bg-turmeric-400 border-ink text-ink',
    onFill: 'bg-on-fill border-on-fill text-field-800',
  };
  const onClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (speaking) speech.stop();
    else speech.speak(id, text, lang || ui);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={speaking}
      aria-label={t.listen + (speaking ? ` — ${t.speaking}` : '')}
      className={cx(
        'ss-press inline-flex shrink-0 items-center justify-center rounded-full border-2',
        size === 'lg' ? 'h-14 w-14' : 'h-touch w-touch',
        tones[tone], speaking && 'ss-speaking', className,
      )}
    >
      {speaking ? <span className="ss-eq" aria-hidden="true"><i /><i /><i /><i /></span>
        : <Icon name="speaker" size={size === 'lg' ? 28 : 24} />}
    </button>
  );
}

/* ------------------------------------------------------------------ MicButton / VoiceWave */
export function MicButton({ state = 'idle', onClick, label, size = 'lg' }) {
  const big = size === 'lg';
  const disabled = state === 'disabled';
  const fill = disabled
    ? 'bg-terracotta-100 border-2 border-terracotta-600 text-terracotta-600'
    : state === 'listening' ? 'bg-field-800 text-on-fill' : 'bg-field-700 text-on-fill';
  const icon = disabled ? 'mic-off' : state === 'paused' ? 'play' : 'mic';
  return (
    <div className="flex max-w-[16rem] flex-col items-center gap-3 text-center">
      <div className={cx('relative', big ? 'h-mic w-mic' : 'h-16 w-16')}>
        {state === 'idle' && <span className="ss-breathe" />}
        {state === 'listening' && <><span className="ss-halo" /><span className="ss-halo ss-halo-2" /></>}
        <button
          type="button"
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={state === 'listening'}
          className={cx('ss-press relative z-[1] flex h-full w-full items-center justify-center rounded-full shadow-card', fill)}
        >
          <Icon name={icon} size={big ? 52 : 30} stroke={2.4} />
        </button>
      </div>
      {label && <span className={cx('text-label', disabled && 'sr-only')}>{label}</span>}
    </div>
  );
}

export function VoiceWave({ active = true, bars = 21 }) {
  return (
    <div className={cx('ss-wave flex h-16 items-center justify-center gap-[5px]', !active && 'ss-wave-still')} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} style={{ height: 64, animationDelay: `${(i * 97) % 600}ms`, animationDuration: `${700 + ((i * 53) % 400)}ms` }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ ActionButton */
export function ActionButton({ variant = 'secondary', icon, children, onClick, href, full = true, disabled, newTab, type = 'button' }) {
  const base = 'ss-press inline-flex min-h-touch-primary items-center justify-center gap-3 rounded-md px-5 text-label';
  const styles = {
    primary: 'bg-field-700 text-on-fill hover:bg-field-800 active:bg-field-800',
    confirm: 'bg-field-700 text-on-fill hover:bg-field-800 active:bg-field-800',
    correct: 'bg-surface-raised border-[3px] border-terracotta-600 text-terracotta-600',
    secondary: 'bg-surface-raised border-2 border-line-strong text-ink',
    quiet: 'bg-transparent text-ink',
  };
  const cls = cx(base, disabled ? 'cursor-not-allowed border-2 border-line-strong bg-surface-sunken text-ink-muted' : styles[variant], full ? 'w-full' : 'w-auto');
  const lead = variant === 'confirm' ? (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-on-fill text-field-700"><Icon name="check" size={22} stroke={3} /></span>
  ) : variant === 'correct' ? (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-terracotta-600 text-on-fill"><Icon name="x" size={22} stroke={3} /></span>
  ) : icon ? <Icon name={icon} size={variant === 'primary' ? 26 : 24} /> : null;
  const inner = <>{lead}<span>{children}</span></>;
  if (href && !disabled) {
    return <a href={href} className={cls} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{inner}</a>;
  }
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{inner}</button>;
}

/* ------------------------------------------------------------------ Chat */
export function ChatBubble({ from = 'saathi', text, icon = 'help', lang, tone, listen = true, children }) {
  if (from === 'user') {
    return (
      <div className="ss-rise flex justify-end">
        <div className="flex max-w-[85%] items-start gap-2 rounded-lg rounded-br-sm bg-field-100 px-4 py-3 text-body">
          {icon && <Icon name={icon} size={26} className="mt-0.5 text-field-800" />}
          <p lang={lang} className="min-w-0 break-words">{text}</p>
        </div>
      </div>
    );
  }
  const sorry = tone === 'sorry';
  return (
    <div className="ss-rise flex items-end gap-3">
      <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-sunken sm:flex"><SaathiMark size={32} /></div>
      <div className={cx('min-w-0 flex-1 rounded-lg rounded-bl-sm p-4 shadow-card sm:p-5', sorry ? 'bg-turmeric-100' : 'bg-surface-raised')}>
        <div className="flex items-start gap-3">
          <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', sorry ? 'bg-turmeric-400 text-ink' : 'bg-field-100 text-field-800')}>
            <Icon name={sorry ? 'help' : icon} size={26} />
          </span>
          <p lang={lang} className="min-w-0 flex-1 break-words text-transcript">{text}</p>
          {listen && <ListenButton text={text} lang={lang} />}
        </div>
        {children}
      </div>
    </div>
  );
}

export function QuickReplyChip({ label, icon, tone = 'neutral', selected, onClick, lang, disabled }) {
  const disc = selected || tone === 'yes' ? 'bg-field-700 text-on-fill'
    : tone === 'no' ? 'bg-terracotta-600 text-on-fill' : 'bg-surface-sunken text-ink';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        'ss-press inline-flex min-h-[60px] items-center gap-3 rounded-md py-2 pl-2 pr-5 text-label',
        selected ? 'border-[3px] border-field-700 bg-field-100' : 'border-2 border-line-strong bg-surface-raised',
        disabled && 'opacity-60',
      )}
    >
      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', disc)}>
        <Icon name={selected ? 'check' : icon} size={26} />
      </span>
      <span lang={lang} className="text-left">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ Banners */
const BANNERS = {
  'mic-off': { key: 'micOff', icon: 'mic-off', tint: 'bg-terracotta-100', disc: 'bg-terracotta-600 text-on-fill' },
  offline: { key: 'offline', icon: 'wifi-off', tint: 'bg-terracotta-100', disc: 'bg-terracotta-600 text-on-fill' },
  slow: { key: 'slow', icon: 'signal-low', tint: 'bg-turmeric-100', disc: 'bg-turmeric-400 text-ink' },
  busy: { key: 'busy', icon: 'clock', tint: 'bg-turmeric-100', disc: 'bg-turmeric-400 text-ink' },
  partial: { key: 'partial', icon: 'help', tint: 'bg-turmeric-100', disc: 'bg-turmeric-400 text-ink' },
  'too-long': { key: 'tooLong', icon: 'mic', tint: 'bg-turmeric-100', disc: 'bg-turmeric-400 text-ink' },
  error: { key: 'error', icon: 'help', tint: 'bg-terracotta-100', disc: 'bg-terracotta-600 text-on-fill' },
};

export function StatusBanner({ kind, onAction, actionLabel }) {
  const { t, lang } = useI18n();
  const b = BANNERS[kind] || BANNERS.error;
  const title = t[`${b.key}Title`];
  const body = t[`${b.key}Body`];
  const ui = hasUiTranslation(lang) ? lang : 'en';
  return (
    <div role="status" className={cx('rounded-lg border-2 border-line-strong p-4', b.tint)}>
      <div className="flex items-start gap-3">
        <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', b.disc)}><Icon name={b.icon} size={26} /></span>
        <div className="min-w-0 flex-1" lang={ui}>
          <p className="text-label">{title}</p>
          <p className="text-body">{body}</p>
        </div>
        <ListenButton text={`${title}. ${body}`} lang={ui} />
      </div>
      {onAction && (
        <div className="mt-3"><ActionButton variant="secondary" icon="restart" onClick={onAction}>{actionLabel || t.retry}</ActionButton></div>
      )}
    </div>
  );
}

/** A status line for work in progress, never a bare spinner. */
export function BusyNote({ text }) {
  return (
    <div role="status" aria-live="polite" className="ss-pulse flex items-center gap-3 rounded-lg bg-surface-sunken p-4 text-body">
      <Icon name="clock" size={26} />
      <span>{text}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ Badges, discs */
export function MatchBadge({ strength }) {
  const { t } = useI18n();
  const strong = strength === 'strong';
  return (
    <span className={cx('inline-flex min-h-[36px] items-center gap-1 rounded-full border-2 py-0.5 pl-1 pr-3 text-caption font-bold',
      strong ? 'border-field-700 bg-field-100 text-field-700' : 'border-line-strong bg-turmeric-100 text-ink')}>
      <span className={cx('flex h-6 w-6 items-center justify-center rounded-full', strong ? 'bg-field-700 text-on-fill' : 'bg-turmeric-400 text-ink')}>
        <Icon name={strong ? 'check' : 'help'} size={16} stroke={3} />
      </span>
      {strong ? t.matches : t.mayMatch}
    </span>
  );
}

export function CategoryDisc({ category, size = 64 }) {
  const s = CATEGORY_STYLE[category] || CATEGORY_STYLE.general;
  return (
    <span style={{ width: size, height: size }} className={cx('flex shrink-0 items-center justify-center rounded-full', s.disc, s.ink)}>
      <Icon name={s.icon} size={Math.round(size * 0.5)} />
    </span>
  );
}

export function IconDisc({ name, size = 48, className = 'bg-field-100 text-field-800' }) {
  return (
    <span style={{ width: size, height: size }} className={cx('flex shrink-0 items-center justify-center rounded-full', className)}>
      <Icon name={name} size={Math.round(size * 0.55)} />
    </span>
  );
}

/* ------------------------------------------------------------------ TopBar */
export function TopBar({ showRestart, onRestart, onLanguage }) {
  const { t, lang } = useI18n();
  const l = languageOf(lang);
  const btn = 'ss-press inline-flex h-touch items-center gap-2 rounded-md border-2 border-line-strong bg-surface-raised px-3 text-[18px] font-bold';
  return (
    <header className="sticky top-0 z-30 h-[72px] border-b-2 border-line bg-surface">
      <div className="mx-auto flex h-full max-w-column items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <SaathiMark size={40} />
          <span className="ss-wordmark ss-hide-xs truncate text-heading">{t.appName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showRestart && (
            <button type="button" onClick={onRestart} className={btn} aria-label={t.startOver}>
              <Icon name="home" size={24} /><span className="ss-hide-xs">{t.startOver}</span>
            </button>
          )}
          <button type="button" onClick={onLanguage} className={btn} aria-label={t.changeLanguage}>
            <Icon name="globe" size={24} /><span lang={l.code}>{l.script}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ Language tiles */
export function LanguageTile({ language, selected, onSelect }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onSelect(language.code)}
        aria-pressed={selected}
        className={cx(
          'ss-press flex min-h-[116px] w-full flex-col justify-between rounded-md px-4 py-3 text-left',
          selected ? 'border-[3px] border-field-700 bg-field-100' : 'border-2 border-line-strong bg-surface-raised',
        )}
      >
        <span lang={language.code} className="font-script text-script-tile">{language.script}</span>
        <span className="text-caption text-ink-muted">{language.english}</span>
      </button>
      {selected && (
        <span className="absolute -left-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-field-700 text-on-fill" aria-hidden="true">
          <Icon name="check" size={20} stroke={3} />
        </span>
      )}
      <div className="absolute bottom-2 right-2">
        <ListenButton text={language.script} lang={language.code} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Text fallback */
export function TextFallback({ onSend, disabled, lang }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const id = useId();
  const submit = (e) => {
    e.preventDefault();
    const v = value.trim();
    if (!v || disabled) return;
    onSend(v);
    setValue('');
  };
  return (
    <form onSubmit={submit} className="flex w-full items-stretch gap-3">
      <label htmlFor={id} className="sr-only">{t.typeLabel}</label>
      <div className="relative flex-1">
        <Icon name="keyboard" size={26} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          lang={lang}
          enterKeyHint="send"
          autoComplete="off"
          placeholder={t.typeHere}
          className="h-touch-primary w-full rounded-md border-2 border-line-strong bg-surface-raised pl-12 pr-3 text-body placeholder:text-ink-muted"
        />
      </div>
      <ActionButton variant="primary" icon="check" full={false} type="submit" disabled={disabled || !value.trim()}>{t.send}</ActionButton>
    </form>
  );
}

/* ------------------------------------------------------------------ Summary */
export function SummaryCard({ title, reply, facts, lang }) {
  const { t } = useI18n();
  return (
    <section className="rounded-lg border-2 border-line bg-turmeric-100 p-5 shadow-card">
      <div className="flex items-center gap-3">
        <IconDisc name="person" className="bg-turmeric-400 text-ink" />
        <h1 className="min-w-0 flex-1 text-heading">{title}</h1>
        <ListenButton size="lg" tone="warm" text={reply || title} lang={lang} />
      </div>
      {reply && <p lang={lang} className="mt-4 text-body">{reply}</p>}
      <ul className="mt-4 flex flex-col gap-2">
        {facts.map((f, i) => (
          <li key={`${f.label}-${i}`} className="flex items-start gap-3 text-body">
            <span className="mt-[9px] h-3 w-3 shrink-0 rounded-full bg-field-700" aria-hidden="true" />
            <span><span className="text-ink-muted">{t.factLabels[f.label] || f.label}: </span><strong>{f.value}</strong></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ Sheets */
/** Slide-up layer with scrim, focus handling, Escape/scrim close and focus return. */
export function SheetLayer({ onClose, labelledBy, panelClass, initialFocus, children }) {
  const [open, setOpen] = useState(false);
  const closing = useRef(false);
  const panel = useRef(null);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    setTimeout(onClose, reducedMotion() ? 0 : 320);
  };
  useEffect(() => {
    const opener = document.activeElement;
    const raf = requestAnimationFrame(() => {
      setOpen(true);
      (initialFocus?.current || panel.current)?.focus();
    });
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...panel.current.querySelectorAll('a[href],button:not([disabled]),input,[tabindex="0"]')];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div className="ss-sheet-layer fixed inset-0 z-50 flex items-end justify-center sm:items-center" onKeyDown={onKey}>
      <div className={cx('ss-scrim absolute inset-0', open && 'is-open')} onClick={close} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cx('ss-sheet relative flex flex-col bg-surface shadow-sheet outline-none', open && 'is-open', panelClass)}
      >
        {children(close)}
      </div>
    </div>
  );
}

export function LanguageSheet({ current, onPick, onClose, theme, onTheme, tiles: Tile }) {
  const { t } = useI18n();
  const closeBtn = useRef(null);
  return (
    <SheetLayer onClose={onClose} labelledBy="lang-sheet-title" initialFocus={closeBtn}
      panelClass="w-full max-w-column max-h-[92vh] overflow-y-auto rounded-t-lg p-5 sm:rounded-lg">
      {(close) => (
        <>
          <div className="mb-4 flex items-center gap-3">
            <IconDisc name="globe" />
            <h2 id="lang-sheet-title" className="min-w-0 flex-1 text-heading">{t.chooseLanguage}</h2>
            <ListenButton text={t.chooseLanguage} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">{Tile(current, (code) => { onPick(code); close(); })}</div>
          <div className="mt-6 flex flex-col gap-3">
            <ActionButton icon="sun" onClick={onTheme}>{theme === 'sunlight' ? t.dayMode : t.sunMode}</ActionButton>
            <button ref={closeBtn} type="button" onClick={close}
              className="ss-press inline-flex min-h-touch-primary w-full items-center justify-center gap-3 rounded-md border-2 border-line-strong bg-surface-raised px-5 text-label">
              <Icon name="x" size={24} />{t.close}
            </button>
          </div>
        </>
      )}
    </SheetLayer>
  );
}
