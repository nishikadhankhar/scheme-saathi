// Tailwind preset for SchemeSaathi: maps utilities onto the design-system
// tokens (CSS custom properties from tokens.css), with Day values as fallback.
const v = (name, fallback) => `var(--${name}, ${fallback})`;

export default {
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: v('surface', '#fbf6ec'), raised: v('surface-raised', '#fffdf8'), sunken: v('surface-sunken', '#f3eada') },
        ink: { DEFAULT: v('ink', '#231a12'), muted: v('ink-muted', '#594838') },
        'on-fill': v('on-fill', '#ffffff'),
        field: { 800: v('field-800', '#1f4d29'), 700: v('field-700', '#2f6b3a'), 500: v('field-500', '#5d9a4f'), 100: v('field-100', '#e3efd9') },
        turmeric: { 400: v('turmeric-400', '#f2b33d'), 100: v('turmeric-100', '#fcefcf') },
        terracotta: { 600: v('terracotta-600', '#a3462a'), 100: v('terracotta-100', '#f7e0d5') },
        sky: { 100: v('sky-100', '#dcebf5') },
        line: { DEFAULT: v('line', '#e2d4bd'), strong: v('line-strong', '#8a765d') },
        focus: v('focus', '#0b5cad')
      },
      fontFamily: {
        sans: ['var(--font-sans, "Mukta", "Noto Sans", "Noto Sans Devanagari", system-ui, sans-serif)'],
        script: ['var(--font-script, "Noto Sans", "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Gurmukhi", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Gujarati", sans-serif)']
      },
      fontSize: {
        display: ['40px', { lineHeight: '46px', fontWeight: '700' }],
        title: ['30px', { lineHeight: '38px', fontWeight: '700' }],
        heading: ['24px', { lineHeight: '32px', fontWeight: '700' }],
        transcript: ['24px', { lineHeight: '34px', fontWeight: '500' }],
        body: ['20px', { lineHeight: '30px' }],
        label: ['20px', { lineHeight: '26px', fontWeight: '700' }],
        caption: ['18px', { lineHeight: '26px', fontWeight: '500' }],
        'script-tile': ['30px', { lineHeight: '40px', fontWeight: '600' }]
      },
      borderRadius: {
        sm: v('radius-sm', '12px'),
        md: v('radius-md', '18px'),
        lg: v('radius-lg', '28px'),
        full: v('radius-full', '999px')
      },
      boxShadow: {
        card: v('shadow-card', '0 2px 0 #e2d4bd, 0 8px 24px rgba(74,52,28,.10)'),
        sheet: v('shadow-sheet', '0 -12px 40px rgba(35,26,18,.22)')
      },
      spacing: {
        mic: v('mic', '120px'),
        touch: v('touch-min', '48px'),
        'touch-primary': v('touch-primary', '64px')
      },
      minHeight: { touch: v('touch-min', '48px'), 'touch-primary': v('touch-primary', '64px') },
      height: { touch: v('touch-min', '48px'), 'touch-primary': v('touch-primary', '64px'), mic: v('mic', '120px') },
      width: { mic: v('mic', '120px') },
      maxWidth: { column: v('column', '560px') }
    }
  }
};
