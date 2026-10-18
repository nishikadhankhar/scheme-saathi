// Tap-to-answer chips, chosen by the field the backend says it is asking about
// (ChatResponse.asking_about). Tapping a chip sends `send` as the person's message.
//
// The backend picks the reply language from the SCRIPT of the message, and keeps the current
// language only for short Latin messages (3 words or fewer). So for languages we have no
// translation for, `send.other` is always a short English phrase.
const chip = (id, icon, tone, label, send) => ({ id, icon, tone, label, send });

export const CHIPS = {
  gender: [
    chip('male', 'person', 'neutral', { en: 'Male', hi: 'पुरुष' }, { en: 'Male', hi: 'पुरुष', other: 'Male' }),
    chip('female', 'person', 'neutral', { en: 'Female', hi: 'महिला' }, { en: 'Female', hi: 'महिला', other: 'Female' }),
    chip('trans', 'person', 'neutral', { en: 'Transgender', hi: 'ट्रांसजेंडर' }, { en: 'Transgender', hi: 'ट्रांसजेंडर', other: 'Transgender' }),
  ],
  residence: [
    chip('rural', 'home', 'neutral', { en: 'Village', hi: 'गाँव' }, { en: 'Village', hi: 'गाँव', other: 'Village' }),
    chip('urban', 'office', 'neutral', { en: 'Town or city', hi: 'शहर' }, { en: 'Town or city', hi: 'शहर', other: 'Town or city' }),
  ],
  occupation: [
    chip('farmer', 'farming', 'neutral', { en: 'Farmer', hi: 'किसान' }, { en: 'Farmer', hi: 'किसान', other: 'Farmer' }),
    chip('labour', 'person', 'neutral', { en: 'Daily wage worker', hi: 'मज़दूर' }, { en: 'Daily wage worker', hi: 'मज़दूर', other: 'Daily wage worker' }),
    chip('homemaker', 'home', 'neutral', { en: 'Homemaker', hi: 'गृहिणी' }, { en: 'Homemaker', hi: 'गृहिणी', other: 'Homemaker' }),
  ],
  caste: [
    chip('gen', 'person', 'neutral', { en: 'General', hi: 'सामान्य' }, { en: 'General', hi: 'सामान्य', other: 'General' }),
    chip('obc', 'person', 'neutral', { en: 'OBC', hi: 'ओबीसी' }, { en: 'OBC', hi: 'ओबीसी', other: 'OBC' }),
    chip('sc', 'person', 'neutral', { en: 'SC', hi: 'एससी' }, { en: 'SC', hi: 'एससी', other: 'SC' }),
    chip('st', 'person', 'neutral', { en: 'ST', hi: 'एसटी' }, { en: 'ST', hi: 'एसटी', other: 'ST' }),
    chip('skip', 'arrow-left', 'neutral', { en: 'Skip', hi: 'छोड़िए' }, { en: 'I would rather not say', hi: 'मैं बताना नहीं चाहता', other: 'Skip' }),
  ],
  is_bpl: [
    chip('yes', 'check', 'yes', { en: 'Yes', hi: 'हाँ' }, { en: 'Yes', hi: 'हाँ', other: 'Yes' }),
    chip('no', 'x', 'no', { en: 'No', hi: 'नहीं' }, { en: 'No', hi: 'नहीं', other: 'No' }),
    chip('dk', 'help', 'neutral', { en: "Don't know", hi: 'पता नहीं' }, { en: "I don't know", hi: 'पता नहीं', other: "Don't know" }),
  ],
  land_acres: [
    chip('lt2', 'land-record', 'neutral', { en: 'Less than 2 acres', hi: '2 एकड़ से कम' }, { en: 'Less than 2 acres', hi: '2 एकड़ से कम', other: 'Under 2 acres' }),
    chip('2to5', 'land-record', 'neutral', { en: '2 to 5 acres', hi: '2 से 5 एकड़' }, { en: '2 to 5 acres', hi: '2 से 5 एकड़', other: '2-5 acres' }),
    chip('gt5', 'land-record', 'neutral', { en: 'More than 5 acres', hi: '5 एकड़ से ज़्यादा' }, { en: 'More than 5 acres', hi: '5 एकड़ से ज़्यादा', other: 'Over 5 acres' }),
    chip('none', 'x', 'no', { en: 'No land of my own', hi: 'अपनी ज़मीन नहीं' }, { en: 'I have no land', hi: 'मेरे पास ज़मीन नहीं है', other: 'No land' }),
  ],
  family_members: [
    chip('alone', 'person', 'neutral', { en: 'Just me', hi: 'सिर्फ़ मैं' }, { en: 'Just me', hi: 'सिर्फ़ मैं', other: 'Just me' }),
    chip('skip', 'arrow-left', 'neutral', { en: 'Skip', hi: 'छोड़िए' }, { en: 'Skip this question', hi: 'यह सवाल छोड़िए', other: 'Skip' }),
  ],
};

export const chipsFor = (field) => CHIPS[field] || [];
export const chipLabel = (c, lang) => c.label[lang] || c.label.en;
export const chipSend = (c, lang) => c.send[lang] || c.send.other || c.send.en;

// Topic starters for the welcome screen when the mic is blocked (see MicBlocked in the spec).
export const TOPICS = [
  { id: 'farming', icon: 'farming', key: 'topicFarming', send: { en: 'I am a farmer and I need help with farming', hi: 'मैं किसान हूँ, मुझे खेती में मदद चाहिए', other: 'Farming' } },
  { id: 'health', icon: 'health', key: 'topicHealth', send: { en: 'I need help with health and hospital costs', hi: 'मुझे सेहत और अस्पताल के खर्च में मदद चाहिए', other: 'Health' } },
  { id: 'house', icon: 'housing', key: 'topicHouse', send: { en: 'I need help to build a house', hi: 'मुझे घर बनाने में मदद चाहिए', other: 'House' } },
  { id: 'loan', icon: 'loans', key: 'topicLoan', send: { en: 'I need a loan or money help', hi: 'मुझे कर्ज़ या पैसे की मदद चाहिए', other: 'Loan' } },
  { id: 'pension', icon: 'pension', key: 'topicPension', send: { en: 'I need an old-age pension', hi: 'मुझे बुढ़ापा पेंशन चाहिए', other: 'Pension' } },
];
export const topicSend = (topic, lang) => topic.send[lang] || topic.send.other;
