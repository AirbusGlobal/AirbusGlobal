export interface StayTranslationPayload {
  title: string;
  location: string;
  type: string;
  description: string;
  hostMessage: string;
  welcomeGifts: string[];
  features: string[];
  highlights: string[];
  bookingHoursText: string;
  directSettlementText: string;
  priceText: string;
  instantBookLabel: string;
}

export interface TranslationOutcome {
  language: string;
  engine: 'offline-dictionary' | 'free-open-translator' | 'hybrid-free';
  translated: StayTranslationPayload;
}

interface LanguageMeta {
  canonical: string;
  isoCode: string | null; // null for regional languages handled by local dictionary
  dictKey: LocalDictLang | null;
}

type LocalDictLang =
  | 'sw'
  | 'fr'
  | 'es'
  | 'ar'
  | 'zh'
  | 'de'
  | 'pt'
  | 'it'
  | 'ja'
  | 'hi'
  | 'so'
  | 'ki'
  | 'luo';

const LANGUAGE_ALIASES: Record<string, LanguageMeta> = {
  // Swahili
  swahili: { canonical: 'Swahili', isoCode: 'sw', dictKey: 'sw' },
  kiswahili: { canonical: 'Swahili', isoCode: 'sw', dictKey: 'sw' },
  sw: { canonical: 'Swahili', isoCode: 'sw', dictKey: 'sw' },

  // French
  french: { canonical: 'French', isoCode: 'fr', dictKey: 'fr' },
  français: { canonical: 'French', isoCode: 'fr', dictKey: 'fr' },
  francais: { canonical: 'French', isoCode: 'fr', dictKey: 'fr' },
  fr: { canonical: 'French', isoCode: 'fr', dictKey: 'fr' },

  // Spanish
  spanish: { canonical: 'Spanish', isoCode: 'es', dictKey: 'es' },
  español: { canonical: 'Spanish', isoCode: 'es', dictKey: 'es' },
  espanol: { canonical: 'Spanish', isoCode: 'es', dictKey: 'es' },
  es: { canonical: 'Spanish', isoCode: 'es', dictKey: 'es' },

  // Arabic
  arabic: { canonical: 'Arabic', isoCode: 'ar', dictKey: 'ar' },
  العربية: { canonical: 'Arabic', isoCode: 'ar', dictKey: 'ar' },
  ar: { canonical: 'Arabic', isoCode: 'ar', dictKey: 'ar' },

  // Chinese
  chinese: { canonical: 'Chinese', isoCode: 'zh-CN', dictKey: 'zh' },
  mandarin: { canonical: 'Chinese', isoCode: 'zh-CN', dictKey: 'zh' },
  中文: { canonical: 'Chinese', isoCode: 'zh-CN', dictKey: 'zh' },
  zh: { canonical: 'Chinese', isoCode: 'zh-CN', dictKey: 'zh' },
  'zh-cn': { canonical: 'Chinese', isoCode: 'zh-CN', dictKey: 'zh' },
  'zh-hans': { canonical: 'Chinese', isoCode: 'zh-CN', dictKey: 'zh' },

  // German
  german: { canonical: 'German', isoCode: 'de', dictKey: 'de' },
  deutsch: { canonical: 'German', isoCode: 'de', dictKey: 'de' },
  de: { canonical: 'German', isoCode: 'de', dictKey: 'de' },

  // Portuguese
  portuguese: { canonical: 'Portuguese', isoCode: 'pt', dictKey: 'pt' },
  português: { canonical: 'Portuguese', isoCode: 'pt', dictKey: 'pt' },
  portugues: { canonical: 'Portuguese', isoCode: 'pt', dictKey: 'pt' },
  pt: { canonical: 'Portuguese', isoCode: 'pt', dictKey: 'pt' },

  // Italian
  italian: { canonical: 'Italian', isoCode: 'it', dictKey: 'it' },
  italiano: { canonical: 'Italian', isoCode: 'it', dictKey: 'it' },
  it: { canonical: 'Italian', isoCode: 'it', dictKey: 'it' },

  // Japanese
  japanese: { canonical: 'Japanese', isoCode: 'ja', dictKey: 'ja' },
  日本語: { canonical: 'Japanese', isoCode: 'ja', dictKey: 'ja' },
  ja: { canonical: 'Japanese', isoCode: 'ja', dictKey: 'ja' },
  jp: { canonical: 'Japanese', isoCode: 'ja', dictKey: 'ja' },

  // Hindi
  hindi: { canonical: 'Hindi', isoCode: 'hi', dictKey: 'hi' },
  हिन्दी: { canonical: 'Hindi', isoCode: 'hi', dictKey: 'hi' },
  hi: { canonical: 'Hindi', isoCode: 'hi', dictKey: 'hi' },

  // Somali
  somali: { canonical: 'Somali', isoCode: 'so', dictKey: 'so' },
  'af-soomaali': { canonical: 'Somali', isoCode: 'so', dictKey: 'so' },
  soomaali: { canonical: 'Somali', isoCode: 'so', dictKey: 'so' },
  so: { canonical: 'Somali', isoCode: 'so', dictKey: 'so' },

  // Kenyan Regional Languages (built-in local dictionaries, zero API needed)
  kikuyu: { canonical: 'Kikuyu', isoCode: null, dictKey: 'ki' },
  gikuyu: { canonical: 'Kikuyu', isoCode: null, dictKey: 'ki' },
  gĩkũyũ: { canonical: 'Kikuyu', isoCode: null, dictKey: 'ki' },
  ki: { canonical: 'Kikuyu', isoCode: null, dictKey: 'ki' },

  dholuo: { canonical: 'Dholuo', isoCode: null, dictKey: 'luo' },
  luo: { canonical: 'Dholuo', isoCode: null, dictKey: 'luo' },

  // Additional Global Languages supported via keyless open translator
  korean: { canonical: 'Korean', isoCode: 'ko', dictKey: null },
  한국어: { canonical: 'Korean', isoCode: 'ko', dictKey: null },
  ko: { canonical: 'Korean', isoCode: 'ko', dictKey: null },

  russian: { canonical: 'Russian', isoCode: 'ru', dictKey: null },
  русский: { canonical: 'Russian', isoCode: 'ru', dictKey: null },
  ru: { canonical: 'Russian', isoCode: 'ru', dictKey: null },

  turkish: { canonical: 'Turkish', isoCode: 'tr', dictKey: null },
  türkçe: { canonical: 'Turkish', isoCode: 'tr', dictKey: null },
  tr: { canonical: 'Turkish', isoCode: 'tr', dictKey: null },

  dutch: { canonical: 'Dutch', isoCode: 'nl', dictKey: null },
  nederlands: { canonical: 'Dutch', isoCode: 'nl', dictKey: null },
  nl: { canonical: 'Dutch', isoCode: 'nl', dictKey: null },

  amharic: { canonical: 'Amharic', isoCode: 'am', dictKey: null },
  am: { canonical: 'Amharic', isoCode: 'am', dictKey: null },

  polish: { canonical: 'Polish', isoCode: 'pl', dictKey: null },
  polski: { canonical: 'Polish', isoCode: 'pl', dictKey: null },
  pl: { canonical: 'Polish', isoCode: 'pl', dictKey: null },

  swedish: { canonical: 'Swedish', isoCode: 'sv', dictKey: null },
  svenska: { canonical: 'Swedish', isoCode: 'sv', dictKey: null },
  sv: { canonical: 'Swedish', isoCode: 'sv', dictKey: null },

  thai: { canonical: 'Thai', isoCode: 'th', dictKey: null },
  th: { canonical: 'Thai', isoCode: 'th', dictKey: null },

  vietnamese: { canonical: 'Vietnamese', isoCode: 'vi', dictKey: null },
  vi: { canonical: 'Vietnamese', isoCode: 'vi', dictKey: null },

  indonesian: { canonical: 'Indonesian', isoCode: 'id', dictKey: null },
  id: { canonical: 'Indonesian', isoCode: 'id', dictKey: null },

  malay: { canonical: 'Malay', isoCode: 'ms', dictKey: null },
  ms: { canonical: 'Malay', isoCode: 'ms', dictKey: null },

  greek: { canonical: 'Greek', isoCode: 'el', dictKey: null },
  el: { canonical: 'Greek', isoCode: 'el', dictKey: null },

  hebrew: { canonical: 'Hebrew', isoCode: 'iw', dictKey: null },
  he: { canonical: 'Hebrew', isoCode: 'iw', dictKey: null },

  norwegian: { canonical: 'Norwegian', isoCode: 'no', dictKey: null },
  no: { canonical: 'Norwegian', isoCode: 'no', dictKey: null },

  danish: { canonical: 'Danish', isoCode: 'da', dictKey: null },
  da: { canonical: 'Danish', isoCode: 'da', dictKey: null },

  finnish: { canonical: 'Finnish', isoCode: 'fi', dictKey: null },
  fi: { canonical: 'Finnish', isoCode: 'fi', dictKey: null },

  ukrainian: { canonical: 'Ukrainian', isoCode: 'uk', dictKey: null },
  uk: { canonical: 'Ukrainian', isoCode: 'uk', dictKey: null },

  czech: { canonical: 'Czech', isoCode: 'cs', dictKey: null },
  cs: { canonical: 'Czech', isoCode: 'cs', dictKey: null },

  romanian: { canonical: 'Romanian', isoCode: 'ro', dictKey: null },
  ro: { canonical: 'Romanian', isoCode: 'ro', dictKey: null },

  zulu: { canonical: 'Zulu', isoCode: 'zu', dictKey: null },
  zu: { canonical: 'Zulu', isoCode: 'zu', dictKey: null },

  yoruba: { canonical: 'Yoruba', isoCode: 'yo', dictKey: null },
  yo: { canonical: 'Yoruba', isoCode: 'yo', dictKey: null },

  igbo: { canonical: 'Igbo', isoCode: 'ig', dictKey: null },
  ig: { canonical: 'Igbo', isoCode: 'ig', dictKey: null },

  hausa: { canonical: 'Hausa', isoCode: 'ha', dictKey: null },
  ha: { canonical: 'Hausa', isoCode: 'ha', dictKey: null },

  kinyarwanda: { canonical: 'Kinyarwanda', isoCode: 'rw', dictKey: null },
  rw: { canonical: 'Kinyarwanda', isoCode: 'rw', dictKey: null },

  luganda: { canonical: 'Luganda', isoCode: 'lg', dictKey: null },
  lg: { canonical: 'Luganda', isoCode: 'lg', dictKey: null },
};

