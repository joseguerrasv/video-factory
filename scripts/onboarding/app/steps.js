export const VIBES = [
  { value: 'dark-premium', label: 'Dark premium', hint: 'Cinematic, tech, finance', swatches: ['#0B090A', '#14213D', '#FCA311', '#E5E5E5'] },
  { value: 'clean-corporate', label: 'Clean corporate', hint: 'Tutorials, explainers, B2B', swatches: ['#FFFCF2', '#403D39', '#EB5E28', '#CCC5B9'] },
  { value: 'bold-energetic', label: 'Bold and energetic', hint: 'Launches, social, hype', swatches: ['#3A86FF', '#FF006E', '#FFBE0B', '#FB5607'] },
  { value: 'warm-editorial', label: 'Warm editorial', hint: 'Stories, documentaries', swatches: ['#264653', '#2A9D8F', '#E9C46A', '#E76F51'] },
  { value: 'neon-electric', label: 'Neon electric', hint: 'Gaming, nightlife, Gen Z', swatches: ['#3A0CA3', '#F72585', '#70D6FF', '#FF9770'] },
  { value: 'monochrome', label: 'Monochrome', hint: 'Type-led, serious', swatches: ['#F8F9FA', '#ADB5BD', '#495057', '#212529'] },
  { value: 'pastel-soft', label: 'Pastel soft', hint: 'Lifestyle, beauty, wellness', swatches: ['#FEFAE0', '#FFC8DD', '#BDE0FE', '#CDB4DB'] },
  { value: 'nature-earth', label: 'Nature and earth', hint: 'Outdoor, organic', swatches: ['#283618', '#606C38', '#FEFAE0', '#DDA15E'] },
  { value: 'jewel-rich', label: 'Jewel rich', hint: 'Luxury, events', swatches: ['#0F4C5C', '#5F0F40', '#9A031E', '#FB8B24'] },
];

export const FONTS = [
  { family: 'Geist', category: 'Sans' },
  { family: 'Inter', category: 'Sans' },
  { family: 'Manrope', category: 'Sans' },
  { family: 'DM Sans', category: 'Sans' },
  { family: 'Plus Jakarta Sans', category: 'Sans' },
  { family: 'Space Grotesk', category: 'Grotesk' },
  { family: 'Bricolage Grotesque', category: 'Grotesk' },
  { family: 'Sora', category: 'Geometric' },
  { family: 'Outfit', category: 'Geometric' },
  { family: 'Montserrat', category: 'Geometric' },
  { family: 'Poppins', category: 'Geometric' },
  { family: 'Archivo', category: 'Sans' },
  { family: 'Barlow', category: 'Sans' },
  { family: 'IBM Plex Sans', category: 'Sans' },
  { family: 'Work Sans', category: 'Sans' },
  { family: 'Syne', category: 'Display' },
  { family: 'Unbounded', category: 'Display' },
  { family: 'Anton', category: 'Condensed' },
  { family: 'Bebas Neue', category: 'Condensed' },
  { family: 'Oswald', category: 'Condensed' },
  { family: 'Playfair Display', category: 'Serif' },
  { family: 'DM Serif Display', category: 'Serif' },
  { family: 'EB Garamond', category: 'Serif' },
  { family: 'Source Serif 4', category: 'Serif' },
  { family: 'JetBrains Mono', category: 'Mono' },
  { family: 'Space Mono', category: 'Mono' },
];

export const PROVIDER_KEYS = {
  elevenlabs: 'ELEVENLABS_API_KEY',
  groq: 'GROQ_API_KEY',
  openai: 'OPENAI_API_KEY',
  local: null,
};