export function isEnglishLanguage(raw: string): boolean {
  const lower = String(raw || '').trim().toLowerCase();
  return lower === 'english' || lower === 'en' || lower === 'en-us' || lower === 'en-gb';
}

export function resolveLanguageMeta(raw: string): LanguageMeta {
  const trimmed = String(raw || '').trim();
  const lower = trimmed.toLowerCase();
  const matched = LANGUAGE_ALIASES[lower];
  if (matched) return matched;

  // Fallback: preserve user's label and allow ISO code if they entered a 2-letter code
  const isoCandidate = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(trimmed) ? lower : null;
  const titled = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return {
    canonical: titled,
    isoCode: isoCandidate,
    dictKey: null,
  };
}

// ============================================================================
// BUILT-IN ZERO-API MULTI-LANGUAGE HOSPITALITY DICTIONARY
// ============================================================================

type LangEntryMap = Record<LocalDictLang, string>;

const EXACT_PHRASES: Record<string, Partial<LangEntryMap>> = {
  'instant confirmation': {
    sw: 'Uthibitisho wa Papo Hapo',
    fr: 'Confirmation immédiate',
    es: 'Confirmación inmediata',
    ar: 'تأكيد فوري',
    zh: '即时确认',
    de: 'Sofortige Bestätigung',
    pt: 'Confirmação imediata',
    it: 'Conferma immediata',
    ja: '即時予約確定',
    hi: 'तुरंत पुष्टि',
    so: 'Xaqiijin Degdeg ah',
    ki: 'Wĩtĩkĩrio wa O Rĩo',
    luo: 'Yie Mapiyo',
  },
  'host approval': {
    sw: 'Idhini ya mwenyeji',
    fr: 'Approbation de l’hôte',
    es: 'Aprobación del anfitrión',
    ar: 'موافقة المضيف',
    zh: '房东确认',
    de: 'Bestätigung durch Gastgeber',
    pt: 'Aprovação do anfitrião',
    it: 'Approvazione dell’host',
    ja: 'ホストの承認が必要',
    hi: 'मेज़बान की मंज़ूरी',
    so: 'Ogolaanshaha martigeliyaha',
    ki: 'Rũtha rwa mwene nyũmba',
    luo: 'Yie mar wuon ot',
  },
  'free cancellation before check-in. guests pay hosts directly after property tour and key handover.': {
    sw: 'Kughairi bila malipo kabla ya kuingia. Wageni huwalipa wenyeji moja kwa moja baada ya kutembelea nyumba na kukabidhiwa funguo.',
    fr: 'Annulation gratuite avant l’arrivée. Les voyageurs paient l’hôte directement après la visite du logement et la remise des clés.',
    es: 'Cancelación gratuita antes del check-in. Los huéspedes pagan directamente al anfitrión tras visitar la propiedad y recibir las llaves.',
    ar: 'إلغاء مجاني قبل تسجيل الوصول. يدفع الضيوف للمضيفين مباشرة بعد جولة العقار وتسليم المفاتيح.',
    zh: '入住前免费取消。客人在参观房产并交接钥匙后直接向房东付款。',
    de: 'Kostenlose Stornierung vor dem Check-in. Gäste zahlen nach der Besichtigung und Schlüsselübergabe direkt an den Gastgeber.',
    pt: 'Cancelamento gratuito antes do check-in. Os hóspedes pagam diretamente ao anfitrião após a visita ao imóvel e entrega das chaves.',
    it: 'Cancellazione gratuita prima del check-in. Gli ospiti pagano direttamente l’host dopo la visita dell’alloggio e la consegna delle chiavi.',
    ja: 'チェックイン前のキャンセルは無料です。物件の見学と鍵の受け渡し後、ホストへ直接お支払いください。',
    hi: 'चेक-इन से पहले मुफ़्त रद्दीकरण। मेहमान प्रॉपर्टी देखने और चाबी मिलने के बाद सीधे मेज़बान को भुगतान करते हैं।',
    so: 'Joojin bilaash ah ka hor imaanshaha. Martidu waxay si toos ah u siiyaan martigeliyaha ka dib booqashada guriga iyo wareejinta furaha.',
    ki: 'Kũrũgamia hatarĩ marĩhi mbere ya kũingĩra. Agendi marĩhaga mwene nyũmba thutha wa kuona nyũmba na kũheo cabi.',
    luo: 'Wech nono ka pok idonjo. Welogi chulo wuon ot achiel kachiel bang’ nono ot kod miyogi ofungu.',
  },
  'check-in after 14:00, checkout before 10:00. no unauthorized parties. respect neighborhood quiet hours.': {
    sw: 'Kuingia baada ya 14:00, kutoka kabla ya 10:00. Hakuna sherehe zisizoidhinishwa. Heshimu saa za utulivu za mtaa.',
    fr: 'Arrivée après 14:00, départ avant 10:00. Aucune fête non autorisée. Respectez les heures calmes du voisinage.',
    es: 'Entrada después de las 14:00, salida antes de las 10:00. No se permiten fiestas sin autorización. Respeta las horas de silencio.',
    ar: 'تسجيل الوصول بعد 14:00، والمغادرة قبل 10:00. ممنوع إقامة الحفلات غير المصرح بها. يُرجى احترام ساعات الهدوء.',
    zh: '14:00后入住，10:00前退房。禁止未经授权的派对。请尊重社区安静时间。',
    de: 'Check-in ab 14:00, Check-out vor 10:00. Keine ungenehmigten Partys. Bitte Ruhezeiten der Nachbarschaft beachten.',
    pt: 'Check-in após 14:00, check-out antes de 10:00. Proibidas festas não autorizadas. Respeite o horário de silêncio.',
    it: 'Check-in dopo le 14:00, check-out entro le 10:00. Vietate feste non autorizzate. Rispettare gli orari di quiete.',
    ja: 'チェックイン14:00以降、チェックアウト10:00まで。無断パーティー禁止。近隣の静粛時間をお守りください。',
    hi: '14:00 के बाद चेक-इन, 10:00 से पहले चेक-आउट। बिना अनुमति पार्टी की मनाही है। पड़ोस की शांति का सम्मान करें।',
    so: 'Galitaanka 14:00 ka dib, bixitaanka 10:00 ka hor. Xaflado aan la oggolaan lama oggola. Xushmee saacadaha degganaanshaha.',
    ki: 'Kũingĩra thutha wa 14:00, kuuma mbere ya 10:00. Gũtirĩ ciathĩ itarĩ na rũtha. Tĩĩa mathaa ma kũhoorera.',
    luo: 'Donjo bang’ 14:00, wuok kapok 10:00. Nyasino ma ok oyie ok oyiego. Luor seche mag kue e gweng’. ',
  },
  // Property types
  villa: {
    sw: 'Jumba la Kifahari (Villa)',
    fr: 'Villa',
    es: 'Villa',
    ar: 'فيلا',
    zh: '别墅',
    de: 'Villa',
    pt: 'Vila',
    it: 'Villa',
    ja: 'ヴィラ',
    hi: 'विला',
    so: 'Fillo',
    ki: 'Nyũmba Nene ya Gĩkeno',
    luo: 'Ot Maduong’ mar Yueyo',
  },
  apartment: {
    sw: 'Fleti',
    fr: 'Appartement',
    es: 'Apartamento',
    ar: 'شقة',
    zh: '公寓',
    de: 'Apartment',
    pt: 'Apartamento',
    it: 'Appartamento',
    ja: 'アパートメント',
    hi: 'अपार्टमेंट',
    so: 'Guri Dabaq ah',
    ki: 'Nyũmba ya Gorofa',
    luo: 'Ot ma e Gorofa',
  },
  penthouse: {
    sw: 'Fleti ya Juu (Penthouse)',
    fr: 'Penthouse',
    es: 'Ático de lujo',
    ar: 'بنتهاوس',
    zh: '顶层豪华公寓',
    de: 'Penthouse',
    pt: 'Cobertura',
    it: 'Attico',
    ja: 'ペントハウス',
    hi: 'पेंटहाउस',
    so: 'Guri Dabaqa Sare',
    ki: 'Nyũmba ya Igũrũ Mũno',
    luo: 'Ot ma Malo Moloyo',
  },
  studio: {
    sw: 'Studio',
    fr: 'Studio',
    es: 'Estudio',
    ar: 'استوديو',
    zh: '单间公寓',
    de: 'Studio',
    pt: 'Estúdio',
    it: 'Monolocale',
    ja: 'スタジオ',
    hi: 'स्टूडियो',
    so: 'Istuudiyo',
    ki: 'Nyũmba ya Kĩmwe',
    luo: 'Ot Achiel',
  },
  loft: {
    sw: 'Lofti ya Kisasa',
    fr: 'Loft',
    es: 'Loft',
    ar: 'لوفت',
    zh: '阁楼公寓',
    de: 'Loft',
    pt: 'Loft',
    it: 'Loft',
    ja: 'ロフト',
    hi: 'लॉफ्ट',
    so: 'Loft',
    ki: 'Nyũmba ya Igũrũ',
    luo: 'Ot ma Malo',
  },
  cabin: {
    sw: 'Nyumba ya Mbao (Cabin)',
    fr: 'Chalet en bois',
    es: 'Cabaña',
    ar: 'كوخ خشبي',
    zh: '木屋',
    de: 'Holzhütte',
    pt: 'Cabana',
    it: 'Baita',
    ja: 'キャビン',
    hi: 'केबिन',
    so: 'Buul Qoryo ah',
    ki: 'Nyũmba ya Mũtitũ',
    luo: 'Ot mar Yien',
  },
  cottage: {
    sw: 'Nyumba Ndogo ya Bustani',
    fr: 'Cottage',
    es: 'Casa de campo',
    ar: 'كوخ ريفي',
    zh: '乡村小屋',
    de: 'Landhaus',
    pt: 'Chalé',
    it: 'Cottage',
    ja: 'コテージ',
    hi: 'कॉटेज',
    so: 'Guri Yar oo Beer leh',
    ki: 'Nyũmba ya Mũgũnda',
    luo: 'Ot Matin mar Puodho',
  },
  townhouse: {
    sw: 'Nyumba ya Mjini',
    fr: 'Maison de ville',
    es: 'Casa adosada',
    ar: 'تاون هاوس',
    zh: '联排别墅',
    de: 'Reihenhaus',
    pt: 'Casa geminada',
    it: 'Villetta a schiera',
    ja: 'タウンハウス',
    hi: 'टाउनहाउस',
    so: 'Guri Magaalo',
    ki: 'Nyũmba ya Taũni',
    luo: 'Ot mar Taon',
  },
  suite: {
    sw: 'Chumba cha Kifahari',
    fr: 'Suite',
    es: 'Suite',
    ar: 'جناح فندقي',
    zh: '套房',
    de: 'Suite',
    pt: 'Suíte',
    it: 'Suite',
    ja: 'スイート',
    hi: 'सुइट',
    so: 'Qol Raaxo leh',
    ki: 'Kanyũmba ka Gĩtĩo',
    luo: 'Ot Maber',
  },
  resort: {
    sw: 'Hoteli ya Mapumziko',
    fr: 'Complexe hôtelier',
    es: 'Resort',
    ar: 'منتجع',
    zh: '度假村',
    de: 'Resort',
    pt: 'Resort',
    it: 'Resort',
    ja: 'リゾート',
    hi: 'रिसॉर्ट',
    so: 'Goob Dalxiis',
    ki: 'Kĩbanda kĩa Kũhurũka',
    luo: 'Kar Yueyo',
  },
  // Amenities & Features
  'high-speed wifi': {
    sw: 'WiFi ya Kasi ya Juu',
    fr: 'Wi-Fi haut débit',
    es: 'Wi-Fi de alta velocidad',
    ar: 'واي فاي فائق السرعة',
    zh: '高速无线网络',
    de: 'Highspeed-WLAN',
    pt: 'Wi-Fi de alta velocidade',
    it: 'Wi-Fi ad alta velocità',
    ja: '高速Wi-Fi',
    hi: 'हाई-स्पीड वाई-फ़ाई',
    so: 'WiFi Xawaare Sare ah',
    ki: 'WiFi ya Ihenya',
    luo: 'WiFi ma Mapiyo',
  },
  'fiber internet': {
    sw: 'Intaneti ya Fiber',
    fr: 'Internet fibre optique',
    es: 'Internet de fibra óptica',
    ar: 'إنترنت فايبر سريع',
    zh: '光纤网络',
    de: 'Glasfaser-Internet',
    pt: 'Internet fibra óptica',
    it: 'Internet in fibra ottica',
    ja: '光ファイバーネット',
    hi: 'फाइबर इंटरनेट',
    so: 'Internet Fiber ah',
    ki: 'Intaneti ya Fiber',
    luo: 'Intanet mar Fiber',
  },
  wifi: {
    sw: 'WiFi ya Bure',
    fr: 'Wi-Fi',
    es: 'Wi-Fi',
    ar: 'واي فاي',
    zh: '无线网络',
    de: 'WLAN',
    pt: 'Wi-Fi',
    it: 'Wi-Fi',
    ja: 'Wi-Fi',
    hi: 'वाई-फ़ाई',
    so: 'WiFi',
    ki: 'WiFi',
    luo: 'WiFi',
  },
  'swimming pool': {
    sw: 'Bwawa la Kuogelea',
    fr: 'Piscine',
    es: 'Piscina',
    ar: 'حمام سباحة',
    zh: '游泳池',
    de: 'Schwimmbad',
    pt: 'Piscina',
    it: 'Piscina',
    ja: 'スイミングプール',
    hi: 'स्विमिंग पूल',
    so: 'Barkadda Dabaasha',
    ki: 'Kĩhĩĩndĩ gĩa Kũthambĩra',
    luo: 'Kar Goyo Abal',
  },
  pool: {
    sw: 'Bwawa la Kuogelea',
    fr: 'Piscine',
    es: 'Piscina',
    ar: 'مسبح',
    zh: '泳池',
    de: 'Pool',
    pt: 'Piscina',
    it: 'Piscina',
    ja: 'プール',
    hi: 'पूल',
    so: 'Barkad Dabaal',
    ki: 'Kĩhĩĩndĩ gĩa Kũthambĩra',
    luo: 'Kar Abal',
  },
  'infinity pool': {
    sw: 'Bwawa la Kuogelea la Kifahari',
    fr: 'Piscine à débordement',
    es: 'Piscina infinita',
    ar: 'مسبح إنفينيتي',
    zh: '无边泳池',
    de: 'Infinity-Pool',
    pt: 'Piscina de borda infinita',
    it: 'Piscina a sfioro',
    ja: 'インフィニティプール',
    hi: 'इन्फिनिटी पूल',
    so: 'Barkad Dabaal oo Casri ah',
    ki: 'Kĩhĩĩndĩ kĩa Rũgongo',
    luo: 'Kar Abal Malach',
  },
  'air conditioning': {
    sw: 'Kiyoyozi (AC)',
    fr: 'Climatisation',
    es: 'Aire acondicionado',
    ar: 'تكييف هواء',
    zh: '空调',
    de: 'Klimaanlage',
    pt: 'Ar-condicionado',
    it: 'Aria condizionata',
    ja: 'エアコン',
    hi: 'एयर कंडीशनिंग',
    so: 'Qaboojiye (AC)',
    ki: 'Kĩhoreria Rĩera',
    luo: 'Gima Kweyo Yamo',
  },
  'free parking': {
    sw: 'Maegesho ya Bure',
    fr: 'Parking gratuit',
    es: 'Estacionamiento gratuito',
    ar: 'موقف سيارات مجاني',
    zh: '免费停车',
    de: 'Kostenlose Parkplätze',
    pt: 'Estacionamento gratuito',
    it: 'Parcheggio gratuito',
    ja: '無料駐車場',
    hi: 'मुफ़्त पार्किंग',
    so: 'Baarkin Bilaash ah',
    ki: 'Handũ ha Kũrũgamia Ngari Hatari Marĩhi',
    luo: 'Kar Chungo Mtoka Nono',
  },
  'private parking': {
    sw: 'Maegesho ya Kibinafsi',
    fr: 'Parking privé',
    es: 'Estacionamiento privado',
    ar: 'موقف سيارات خاص',
    zh: '私人停车位',
    de: 'Privater Parkplatz',
    pt: 'Estacionamento privado',
    it: 'Parcheggio privato',
    ja: '専用駐車場',
    hi: 'निजी पार्किंग',
    so: 'Baarkin Gaar ah',
    ki: 'Handũ ha Kũrũgamia Ngari',
    luo: 'Kar Chungo Mtoka',
  },
  '24/7 security': {
    sw: 'Ulinzi Saa 24/7',
    fr: 'Sécurité 24h/24 et 7j/7',
    es: 'Seguridad 24/7',
    ar: 'حراسة أمنية 24/7',
    zh: '24/7全天候安保',
    de: '24/7-Sicherheitsdienst',
    pt: 'Segurança 24h',
    it: 'Sicurezza 24/7',
    ja: '24時間セキュリティ',
    hi: '24/7 सुरक्षा',
    so: 'Ammaan 24/7 ah',
    ki: 'Ũgitĩri Mathaa 24/7',
    luo: 'Rito mar 24/7',
  },
  'full kitchen': {
    sw: 'Jiko Kamili',
    fr: 'Cuisine équipée',
    es: 'Cocina completa',
    ar: 'مطبخ متكامل',
    zh: '设施齐全的厨房',
    de: 'Voll ausgestattete Küche',
    pt: 'Cozinha completa',
    it: 'Cucina attrezzata',
    ja: 'フルキッチン',
    hi: 'पूरी तरह सुसज्जित रसोई',
    so: 'Jiko Dhammaystiran',
    ki: 'Rĩko Rĩkinyanĩru',
    luo: 'Jikon Ma Riwore',
  },
  'chef kitchen': {
    sw: 'Jiko la Mpishi Mtaalamu',
    fr: 'Cuisine de chef',
    es: 'Cocina de chef',
    ar: 'مطبخ شيف احترافي',
    zh: '专业厨师厨房',
    de: 'Profiküche',
    pt: 'Cozinha gourmet',
    it: 'Cucina da chef',
    ja: 'シェフズキッチン',
    hi: 'शेफ किचन',
    so: 'Jiko Casri ah',
    ki: 'Rĩko Rĩega Mũno',
    luo: 'Jikon Maber Moloyo',
  },
  kitchen: {
    sw: 'Jiko',
    fr: 'Cuisine',
    es: 'Cocina',
    ar: 'مطبخ',
    zh: '厨房',
    de: 'Küche',
    pt: 'Cozinha',
    it: 'Cucina',
    ja: 'キッチン',
    hi: 'रसोई',
    so: 'Jiko',
    ki: 'Rĩko',
    luo: 'Jikon',
  },
  'ocean view': {
    sw: 'Mandhari ya Bahari',
    fr: 'Vue sur l’océan',
    es: 'Vista al océano',
    ar: 'إطلالة على المحيط',
    zh: '海景',
    de: 'Meerblick',
    pt: 'Vista para o mar',
    it: 'Vista oceano',
    ja: 'オーシャンビュー',
    hi: 'समुद्र का नज़ारा',
    so: 'Muuqaalka Badda',
    ki: 'Rũrĩrĩ rwa Iria',
    luo: 'Neno Nam',
  },
  'sea view': {
    sw: 'Mandhari ya Bahari',
    fr: 'Vue sur la mer',
    es: 'Vista al mar',
    ar: 'إطلالة بحرية',
    zh: '海景',
    de: 'Meerblick',
    pt: 'Vista para o mar',
    it: 'Vista mare',
    ja: 'シービュー',
    hi: 'समुद्र का दृश्य',
    so: 'Muuqaalka Badda',
    ki: 'Rũrĩrĩ rwa Iria',
    luo: 'Neno Nam',
  },
  'skyline view': {
    sw: 'Mandhari ya Jiji',
    fr: 'Vue panoramique sur la ville',
    es: 'Vista panorámica a la ciudad',
    ar: 'إطلالة على أفق المدينة',
    zh: '城市天际线景观',
    de: 'Skyline-Blick',
    pt: 'Vista para o horizonte da cidade',
    it: 'Vista sullo skyline',
    ja: 'スカイラインビュー',
    hi: 'शहर का नज़ारा',
    so: 'Muuqaalka Magaalada',
    ki: 'Rũrĩrĩ rwa Taũni',
    luo: 'Neno Taon',
  },
  'city view': {
    sw: 'Mandhari ya Mji',
    fr: 'Vue sur la ville',
    es: 'Vista a la ciudad',
    ar: 'إطلالة على المدينة',
    zh: '城市景观',
    de: 'Stadtblick',
    pt: 'Vista para a cidade',
    it: 'Vista città',
    ja: 'シティビュー',
    hi: 'सिटी व्यू',
    so: 'Muuqaalka Magaalada',
    ki: 'Rũrĩrĩ rwa Taũni',
    luo: 'Neno Taon',
  },
  balcony: {
    sw: 'Baraza (Balcony)',
    fr: 'Balcon',
    es: 'Balcón',
    ar: 'شرفة',
    zh: '阳台',
    de: 'Balkon',
    pt: 'Varanda',
    it: 'Balcone',
    ja: 'バルコニー',
    hi: 'बालकनी',
    so: 'Balkoon',
    ki: 'Balkoni',
    luo: 'Balkoni',
  },
  gym: {
    sw: 'Ukumbi wa Mazoezi (Gym)',
    fr: 'Salle de sport',
    es: 'Gimnasio',
    ar: 'نادي رياضي',
    zh: '健身房',
    de: 'Fitnessstudio',
    pt: 'Academia',
    it: 'Palestra',
    ja: 'ジム',
    hi: 'जिम',
    so: 'Goob Jimicsi',
    ki: 'Handũ ha Kwĩhoreria Mwĩrĩ',
    luo: 'Kar Tugo',
  },
  'fitness center': {
    sw: 'Kituo cha Mazoezi',
    fr: 'Centre de remise en forme',
    es: 'Centro de fitness',
    ar: 'مركز لياقة بدنية',
    zh: '健身中心',
    de: 'Fitnesscenter',
    pt: 'Centro de fitness',
    it: 'Centro fitness',
    ja: 'フィットネスセンター',
    hi: 'फ़िटनेस सेंटर',
    so: 'Xarunta Jimicsiga',
    ki: 'Handũ ha Kwĩhoreria Mwĩrĩ',
    luo: 'Kar Tugo',
  },
  'hot tub': {
    sw: 'Beseni la Maji Moto',
    fr: 'Bain à remous',
    es: 'Jacuzzi',
    ar: 'حوض استحمام ساخن',
    zh: '热水浴缸',
    de: 'Whirlpool',
    pt: 'Banheira de hidromassagem',
    it: 'Vasca idromassaggio',
    ja: 'ジャグジー',
    hi: 'हॉट टब',
    so: 'Tub Biyo Kulul',
    ki: 'Kĩthambĩro kĩa Maaĩ Mahiũ',
    luo: 'Kar Lwoko gi Pi Maliet',
  },
  'solar backup': {
    sw: 'Umeme wa Ziada wa Jua',
    fr: 'Alimentation solaire de secours',
    es: 'Respaldo de energía solar',
    ar: 'طاقة شمسية احتياطية',
    zh: '太阳能备用电源',
    de: 'Solar-Notstrom',
    pt: 'Energia solar de reserva',
    it: 'Alimentazione solare di riserva',
    ja: '太陽光バックアップ電源',
    hi: 'सोलर बैकअप',
    so: 'Koronto Cadceedda ah',
    ki: 'Thitima ya Riũa',
    luo: 'Stima mar Chieng’',
  },
  'backup generator': {
    sw: 'Jenereta ya Dharura',
    fr: 'Générateur de secours',
    es: 'Generador de respaldo',
    ar: 'مولد كهرباء احتياطي',
    zh: '备用发电机',
    de: 'Notstromaggregat',
    pt: 'Gerador de reserva',
    it: 'Generatore di emergenza',
    ja: '非常用発電機',
    hi: 'बैकअप जनरेटर',
    so: 'Matoor Koronto oo Kayd ah',
    ki: 'Jenereta ya Thitima',
    luo: 'Jenereta mar Stima',
  },
  workspace: {
    sw: 'Sehemu ya Kufanyia Kazi',
    fr: 'Espace de travail',
    es: 'Espacio de trabajo',
    ar: 'مساحة عمل',
    zh: '工作区',
    de: 'Arbeitsbereich',
    pt: 'Espaço de trabalho',
    it: 'Spazio di lavoro',
    ja: 'ワークスペース',
    hi: 'वर्कस्पेस',
    so: 'Meel Shaqo',
    ki: 'Handũ ha Wĩra',
    luo: 'Kar Tich',
  },
  'dedicated workspace': {
    sw: 'Ofisi ya Kazi Ndani',
    fr: 'Espace de travail dédié',
    es: 'Zona de trabajo dedicada',
    ar: 'مساحة عمل مخصصة',
    zh: '专用工作区',
    de: 'Eigener Arbeitsplatz',
    pt: 'Espaço de trabalho dedicado',
    it: 'Postazione lavoro dedicata',
    ja: '専用ワークスペース',
    hi: 'समर्पित कार्यक्षेत्र',
    so: 'Meel Shaqo oo Gaar ah',
    ki: 'Handũ ha Wĩra',
    luo: 'Kar Tich Makende',
  },
  'smart tv': {
    sw: 'Runinga ya Kisasa (Smart TV)',
    fr: 'TV connectée',
    es: 'Smart TV',
    ar: 'تلفاز ذكي',
    zh: '智能电视',
    de: 'Smart-TV',
    pt: 'Smart TV',
    it: 'Smart TV',
    ja: 'スマートTV',
    hi: 'स्मार्ट टीवी',
    so: 'TV Casri ah',
    ki: 'TV ya Kĩrĩu',
    luo: 'TV Makende',
  },
  washer: {
    sw: 'Mashine ya Kufulia',
    fr: 'Lave-linge',
    es: 'Lavadora',
    ar: 'غسالة ملابس',
    zh: '洗衣机',
    de: 'Waschmaschine',
    pt: 'Máquina de lavar',
    it: 'Lavatrice',
    ja: '洗濯機',
    hi: 'वॉशिंग मशीन',
    so: 'Mashiinka Dharka',
    ki: 'Macini ya Kũhũra Nguo',
    luo: 'Masin mar Lwoko Nanga',
  },
  garden: {
    sw: 'Bustani',
    fr: 'Jardin',
    es: 'Jardín',
    ar: 'حديقة',
    zh: '花园',
    de: 'Garten',
    pt: 'Jardim',
    it: 'Giardino',
    ja: '庭園',
    hi: 'बगीचा',
    so: 'Beer Nasasho',
    ki: 'Mũgũnda wa Mahũa',
    luo: 'Puodho Maua',
  },
  'bbq grill': {
    sw: 'Jiko la Kuchoma Nyama (BBQ)',
    fr: 'Barbecue',
    es: 'Parrilla BBQ',
    ar: 'شواية باربكيو',
    zh: '烧烤架',
    de: 'Grill',
    pt: 'Churrasqueira',
    it: 'Barbecue',
    ja: 'BBQグリル',
    hi: 'बीबीक्यू ग्रिल',
    so: 'Mishiinka Dubista Hilibka',
    ki: 'Rĩko rĩa Nyama',
    luo: 'Kar Tero Ring’o',
  },
  beachfront: {
    sw: 'Mbele ya Ufukwe wa Bahari',
    fr: 'Front de mer',
    es: 'Frente a la playa',
    ar: 'على شاطئ البحر مباشرة',
    zh: '海滨一线',
    de: 'Direkt am Strand',
    pt: 'À beira-mar',
    it: 'Fronte spiaggia',
    ja: 'ビーチフロント',
    hi: 'समुद्र तट के सामने',
    so: 'Xeebta Horteeda',
    ki: 'Rũteere-inĩ rwa Iria',
    luo: 'Dho Nam',
  },
  'pet friendly': {
    sw: 'Wanyama wa Kufugwa Wanaruhusiwa',
    fr: 'Animaux acceptés',
    es: 'Acepta mascotas',
    ar: 'مناسب للحيوانات الأليفة',
    zh: '可携带宠物',
    de: 'Haustierfreundlich',
    pt: 'Aceita animais',
    it: 'Animali ammessi',
    ja: 'ペット可',
    hi: 'पालतू जानवर अनुमत',
    so: 'Xayawaanka Guriga waa la Oggol yahay',
    ki: 'Nyamũ cia Mũciĩ nĩ Itĩkĩrĩtio',
    luo: 'Le mag Pacho Oyiego',
  },
  elevator: {
    sw: 'Lifti',
    fr: 'Ascenseur',
    es: 'Ascensor',
    ar: 'مصعد',
    zh: '电梯',
    de: 'Aufzug',
    pt: 'Elevador',
    it: 'Ascensore',
    ja: 'エレベーター',
    hi: 'लिफ़्ट',
    so: 'Wiish',
    ki: 'Lifti',
    luo: 'Lift',
  },
  'breakfast included': {
    sw: 'Kiamsha Kinywa Kimejumuishwa',
    fr: 'Petit-déjeuner inclus',
    es: 'Desayuno incluido',
    ar: 'شامل الإفطار',
    zh: '含早餐',
    de: 'Frühstück inklusive',
    pt: 'Café da manhã incluído',
    it: 'Colazione inclusa',
    ja: '朝食付き',
    hi: 'नाश्ता शामिल',
    so: 'Quraac ayaa Ku Jirta',
    ki: 'Irio cia Rũcinĩ nĩ Irĩ Ho',
    luo: 'Chiembo mar Okinyi Nitie',
  },
  'airport pickup': {
    sw: 'Mapokezi Kutoka Uwanja wa Ndege',
    fr: 'Transfert depuis l’aéroport',
    es: 'Recogida en el aeropuerto',
    ar: 'استقبال من المطار',
    zh: '机场接机',
    de: 'Flughafentransfer',
    pt: 'Traslado do aeroporto',
    it: 'Trasferimento dall’aeroporto',
    ja: '空港お迎え',
    hi: 'एयरपोर्ट पिकअप',
    so: 'Ka Soo Qaadidda Garoonka',
    ki: 'Kũgĩrwo Kĩwanja kĩa Ndege',
    luo: 'Omo e Pap Ndege',
  },
  'ev charger': {
    sw: 'Chaja ya Gari la Umeme',
    fr: 'Borne de recharge VE',
    es: 'Cargador para vehículo eléctrico',
    ar: 'شاحن سيارات كهربائية',
    zh: '电动车充电桩',
    de: 'E-Auto-Ladestation',
    pt: 'Carregador para carro elétrico',
    it: 'Colonnina di ricarica EV',
    ja: 'EV充電器',
    hi: 'ईवी चार्जर',
    so: 'Dab-bixiye Baabuur Koronto',
    ki: 'Caja ya Ngari ya Thitima',
    luo: 'Chaja mar Mtoka Stima',
  },
  // Welcome Gifts
  'fresh kenyan coffee': {
    sw: 'Kahawa Halisi ya Kenya',
    fr: 'Café kenyan frais',
    es: 'Café keniano fresco',
    ar: 'قهوة كينية طازجة',
    zh: '新鲜肯尼亚咖啡',
    de: 'Frischer kenianischer Kaffee',
    pt: 'Café queniano fresco',
    it: 'Caffè keniota fresco',
    ja: '新鮮なケニアコーヒー',
    hi: 'ताज़ी केन्याई कॉफ़ी',
    so: 'Qaxwo Kenya ah oo Cusub',
    ki: 'Kahũa ka Kenya',
    luo: 'Kawa ma Kenya',
  },
  'kenyan coffee': {
    sw: 'Kahawa ya Kenya',
    fr: 'Café du Kenya',
    es: 'Café de Kenia',
    ar: 'قهوة كينية',
    zh: '肯尼亚咖啡',
    de: 'Kenianischer Kaffee',
    pt: 'Café do Quênia',
    it: 'Caffè del Kenya',
    ja: 'ケニアコーヒー',
    hi: 'केन्याई कॉफ़ी',
    so: 'Qaxwo Kenya ah',
    ki: 'Kahũa ka Kenya',
    luo: 'Kawa ma Kenya',
  },
  'welcome fruit basket': {
    sw: 'Kikapu cha Matunda ya Karibu',
    fr: 'Panier de fruits de bienvenue',
    es: 'Cesta de frutas de bienvenida',
    ar: 'سلة فواكه ترحيبية',
    zh: '欢迎水果篮',
    de: 'Willkommens-Obstkorb',
    pt: 'Cesta de frutas de boas-vindas',
    it: 'Cesto di frutta di benvenuto',
    ja: 'ウェルカムフルーツバスケット',
    hi: 'स्वागत फल टोकरी',
    so: 'Dambiil Miro Soo Dhaweyn ah',
    ki: 'Kĩondo kĩa Matunda ma Kũnyita Ũgeni',
    luo: 'Odundu mar Olembe mag Rwako Welo',
  },
  'fruit basket': {
    sw: 'Kikapu cha Matunda',
    fr: 'Panier de fruits',
    es: 'Cesta de frutas',
    ar: 'سلة فواكه',
    zh: '水果篮',
    de: 'Obstkorb',
    pt: 'Cesta de frutas',
    it: 'Cesto di frutta',
    ja: 'フルーツバスケット',
    hi: 'फलों की टोकरी',
    so: 'Dambiil Miro ah',
    ki: 'Kĩondo kĩa Matunda',
    luo: 'Odundu mar Olembe',
  },
  'chilled bottled water': {
    sw: 'Maji Baridi ya Chupa',
    fr: 'Eau en bouteille fraîche',
    es: 'Agua embotellada fría',
    ar: 'مياه معدنية مبردة',
    zh: '冰镇瓶装水',
    de: 'Gekühltes Mineralwasser',
    pt: 'Água mineral gelada',
    it: 'Acqua in bottiglia fresca',
    ja: '冷たいミネラルウォーター',
    hi: 'ठंडा बोतलबंद पानी',
    so: 'Biyo Qabow oo Dhalo ku jira',
    ki: 'Maaĩ Mahoro ma Cũba',
    luo: 'Pi Mang’ich mar Chupa',
  },
  'airport transfer': {
    sw: 'Usafiri wa Uwanja wa Ndege',
    fr: 'Transfert aéroport',
    es: 'Traslado al aeropuerto',
    ar: 'توصيل من وإلى المطار',
    zh: '机场接送',
    de: 'Flughafentransfer',
    pt: 'Transfer do aeroporto',
    it: 'Trasferimento aeroportuale',
    ja: '空港送迎',
    hi: 'एयरपोर्ट ट्रांसफर',
    so: 'Gaadiidka Garoonka',
    ki: 'Ũkuui wa Kĩwanja kĩa Ndege',
    luo: 'Wuoth mar Pap Ndege',
  },
  'fresh flowers': {
    sw: 'Maua Mapya',
    fr: 'Fleurs fraîches',
    es: 'Flores frescas',
    ar: 'زهور طازجة',
    zh: '鲜花',
    de: 'Frische Blumen',
    pt: 'Flores frescas',
    it: 'Fiori freschi',
    ja: '生花',
    hi: 'ताज़े फूल',
    so: 'Ubax Cusub',
    ki: 'Mahũa Merũ',
    luo: 'Maua Manyien',
  },
};

// Phrase & word glossary (longest-phrase-first matching for general English hospitality text)
const GLOSSARY_ENTRIES: Array<[string, Partial<LangEntryMap>]> = [
  ['minutes from', { sw: 'dakika chache kutoka', fr: 'à quelques minutes de', es: 'a minutos de', ar: 'على بُعد دقائق من', zh: '距离仅几分钟路程', de: 'Minuten entfernt von', pt: 'a minutos de', it: 'a pochi minuti da', ja: 'から数分', hi: 'से कुछ ही मिनट दूर', so: 'daqiiqado u jira', ki: 'ndagĩka nini kuuma', luo: 'dakika manok koa' }],
  ['walking distance to', { sw: 'umbali wa kutembea hadi', fr: 'à distance de marche de', es: 'a poca distancia a pie de', ar: 'على مسافة قريبة سيراً من', zh: '步行可达', de: 'fußläufig zu', pt: 'a uma curta caminhada de', it: 'a pochi passi da', ja: 'から徒歩圏内', hi: 'से पैदल दूरी पर', so: 'meel loo lugeyn karo ilaa', ki: 'handũ ha kũgererera na magũrũ nginya', luo: 'kar wuoth gi tielo nyaka' }],
  ['panoramic view', { sw: 'mandhari pana', fr: 'vue panoramique', es: 'vista panorámica', ar: 'إطلالة بانورامية', zh: '全景视野', de: 'Panoramablick', pt: 'vista panorâmica', it: 'vista panoramica', ja: 'パノラマビュー', hi: 'मनोरम दृश्य', so: 'muuqaal ballaaran', ki: 'rũrĩrĩ rwaraganu', luo: 'neno malach' }],
  ['panoramic views', { sw: 'mandhari pana', fr: 'vues panoramiques', es: 'vistas panorámicas', ar: 'إطلالات بانورامية', zh: '全景视野', de: 'Panoramablick', pt: 'vistas panorâmicas', it: 'viste panoramiche', ja: 'パノラマビュー', hi: 'मनोरम दृश्य', so: 'muuqaallo ballaaran', ki: 'rũrĩrĩ rwaraganu', luo: 'neno malach' }],
  ['business travelers', { sw: 'wasafiri wa kibiashara', fr: 'voyageurs d’affaires', es: 'viajeros de negocios', ar: 'المسافرون بغرض العمل', zh: '商务旅客', de: 'Geschäftsreisende', pt: 'viajantes a negócios', it: 'viaggiatori d’affari', ja: 'ビジネス旅行者', hi: 'व्यावसायिक यात्री', so: 'socdaalka ganacsiga', ki: 'agendi a biacara', luo: 'jowuoth mag ohala' }],
  ['welcome to', { sw: 'Karibu', fr: 'Bienvenue à', es: 'Bienvenido a', ar: 'مرحباً بكم في', zh: '欢迎来到', de: 'Willkommen in', pt: 'Bem-vindo a', it: 'Benvenuti a', ja: 'へようこそ', hi: 'में आपका स्वागत है', so: 'Ku soo dhawoow', ki: 'Wĩ mũnyite ũgeni', luo: 'Oriti e' }],
  ['quiet neighborhood', { sw: 'mtaa tulivu', fr: 'quartier calme', es: 'barrio tranquilo', ar: 'حي هادئ', zh: '安静街区', de: 'ruhige Nachbarschaft', pt: 'bairro tranquilo', it: 'quartiere tranquillo', ja: '静かな住宅街', hi: 'शांत इलाका', so: 'xaafad deggan', ki: 'mwena mũhooreru', luo: 'gweng’ ma nigi kue' }],
  ['high-floor', { sw: 'ghorofa ya juu', fr: 'étage élevé', es: 'piso alto', ar: 'طابق مرتفع', zh: '高楼层', de: 'oberes Stockwerk', pt: 'andar alto', it: 'piano alto', ja: '高層階', hi: 'ऊपरी मंज़िल', so: 'dabaq sare', ki: 'gorofa ya igũrũ', luo: 'gorofa ma malo' }],
  ['modern', { sw: 'ya kisasa', fr: 'moderne', es: 'moderno', ar: 'عصري', zh: '现代', de: 'modern', pt: 'moderno', it: 'moderno', ja: 'モダン', hi: 'आधुनिक', so: 'casri ah', ki: 'ya kĩrĩu', luo: 'mar ndalo ni' }],
  ['luxury', { sw: 'ya kifahari', fr: 'de luxe', es: 'de lujo', ar: 'فاخر', zh: '豪华', de: 'luxuriös', pt: 'de luxo', it: 'di lusso', ja: 'ラグジュアリー', hi: 'लक्ज़री', so: 'raaxo leh', ki: 'ya gĩtĩo', luo: 'maber ahinya' }],
  ['spacious', { sw: 'yenye nafasi kubwa', fr: 'spacieux', es: 'espacioso', ar: 'واسع', zh: '宽敞', de: 'geräumig', pt: 'espaçoso', it: 'spazioso', ja: '広々とした', hi: 'विशाल', so: 'waasac ah', ki: 'nene na njariĩ', luo: 'malach' }],
  ['sunlit', { sw: 'yenye mwanga wa jua', fr: 'ensoleillé', es: 'luminoso', ar: 'مشمس', zh: '阳光充足', de: 'sonnendurchflutet', pt: 'ensolarado', it: 'soleggiato', ja: '日当たりの良い', hi: 'धूप से भरपूर', so: 'qorrax leh', ki: 'ĩrĩ na ũtheri wa riũa', luo: 'ma ler gi chieng’' }],
  ['private', { sw: 'ya kibinafsi', fr: 'privé', es: 'privado', ar: 'خاص', zh: '私人', de: 'privat', pt: 'privado', it: 'privato', ja: 'プライベート', hi: 'निजी', so: 'gaar ah', ki: 'ya mũndũ kĩũmbe', luo: 'makende' }],
  ['bedroom', { sw: 'chumba cha kulala', fr: 'chambre', es: 'dormitorio', ar: 'غرفة نوم', zh: '卧室', de: 'Schlafzimmer', pt: 'quarto', it: 'camera da letto', ja: '寝室', hi: 'बेडरूम', so: 'qol jiif', ki: 'nyũmba ya gũkoma', luo: 'ot nindo' }],
  ['bedrooms', { sw: 'vyumba vya kulala', fr: 'chambres', es: 'dormitorios', ar: 'غرف نوم', zh: '卧室', de: 'Schlafzimmer', pt: 'quartos', it: 'camere da letto', ja: '寝室', hi: 'बेडरूम', so: 'qolal jiif', ki: 'nyũmba cia gũkoma', luo: 'ute nindo' }],
  ['garden', { sw: 'bustani', fr: 'jardin', es: 'jardín', ar: 'حديقة', zh: '花园', de: 'Garten', pt: 'jardim', it: 'giardino', ja: '庭', hi: 'बगीचा', so: 'beer', ki: 'mũgũnda', luo: 'puodho' }],
  ['terrace', { sw: 'mtaro', fr: 'terrasse', es: 'terraza', ar: 'تراس', zh: '露台', de: 'Terrasse', pt: 'terraço', it: 'terrazza', ja: 'テラス', hi: 'छत', so: 'barxad', ki: 'kĩbaraza', luo: 'baraza' }],
  ['skyline', { sw: 'mandhari ya jiji', fr: 'horizon urbain', es: 'horizonte urbano', ar: 'أفق المدينة', zh: '天际线', de: 'Skyline', pt: 'horizonte', it: 'skyline', ja: 'スカイライン', hi: 'स्काईलाइन', so: 'muuqaalka magaalada', ki: 'taũni', luo: 'taon' }],
  ['horizon', { sw: 'upeo wa macho', fr: 'horizon', es: 'horizonte', ar: 'أفق', zh: '地平线', de: 'Horizont', pt: 'horizonte', it: 'orizzonte', ja: 'ホライゾン', hi: 'क्षितिज', so: 'aragtida fog', ki: 'kũraihu', luo: 'mabor' }],
  ['suite', { sw: 'chumba cha kifahari', fr: 'suite', es: 'suite', ar: 'جناح', zh: '套房', de: 'Suite', pt: 'suíte', it: 'suite', ja: 'スイート', hi: 'सुइट', so: 'qol raaxo', ki: 'kanyũmba', luo: 'ot maber' }],
  ['villa', { sw: 'jumba la kifahari', fr: 'villa', es: 'villa', ar: 'فيلا', zh: '别墅', de: 'Villa', pt: 'vila', it: 'villa', ja: 'ヴィラ', hi: 'विला', so: 'fillo', ki: 'nyũmba nene', luo: 'ot maduong’' }],
  ['apartment', { sw: 'fleti', fr: 'appartement', es: 'apartamento', ar: 'شقة', zh: '公寓', de: 'Apartment', pt: 'apartamento', it: 'appartamento', ja: 'アパート', hi: 'अपार्टमेंट', so: 'guri dabaq ah', ki: 'nyũmba ya gorofa', luo: 'ot gorofa' }],
  ['studio', { sw: 'studio', fr: 'studio', es: 'estudio', ar: 'استوديو', zh: '单间公寓', de: 'Studio', pt: 'estúdio', it: 'monolocale', ja: 'スタジオ', hi: 'स्टूडियो', so: 'istuudiyo', ki: 'nyũmba ya kĩmwe', luo: 'ot achiel' }],
  ['penthouse', { sw: 'fleti ya ghorofa ya juu', fr: 'penthouse', es: 'ático', ar: 'بنتهاوس', zh: '顶层公寓', de: 'Penthouse', pt: 'cobertura', it: 'attico', ja: 'ペントハウス', hi: 'पेंटहाउस', so: 'guri dabaqa sare', ki: 'nyũmba ya igũrũ mũno', luo: 'ot malo moloyo' }],
  ['stay', { sw: 'makazi', fr: 'séjour', es: 'estancia', ar: 'إقامة', zh: '住宿', de: 'Aufenthalt', pt: 'estadia', it: 'soggiorno', ja: '滞在', hi: 'प्रवास', so: 'joogitaan', ki: 'kũrara', luo: 'dak' }],
  ['guests', { sw: 'wageni', fr: 'voyageurs', es: 'huéspedes', ar: 'ضيوف', zh: '客人', de: 'Gäste', pt: 'hóspedes', it: 'ospiti', ja: 'ゲスト', hi: 'मेहमान', so: 'marti', ki: 'agendi', luo: 'welo' }],
  ['families', { sw: 'familia', fr: 'familles', es: 'familias', ar: 'عائلات', zh: '家庭', de: 'Familien', pt: 'famílias', it: 'famiglie', ja: 'ご家族', hi: 'परिवारों', so: 'qoysaska', ki: 'famĩrĩ', luo: 'joot' }],
  ['safe', { sw: 'salama', fr: 'sûr', es: 'seguro', ar: 'آمن', zh: '安全', de: 'sicher', pt: 'seguro', it: 'sicuro', ja: '安全', hi: 'सुरक्षित', so: 'ammaan ah', ki: 'kũgĩtĩrũo', luo: 'mar kwe' }],
  ['clean', { sw: 'safi', fr: 'propre', es: 'limpio', ar: 'نظيف', zh: '干净', de: 'sauber', pt: 'limpo', it: 'pulito', ja: '清潔', hi: 'स्वच्छ', so: 'nadiif ah', ki: 'theru', luo: 'maler' }],
  ['beautiful', { sw: 'nzuri', fr: 'magnifique', es: 'hermoso', ar: 'جميل', zh: '美丽', de: 'wunderschön', pt: 'lindo', it: 'bellissimo', ja: '美しい', hi: 'सुंदर', so: 'qurux badan', ki: 'thaka', luo: 'jaber' }],
  ['comfortable', { sw: 'yenye starehe', fr: 'confortable', es: 'cómodo', ar: 'مريح', zh: '舒适', de: 'komfortabel', pt: 'confortável', it: 'confortevole', ja: '快適', hi: 'आरामदायक', so: 'raaxo leh', ki: 'kũhoorera', luo: 'mokuwe' }],
  ['enjoy', { sw: 'furahia', fr: 'profitez de', es: 'disfruta de', ar: 'استمتع بـ', zh: '享受', de: 'genießen Sie', pt: 'aproveite', it: 'goditi', ja: 'お楽しみください', hi: 'आनंद लें', so: 'ku raaxayso', ki: 'kenera', luo: 'mor gi' }],
  ['with', { sw: 'na', fr: 'avec', es: 'con', ar: 'مع', zh: '配有', de: 'mit', pt: 'com', it: 'con', ja: '付き', hi: 'के साथ', so: 'oo leh', ki: 'na', luo: 'gi' }],
  ['and', { sw: 'na', fr: 'et', es: 'y', ar: 'و', zh: '和', de: 'und', pt: 'e', it: 'e', ja: 'と', hi: 'और', so: 'iyo', ki: 'na', luo: 'gi' }],
  ['in', { sw: 'katika', fr: 'à', es: 'en', ar: 'في', zh: '位于', de: 'in', pt: 'em', it: 'a', ja: 'の', hi: 'में', so: 'ku yaal', ki: 'thĩinĩ wa', luo: 'e' }],
  ['near', { sw: 'karibu na', fr: 'près de', es: 'cerca de', ar: 'بالقرب من', zh: '靠近', de: 'in der Nähe von', pt: 'perto de', it: 'vicino a', ja: 'の近く', hi: 'के पास', so: 'u dhow', ki: 'hakuhĩ na', luo: 'machiegni gi' }],
  ['ideal for', { sw: 'bora kwa', fr: 'idéal pour', es: 'ideal para', ar: 'مثالي لـ', zh: '非常适合', de: 'ideal für', pt: 'ideal para', it: 'ideale per', ja: 'に最適', hi: 'के लिए आदर्श', so: 'ku habboon', ki: 'kĩega mũno kũrĩ', luo: 'maber ne' }],
  ['check-in', { sw: 'kuingia', fr: 'arrivée', es: 'check-in', ar: 'تسجيل الوصول', zh: '入住', de: 'Check-in', pt: 'check-in', it: 'check-in', ja: 'チェックイン', hi: 'चेक-इन', so: 'galitaan', ki: 'kũingĩra', luo: 'donjo' }],
  ['checkout', { sw: 'kutoka', fr: 'départ', es: 'salida', ar: 'تسجيل المغادرة', zh: '退房', de: 'Check-out', pt: 'check-out', it: 'check-out', ja: 'チェックアウト', hi: 'चेक-आउट', so: 'bixitaan', ki: 'kuuma', luo: 'wuok' }],
  ['security', { sw: 'ulinzi', fr: 'sécurité', es: 'seguridad', ar: 'أمن', zh: '安保', de: 'Sicherheit', pt: 'segurança', it: 'sicurezza', ja: 'セキュリティ', hi: 'सुरक्षा', so: 'ammaan', ki: 'ũgitĩri', luo: 'rito' }],
  ['parking', { sw: 'maegesho', fr: 'parking', es: 'estacionamiento', ar: 'موقف سيارات', zh: '停车位', de: 'Parkplatz', pt: 'estacionamento', it: 'parcheggio', ja: '駐車場', hi: 'पार्किंग', so: 'baarkin', ki: 'handũ ha ngari', luo: 'kar chungo mtoka' }],
  ['beach', { sw: 'ufukwe', fr: 'plage', es: 'playa', ar: 'شاطئ', zh: '海滩', de: 'Strand', pt: 'praia', it: 'spiaggia', ja: 'ビーチ', hi: 'समुद्र तट', so: 'xeeb', ki: 'rũteere rwa iria', luo: 'dho nam' }],
  ['ocean', { sw: 'bahari', fr: 'océan', es: 'océano', ar: 'محيط', zh: '海洋', de: 'Ozean', pt: 'oceano', it: 'oceano', ja: '海', hi: 'महासागर', so: 'badweyn', ki: 'iria', luo: 'nam' }],
  ['sunset', { sw: 'machweo ya jua', fr: 'coucher de soleil', es: 'atardecer', ar: 'غروب الشمس', zh: '日落', de: 'Sonnenuntergang', pt: 'pôr do sol', it: 'tramonto', ja: '夕日', hi: 'सूर्यास्त', so: 'qorrax dhaca', ki: 'kũthũa kwa riũa', luo: 'podho chieng’' }],
  ['morning', { sw: 'asubuhi', fr: 'matin', es: 'mañana', ar: 'صباح', zh: '早晨', de: 'Morgen', pt: 'manhã', it: 'mattina', ja: '朝', hi: 'सुबह', so: 'subax', ki: 'rũcinĩ', luo: 'okinyi' }],
  ['views', { sw: 'mandhari', fr: 'vues', es: 'vistas', ar: 'إطلالات', zh: '景观', de: 'Ausblicke', pt: 'vistas', it: 'viste', ja: '景色', hi: 'नज़ारे', so: 'muuqaallo', ki: 'rũrĩrĩ', luo: 'neno' }],
  ['view', { sw: 'mandhari', fr: 'vue', es: 'vista', ar: 'إطلالة', zh: '景观', de: 'Aussicht', pt: 'vista', it: 'vista', ja: '眺め', hi: 'नज़ारा', so: 'muuqaal', ki: 'rũrĩrĩ', luo: 'neno' }],
  ['home', { sw: 'nyumba', fr: 'maison', es: 'hogar', ar: 'منزل', zh: '家', de: 'Zuhause', pt: 'casa', it: 'casa', ja: '家', hi: 'घर', so: 'guri', ki: 'mũciĩ', luo: 'dala' }],
  ['house', { sw: 'nyumba', fr: 'maison', es: 'casa', ar: 'منزل', zh: '房屋', de: 'Haus', pt: 'casa', it: 'casa', ja: '一軒家', hi: 'घर', so: 'guri', ki: 'nyũmba', luo: 'ot' }],
  ['city', { sw: 'jiji', fr: 'ville', es: 'ciudad', ar: 'مدينة', zh: '城市', de: 'Stadt', pt: 'cidade', it: 'città', ja: '都市', hi: 'शहर', so: 'magaalo', ki: 'taũni', luo: 'taon' }],
  ['retreat', { sw: 'mapumziko', fr: 'refuge', es: 'retiro', ar: 'ملاذ هادئ', zh: '度假居所', de: 'Rückzugsort', pt: 'refúgio', it: 'rifugio', ja: 'リトリート', hi: 'विश्राम स्थल', so: 'goob nasasho', ki: 'kũhurũka', luo: 'kar yueyo' }],
  ['tranquil', { sw: 'tulivu', fr: 'tranquille', es: 'tranquilo', ar: 'هادئ', zh: '宁静', de: 'ruhig', pt: 'tranquilo', it: 'tranquillo', ja: '静かな', hi: 'शांत', so: 'deggan', ki: 'mũhooreru', luo: 'mokue' }],
  ['serenity', { sw: 'utulivu', fr: 'sérénité', es: 'serenidad', ar: 'سكينة', zh: '静谧', de: 'Gelassenheit', pt: 'serenidade', it: 'serenità', ja: '静寂', hi: 'शांति', so: 'xasillooni', ki: 'ũhooreri', luo: 'kue' }],
  ['coffee', { sw: 'kahawa', fr: 'café', es: 'café', ar: 'قهوة', zh: '咖啡', de: 'Kaffee', pt: 'café', it: 'caffè', ja: 'コーヒー', hi: 'कॉफ़ी', so: 'qaxwo', ki: 'kahũa', luo: 'kawa' }],
  ['airport', { sw: 'uwanja wa ndege', fr: 'aéroport', es: 'aeropuerto', ar: 'مطار', zh: '机场', de: 'Flughafen', pt: 'aeroporto', it: 'aeroporto', ja: '空港', hi: 'हवाई अड्डा', so: 'garoonka diyaaradaha', ki: 'kĩwanja kĩa ndege', luo: 'pap ndege' }],
  ['shopping', { sw: 'manunuzi', fr: 'shopping', es: 'compras', ar: 'تسوق', zh: '购物', de: 'Einkaufen', pt: 'compras', it: 'shopping', ja: 'ショッピング', hi: 'खरीदारी', so: 'dukaamaysi', ki: 'ũgũri', luo: 'ng’iewo' }],
  ['restaurants', { sw: 'migahawa', fr: 'restaurants', es: 'restaurantes', ar: 'مطاعم', zh: '餐厅', de: 'Restaurants', pt: 'restaurantes', it: 'ristoranti', ja: 'レストラン', hi: 'रेस्तरां', so: 'maqaaxiyado', ki: 'mũkawa', luo: 'ute chiemo' }],
  ['night', { sw: 'usiku', fr: 'nuit', es: 'noche', ar: 'ليلة', zh: '晚', de: 'Nacht', pt: 'noite', it: 'notte', ja: '泊', hi: 'रात', so: 'habeen', ki: 'ũtukũ', luo: 'otieno' }],
  ['nights', { sw: 'usiku', fr: 'nuits', es: 'noches', ar: 'ليالٍ', zh: '晚', de: 'Nächte', pt: 'noites', it: 'notti', ja: '泊', hi: 'रातें', so: 'habeenno', ki: 'mĩtukũ', luo: 'otieno' }],
  ['free', { sw: 'bure', fr: 'gratuit', es: 'gratis', ar: 'مجاني', zh: '免费', de: 'kostenlos', pt: 'gratuito', it: 'gratuito', ja: '無料', hi: 'मुफ़्त', so: 'bilaash', ki: 'hatarĩ marĩhi', luo: 'nono' }],
];