export const SERVICE_KEYS = [
  { key: 'ELEVENLABS_API_KEY', label: 'ElevenLabs', use: 'Best transcription, voiceover and sound effects', where: 'elevenlabs.io/app/settings/api-keys' },
  { key: 'KIE_API_KEY', label: 'Kie.ai', use: 'AI images, B-roll video clips and music (Kling, Veo, Suno)', where: 'kie.ai, under API Keys in the dashboard' },
  { key: 'GROQ_API_KEY', label: 'Groq', use: 'Fast, low-cost Whisper transcription', where: 'console.groq.com/keys' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI', use: 'Whisper transcription fallback', where: 'platform.openai.com/api-keys' },
  { key: 'PEXELS_API_KEY', label: 'Pexels', use: 'Free stock footage and photos for B-roll', where: 'pexels.com/api' },
];



export const STEPS = [
  {
    id: 'welcome',
    nav: 'Welcome',
    custom: 'welcome',
  },
  {
    id: 'basics',
    nav: 'The basics',
    title: 'Who are we editing for?',
    lead: 'The name and details that show up in titles, lower thirds and end cards.',
    fields: [
      { id: 'identity.name', type: 'text', label: 'Brand or creator name', placeholder: 'Northline Studio', required: true, autofocus: true },
      { id: 'identity.slug', type: 'slug', label: 'Folder name', help: 'Used for brands/<name>/ in this repo. Lowercase, dashes only.' },
      { id: 'identity.tagline', type: 'text', label: 'What you do, in one sentence', placeholder: 'We help indie founders ship their first SaaS in 30 days' },
      { id: 'identity.type', type: 'chips', label: 'What kind of brand is this?', options: [
        { value: 'creator', label: 'Personal creator' },
        { value: 'company', label: 'Company or product' },
        { value: 'agency', label: 'Agency or client work' },
        { value: 'education', label: 'Education or course' },
        { value: 'other', label: 'Something else' },
      ] },
      { id: 'identity.website', type: 'url', label: 'Website', placeholder: 'https://', help: 'Claude can pull screenshots, colors and product shots from here.' },
      { row: [
        { id: 'identity.host.name', type: 'text', label: 'Who is usually on camera?', placeholder: 'Maya Okafor' },
        { id: 'identity.host.title', type: 'text', label: 'Their title for name captions', placeholder: 'Founder, Northline' },
      ] },
      { id: 'identity.language', type: 'select', label: 'Main spoken language', options: [
        'English', 'Spanish', 'Portuguese', 'French', 'German', 'Italian', 'Dutch', 'Polish', 'Ukrainian', 'Turkish', 'Arabic', 'Hindi', 'Japanese', 'Korean', 'Chinese', 'Other',
      ].map((v) => ({ value: v, label: v })) },
      { id: 'identity.handles', type: 'handles', label: 'Handles to show on screen', help: 'Optional. Used for end cards and social overlays.', handles: ['youtube', 'instagram', 'tiktok', 'x', 'linkedin'] },
    ],
  },
  {
    id: 'audience',
    nav: 'Audience and voice',
    title: 'Who watches, and how should it feel?',
    lead: 'This sets pacing, wording on screen and how loud the edit gets.',
    fields: [
      { id: 'audience.who', type: 'textarea', label: 'Describe your viewer', placeholder: 'Solo founders, 25 to 40, technical enough to code but short on time. They want proof, not hype.' },
      { id: 'audience.level', type: 'chips', label: 'How much do they already know?', options: [
        { value: 'beginner', label: 'Beginners' },
        { value: 'intermediate', label: 'Intermediate' },
        { value: 'expert', label: 'Experts' },
        { value: 'mixed', label: 'A mix' },
      ] },
      { id: 'voice.energy', type: 'slider', label: 'Energy', left: 'Calm', right: 'High energy' },
      { id: 'voice.playful', type: 'slider', label: 'Tone', left: 'Serious', right: 'Playful' },
      { id: 'voice.bold', type: 'slider', label: 'Visual volume', left: 'Minimal', right: 'Bold' },
      { id: 'voice.polish', type: 'slider', label: 'Finish', left: 'Raw and real', right: 'Polished' },
      { id: 'voice.adjectives', type: 'chips', multi: true, max: 3, label: 'Pick up to three words for your brand', options: [
        'Confident', 'Friendly', 'Premium', 'Technical', 'Witty', 'Inspiring', 'Direct', 'Calm', 'Rebellious', 'Warm', 'Nerdy', 'Luxurious', 'Honest', 'Fast',
      ].map((v) => ({ value: v.toLowerCase(), label: v })) },
      { id: 'voice.cta', type: 'text', label: 'Your usual call to action', placeholder: 'Join the free community, link in the description' },
    ],
  },
  {
    id: 'formats',
    nav: 'What you make',
    title: 'What are we making?',
    lead: 'Pick every format you publish. Claude builds a template for each.',
    fields: [
      { id: 'formats.selected', type: 'cards', multi: true, label: 'Formats', options: [
        { value: 'youtube', label: 'YouTube videos', hint: '16:9, long form', icon: 'youtube-logo' },
        { value: 'shorts', label: 'Shorts, Reels, TikTok', hint: '9:16, under 90s', icon: 'device-mobile' },
        { value: 'course', label: 'Course lessons', hint: '16:9, teaching', icon: 'graduation-cap' },
        { value: 'podcast', label: 'Podcast clips', hint: 'Multi-speaker', icon: 'microphone' },
        { value: 'ads', label: 'Product demos and ads', hint: 'Short, persuasive', icon: 'megaphone' },
        { value: 'showreel', label: 'Showreels and brand films', hint: 'Music-led', icon: 'film-strip' },
        { value: 'social', label: 'LinkedIn and X videos', hint: '1:1 or 4:5', icon: 'square' },
        { value: 'events', label: 'Webinars and event recaps', hint: 'Long raw footage', icon: 'presentation' },
      ] },
      { id: 'formats.primary', type: 'select', label: 'Which one matters most right now?', optionsFrom: 'formats.selected', showIf: (a) => (a.formats?.selected?.length ?? 0) > 1 },
      { id: 'formats.footage', type: 'chips', multi: true, label: 'What does your raw footage usually look like?', options: [
        { value: 'talking-head', label: 'Talking head' },
        { value: 'screen', label: 'Screen recordings' },
        { value: 'interview', label: 'Podcast or interview' },
        { value: 'vlog', label: 'Vlog and B-roll' },
        { value: 'product', label: 'Product shots' },
        { value: 'slides', label: 'Slides or webinar' },
      ] },
      { id: 'formats.camera', type: 'chips', label: 'What do you film on?', options: [
        { value: 'phone', label: 'Phone' },
        { value: 'webcam', label: 'Webcam' },
        { value: 'camera', label: 'Mirrorless or DSLR' },
        { value: 'mixed', label: 'A mix' },
      ] },
      { id: 'formats.quality', type: 'chips', label: 'Export quality', options: [
        { value: '1080p30', label: '1080p, 30 fps' },
        { value: '1080p60', label: '1080p, 60 fps' },
        { value: '4k30', label: '4K, 30 fps' },
      ] },
    ],
  },
  {
    id: 'look',
    nav: 'Look and feel',
    title: 'How should it look?',
    lead: 'Upload what you have. The preview on the right updates as you go.',
    fields: [
      { id: 'visual.logos', type: 'upload', label: 'Logo', kind: 'logo', accept: '.svg,.png,.webp,.jpg,.jpeg', multiple: true, help: 'SVG or transparent PNG works best. Add a light and a dark version if you have both.' },
      { id: 'visual.colors', type: 'palette', label: 'Brand colors', help: 'Upload a logo to get suggestions, or pick your own.' },
      { id: 'visual.theme', type: 'chips', label: 'Default canvas', options: [
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' },
        { value: 'both', label: 'Depends on the video' },
      ] },
      { row: [
        { id: 'visual.fonts.heading', type: 'font', label: 'Headline font' },
        { id: 'visual.fonts.body', type: 'font', label: 'Body font' },
      ] },
      { id: 'visual.fontFiles', type: 'upload', label: 'Custom font files', kind: 'font', accept: '.woff2,.woff,.ttf,.otf', multiple: true, help: 'Optional. Use this for licensed brand fonts. They appear in the font menus above.' },
      { id: 'visual.vibe', type: 'cards', label: 'Closest overall vibe', swatches: true, options: VIBES },
      { id: 'visual.guidelines', type: 'upload', label: 'Brand guidelines', kind: 'guidelines', accept: '.pdf,.png,.jpg,.jpeg,.webp', multiple: true, help: 'Optional. A PDF or image of your brand book.' },
    ],
  },
  {
    id: 'editing',
    nav: 'Editing style',
    title: 'How do you like it cut?',
    lead: 'These become the default settings for every edit. You can override them per video.',
    fields: [
      { id: 'editing.pacing', type: 'slider', label: 'Pacing', left: 'Let it breathe', right: 'Tight and punchy', help: 'Controls how much silence and dead air gets removed.' },
      { row: [
        { id: 'editing.removeFillers', type: 'toggle', label: 'Cut filler words', help: 'Um, uh, you know' },
        { id: 'editing.removeRetakes', type: 'toggle', label: 'Cut retakes and false starts', help: 'Keeps the best take' },
      ] },
      { id: 'editing.captions.style', type: 'cards', label: 'Captions', preview: 'caption', options: [
        { value: 'none', label: 'No captions', hint: 'Clean picture' },
        { value: 'clean', label: 'Clean subtitles', hint: 'Sentence case, bottom' },
        { value: 'pop', label: 'Bold word pop', hint: 'Big, few words at a time' },
        { value: 'karaoke', label: 'Karaoke highlight', hint: 'Words light up as spoken' },
        { value: 'cinematic', label: 'Cinematic', hint: 'Large type behind you' },
      ] },
      { id: 'editing.captions.position', type: 'chips', label: 'Caption position', showIf: (a) => a.editing?.captions?.style && a.editing.captions.style !== 'none', options: [
        { value: 'bottom', label: 'Bottom' },
        { value: 'center', label: 'Center' },
        { value: 'auto', label: 'Wherever it is clear' },
      ] },
      { id: 'editing.motion', type: 'chips', label: 'Motion graphics', options: [
        { value: 'minimal', label: 'Minimal', hint: 'Titles and lower thirds' },
        { value: 'balanced', label: 'Balanced', hint: 'Callouts on key points' },
        { value: 'high', label: 'High energy', hint: 'Something on screen often' },
      ] },
      { id: 'editing.broll.density', type: 'chips', label: 'How much B-roll?', options: [
        { value: 'none', label: 'None' },
        { value: 'light', label: 'Light' },
        { value: 'medium', label: 'Medium' },
        { value: 'heavy', label: 'Heavy' },
      ] },
      { id: 'editing.broll.sources', type: 'chips', multi: true, label: 'Where can B-roll come from?', showIf: (a) => a.editing?.broll?.density !== 'none', options: [
        { value: 'own', label: 'My own footage' },
        { value: 'stock', label: 'Stock footage' },
        { value: 'ai', label: 'AI generated' },
        { value: 'web', label: 'Screenshots and screen recordings' },
      ] },
      { id: 'editing.faceTreatments', type: 'chips', multi: true, label: 'Camera treatments you like', options: [
        { value: 'punch-in', label: 'Punch-in zooms' },
        { value: 'split', label: 'Split screen' },
        { value: 'bubble', label: 'Round face bubble' },
        { value: 'takeover', label: 'Full-screen graphics' },
        { value: 'side-panel', label: 'Side panels' },
      ] },
      { row: [
        { id: 'editing.music.mood', type: 'select', label: 'Music', options: [
          { value: 'none', label: 'No music' },
          { value: 'subtle', label: 'Subtle bed under speech' },
          { value: 'upbeat', label: 'Upbeat and driving' },
          { value: 'cinematic', label: 'Cinematic' },
        ] },
        { id: 'editing.music.source', type: 'select', label: 'Music source', showIf: (a) => a.editing?.music?.mood !== 'none', options: [
          { value: 'generated', label: 'AI generated (Suno)' },
          { value: 'library', label: 'My own library' },
          { value: 'stock', label: 'Royalty-free stock' },
        ] },
      ] },
      { row: [
        { id: 'editing.sfx', type: 'select', label: 'Sound effects', options: [
          { value: 'none', label: 'None' },
          { value: 'subtle', label: 'Subtle' },
          { value: 'rich', label: 'Rich' },
        ] },
        { id: 'editing.transitions', type: 'select', label: 'Transitions', options: [
          { value: 'cuts', label: 'Hard cuts only' },
          { value: 'subtle', label: 'Subtle' },
          { value: 'stylized', label: 'Stylized' },
        ] },
      ] },
    ],
  },
  {
    id: 'taste',
    nav: 'Your taste',
    title: 'Show Claude what good looks like',
    lead: 'References teach style faster than any description. Dislikes become hard rules.',
    fields: [
      { id: 'taste.references', type: 'references', label: 'Videos you love', help: 'Paste links and say what you love about each. Claude can watch them and turn them into a style guide.' },
      { id: 'taste.admire', type: 'text', label: 'Creators or brands whose edits you admire', placeholder: 'Ali Abdaal, Johnny Harris, Apple keynotes' },
      { id: 'taste.dislikes', type: 'chips', multi: true, label: 'Never do this', options: [
        'Emojis on screen', 'Constant zooms', 'Meme sound effects', 'Cheesy stock footage', 'Flashy transitions', 'Walls of text', 'Busy backgrounds', 'Robotic AI voice', 'Whoosh on every cut', 'Clickbait styling', 'Neon glow', 'Shaky text animations',
      ].map((v) => ({ value: v, label: v })) },
      { id: 'taste.never', type: 'textarea', label: 'Anything else you never want to see?', placeholder: 'Graphics covering my face. Red and green together. Comic Sans.' },
    ],
  },
  {
    id: 'services',
    nav: 'Services and keys',
    title: 'Connect your tools',
    lead: 'Keys are written to the .env file in this repo and never committed. Skip anything you do not use.',
    fields: [
      { id: 'services.transcription', type: 'cards', label: 'Transcription', options: [
        { value: 'elevenlabs', label: 'ElevenLabs Scribe', hint: 'Most accurate, paid' },
        { value: 'groq', label: 'Groq Whisper', hint: 'Fast and cheap' },
        { value: 'openai', label: 'OpenAI Whisper', hint: 'Reliable fallback' },
        { value: 'local', label: 'On this computer', hint: 'Free and private, slower' },
      ] },
      { id: 'services.keys', type: 'secrets', label: 'API keys' },
      { id: 'services.spend.mode', type: 'chips', label: 'Paid generations (AI images, video, music)', options: [
        { value: 'ask', label: 'Always ask me first' },
        { value: 'cap', label: 'Auto-approve up to a budget' },
        { value: 'never', label: 'Never use paid generation' },
      ] },
      { id: 'services.spend.capUsd', type: 'number', label: 'Budget per video (USD)', min: 1, max: 500, placeholder: '5', showIf: (a) => a.services?.spend?.mode === 'cap' },
    ],
  },
  {
    id: 'workflow',
    nav: 'Workflow',
    title: 'How involved do you want to be?',
    lead: 'Claude always checks its own renders before showing you. This decides where it stops for you.',
    fields: [
      { id: 'workflow.autonomy', type: 'cards', label: 'Working style', options: [
        { value: 'hands-on', label: 'Check with me at each step', hint: 'Approve cuts, plan and assets' },
        { value: 'plan-first', label: 'Show me the plan, then run', hint: 'One approval, then a finished draft' },
        { value: 'autopilot', label: 'Autopilot', hint: 'Just show me the result' },
      ] },
      { id: 'workflow.checkpoints', type: 'chips', multi: true, label: 'Always stop for these', showIf: (a) => a.workflow?.autonomy !== 'autopilot', options: [
        { value: 'cuts', label: 'Cut list review' },
        { value: 'beats', label: 'Storyboard and beat plan' },
        { value: 'assets', label: 'Paid assets' },
        { value: 'draft', label: 'Draft render' },
      ] },
      { id: 'workflow.deliverables', type: 'chips', multi: true, label: 'What should every finished video include?', options: [
        { value: 'mp4', label: 'MP4 (H.264)' },
        { value: 'hevc', label: 'HEVC for smaller files' },
        { value: 'prores', label: 'ProRes master' },
        { value: 'srt', label: 'SRT captions file' },
        { value: 'thumbs', label: 'Thumbnail stills' },
        { value: 'vertical', label: 'Vertical cutdown' },
      ] },
      { id: 'workflow.notes', type: 'textarea', label: 'Anything else Claude should know?', placeholder: 'I record in batches on Mondays. Always keep my intro line. My audience watches on mobile.' },
    ],
  },
  {
    id: 'review',
    nav: 'Review',
    custom: 'review',
  },
];

export const DEFAULTS = {
  identity: { language: 'English', type: 'creator', host: {}, handles: {} },
  audience: { level: 'mixed' },
  voice: { energy: 55, playful: 40, bold: 50, polish: 70, adjectives: [] },
  formats: { selected: ['youtube', 'shorts'], footage: ['talking-head'], camera: 'camera', quality: '1080p30' },
  visual: { logos: [], fontFiles: [], guidelines: [], colors: { background: '#0E0F12', text: '#F4F4F5', primary: '#3B82F6', accent: '#F59E0B' }, theme: 'dark', fonts: { heading: 'Geist', body: 'Geist' }, vibe: 'dark-premium' },
  editing: {
    pacing: 60, removeFillers: true, removeRetakes: true,
    captions: { style: 'pop', position: 'bottom' },
    motion: 'balanced',
    broll: { density: 'medium', sources: ['own', 'web', 'ai'] },
    faceTreatments: ['punch-in', 'bubble'],
    music: { mood: 'subtle', source: 'generated' },
    sfx: 'subtle', transitions: 'subtle',
  },
  taste: { references: [{ url: '', note: '' }], dislikes: [] },
  services: { transcription: 'groq', spend: { mode: 'ask' } },
  workflow: { autonomy: 'plan-first', checkpoints: ['cuts', 'assets'], deliverables: ['mp4', 'srt'] },
};

export const FORMAT_LABELS = Object.fromEntries(STEPS.find((s) => s.id === 'formats').fields[0].options.map((o) => [o.value, o.label]));