// Sort longest phrase first so multi-word phrases replace before single words
const SORTED_GLOSSARY = [...GLOSSARY_ENTRIES].sort((a, b) => b[0].length - a[0].length);

const PRICE_PATTERNS: Record<LocalDictLang, (amount: string, count: number) => string> = {
  sw: (amount, count) => `${amount} kwa usiku ${count}`,
  fr: (amount, count) => `${amount} pour ${count} ${count === 1 ? 'nuit' : 'nuits'}`,
  es: (amount, count) => `${amount} por ${count} ${count === 1 ? 'noche' : 'noches'}`,
  ar: (amount, count) => `${amount} لـ ${count} ${count === 1 ? 'ليلة' : 'ليالٍ'}`,
  zh: (amount, count) => `${amount}（${count}晚）`,
  de: (amount, count) => `${amount} für ${count} ${count === 1 ? 'Nacht' : 'Nächte'}`,
  pt: (amount, count) => `${amount} por ${count} ${count === 1 ? 'noite' : 'noites'}`,
  it: (amount, count) => `${amount} per ${count} ${count === 1 ? 'notte' : 'notti'}`,
  ja: (amount, count) => `${amount}（${count}泊）`,
  hi: (amount, count) => `${count} ${count === 1 ? 'रात' : 'रातों'} के लिए ${amount}`,
  so: (amount, count) => `${amount} muddo ${count} ${count === 1 ? 'habeen' : 'habeenno'} ah`,
  ki: (amount, count) => `${amount} kwa ${count === 1 ? 'ũtukũ 1' : `mĩtukũ ${count}`}`,
  luo: (amount, count) => `${amount} kuom otieno ${count}`,
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function translatePriceLocally(priceText: string, meta: LanguageMeta): string {
  const m = priceText.match(/^(.+?)\s+for\s+(\d+)\s+nights?$/i);
  if (!m) return translateLocallyText(priceText, meta);
  const amount = m[1].trim();
  const count = Number(m[2]) || 1;
  if (meta.dictKey && PRICE_PATTERNS[meta.dictKey]) {
    return PRICE_PATTERNS[meta.dictKey](amount, count);
  }
  return priceText;
}

export function translateLocallyText(text: string, meta: LanguageMeta): string {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  const dictKey = meta.dictKey;

  if (dictKey) {
    // 1. Exact phrasebook hit
    const exact = EXACT_PHRASES[lower]?.[dictKey];
    if (exact) return exact;

    // 2. Price pattern
    if (/\bfor\s+\d+\s+nights?\b/i.test(trimmed)) {
      const m = trimmed.match(/^(.+?)\s+for\s+(\d+)\s+nights?$/i);
      if (m) return PRICE_PATTERNS[dictKey](m[1].trim(), Number(m[2]) || 1);
    }

    // 3. Longest-phrase-first dictionary replacement (preserving numbers, times, currencies & proper place names)
    let out = trimmed;
    let replacements = 0;
    for (const [enPhrase, translations] of SORTED_GLOSSARY) {
      const target = translations[dictKey];
      if (!target) continue;
      const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(enPhrase)}(?![A-Za-z0-9])`, 'gi');
      if (re.test(out)) {
        out = out.replace(re, target);
        replacements++;
      }
    }

    // If replacements changed the text meaningfully, return it; otherwise add clean language label for clarity on regional/untranslated strings
    if (replacements > 0 && out.toLowerCase() !== lower) {
      return out.charAt(0).toUpperCase() + out.slice(1);
    }
  }

  return trimmed;
}

// ============================================================================
// KEYLESS FREE OPEN-WEB TRANSLATION ENDPOINTS (ZERO API KEY, ZERO SECRETS)
// ============================================================================

async function fetchGoogleFreeTranslate(text: string, isoCode: string): Promise<string | null> {
  if (!text.trim()) return '';
  try {
    // Hardcoded public Google Translate web widget endpoint (no API key / no secret required)
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'en');
    url.searchParams.set('tl', isoCode);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', text);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; AirBusWebTranslator/1.0)',
      },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
    const combined = data[0]
      .map((seg: any) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
      .join('')
      .trim();
    return combined || null;
  } catch {
    return null;
  }
}

async function fetchMyMemoryFreeTranslate(text: string, isoCode: string): Promise<string | null> {
  if (!text.trim() || text.length > 480) return null;
  try {
    // Hardcoded public MyMemory open translation API (no API key required)
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', `en|${isoCode}`);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const translatedText = typeof data?.responseData?.translatedText === 'string'
      ? data.responseData.translatedText.trim()
      : '';
    if (!translatedText || /MYMEMORY WARNING/i.test(translatedText)) return null;
    return translatedText;
  } catch {
    return null;
  }
}

async function translateSegmentWithFallback(
  text: string,
  meta: LanguageMeta,
  allowNetwork: boolean
): Promise<{ text: string; usedOpenWeb: boolean }> {
  const clean = String(text || '').trim();
  if (!clean) return { text: '', usedOpenWeb: false };

  // 1. Exact built-in hospitality dictionary hits take priority (fast & 100% domain accurate)
  if (meta.dictKey) {
    const exact = EXACT_PHRASES[clean.toLowerCase()]?.[meta.dictKey];
    if (exact) return { text: exact, usedOpenWeb: false };
  }

  // 2. If online and ISO code is known, try keyless free open translation endpoints
  if (allowNetwork && meta.isoCode) {
    const gtx = await fetchGoogleFreeTranslate(clean, meta.isoCode);
    if (gtx) return { text: gtx, usedOpenWeb: true };

    const mm = await fetchMyMemoryFreeTranslate(clean, meta.isoCode);
    if (mm) return { text: mm, usedOpenWeb: true };
  }

  // 3. Offline / regional dictionary fallback (never fails, zero API keys)
  return { text: translateLocallyText(clean, meta), usedOpenWeb: false };
}

export async function translateStayFieldsFree(
  sourceFields: StayTranslationPayload,
  rawTargetLanguage: string
): Promise<TranslationOutcome> {
  const meta = resolveLanguageMeta(rawTargetLanguage);
  const allowNetwork =
    process.env.AIRBUS_TEST_NO_LISTEN !== '1' &&
    Boolean(meta.isoCode);

  let usedOpenWebCount = 0;

  // Preserve exact currency & numbers on priceText using local template if dictionary exists, else open-web
  const priceText = meta.dictKey
    ? translatePriceLocally(sourceFields.priceText, meta)
    : (await translateSegmentWithFallback(sourceFields.priceText, meta, allowNetwork)).text;

  // Standard AirBus system sentences resolve via exact verified phrasebook when available
  const [
    titleRes,
    locationRes,
    typeRes,
    descRes,
    hostMsgRes,
    bookingHoursRes,
    settlementRes,
    instantRes,
    giftsArr,
    featuresArr,
    highlightsArr,
  ] = await Promise.all([
    translateSegmentWithFallback(sourceFields.title, meta, allowNetwork),
    // Keep proper location readable while translating descriptors (or exact offline glosses)
    Promise.resolve({ text: translateLocallyText(sourceFields.location, meta), usedOpenWeb: false }),
    translateSegmentWithFallback(sourceFields.type, meta, allowNetwork),
    translateSegmentWithFallback(sourceFields.description, meta, allowNetwork),
    translateSegmentWithFallback(sourceFields.hostMessage, meta, allowNetwork),
    translateSegmentWithFallback(sourceFields.bookingHoursText, meta, allowNetwork),
    translateSegmentWithFallback(sourceFields.directSettlementText, meta, allowNetwork),
    translateSegmentWithFallback(sourceFields.instantBookLabel, meta, allowNetwork),
    Promise.all(sourceFields.welcomeGifts.map(g => translateSegmentWithFallback(g, meta, allowNetwork))),
    Promise.all(sourceFields.features.map(f => translateSegmentWithFallback(f, meta, allowNetwork))),
    Promise.all(sourceFields.highlights.map(h => translateSegmentWithFallback(h, meta, allowNetwork))),
  ]);

  const allSegments = [
    titleRes,
    locationRes,
    typeRes,
    descRes,
    hostMsgRes,
    bookingHoursRes,
    settlementRes,
    instantRes,
    ...giftsArr,
    ...featuresArr,
    ...highlightsArr,
  ];
  usedOpenWebCount = allSegments.filter(s => s.usedOpenWeb).length;

  const engine: TranslationOutcome['engine'] =
    usedOpenWebCount === 0
      ? 'offline-dictionary'
      : usedOpenWebCount === allSegments.length
      ? 'free-open-translator'
      : 'hybrid-free';

  return {
    language: meta.canonical,
    engine,
    translated: {
      title: titleRes.text || sourceFields.title,
      location: locationRes.text || sourceFields.location,
      type: typeRes.text || sourceFields.type,
      description: descRes.text ?? sourceFields.description,
      hostMessage: hostMsgRes.text ?? sourceFields.hostMessage,
      welcomeGifts: giftsArr.map((g, i) => g.text || sourceFields.welcomeGifts[i]),
      features: featuresArr.map((f, i) => f.text || sourceFields.features[i]),
      highlights: highlightsArr.map((h, i) => h.text || sourceFields.highlights[i]),
      bookingHoursText: bookingHoursRes.text || sourceFields.bookingHoursText,
      directSettlementText: settlementRes.text || sourceFields.directSettlementText,
      priceText: priceText || sourceFields.priceText,
      instantBookLabel: instantRes.text || sourceFields.instantBookLabel,
    },
  };
}
