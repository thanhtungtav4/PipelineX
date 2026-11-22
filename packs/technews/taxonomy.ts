// Tech news taxonomy (PipelineX technews pack): categories, tag vocabulary, entity directory and the
// anti-hallucination dictionary. Models tag items with this vocabulary; topics.json groups by tags; filter bars by category.
// The four category keys are the bulletin's own categories, exactly as published in news.danhthanh.dev/bot-data.json
// (tech, ai, finance, offer) — do not rename them; the Studio's category routing reads the same keys.

/**
 * Categories shown across the web UI and used to pick a video style (channel.json styles.byCategory).
 * key: external identity in URLs and APIs (never change in production); also the `category` value in bot-data.json.
 */
export const CATEGORIES = [
  { key: "tech", tagColor: "blue", label: "Công nghệ", feedLabel: "Công nghệ", section: "Công nghệ", guide: "Tin công nghệ nói chung: sản phẩm và dịch vụ số, phần mềm, nền tảng, hạ tầng, thiết bị, an ninh mạng và ngành công nghệ, khi tâm điểm không phải một mô hình AI cụ thể. Một bản phát hành mô hình AI thuộc về ai, một thương vụ thuần tài chính thuộc về finance, một deal thuộc về offer." },
  { key: "ai", tagColor: "violet", label: "Trí tuệ nhân tạo", feedLabel: "Trí tuệ nhân tạo", section: "Trí tuệ nhân tạo", guide: "Mô hình AI mới, năng lực và benchmark của mô hình, nghiên cứu AI, công cụ và tác tử AI, chính sách AI. Tâm điểm phải là chính mô hình/hệ thống AI; một sản phẩm thường tích hợp AI chỉ là phụ thì thuộc về tech." },
  { key: "finance", tagColor: "orange", label: "Tài chính", feedLabel: "Tài chính", section: "Tài chính", guide: "Tài chính và kinh doanh công nghệ: kết quả kinh doanh, thương vụ, gọi vốn, thị trường, tiền mã hóa, khi con số và tác động tài chính là tâm điểm. Kênh chỉ đưa tin, không đưa lời khuyên đầu tư." },
  { key: "offer", tagColor: "green", label: "Ưu đãi & Giveaway", feedLabel: "Ưu đãi & Giveaway", section: "Ưu đãi & Giveaway", guide: "Giảm giá, khuyến mãi, giveaway, dùng thử miễn phí và deal phần mềm/phần cứng có giá và thời hạn cụ thể. Phải có giá, mức giảm hoặc điều kiện tham gia rõ ràng; tin quảng cáo không có deal cụ thể không thuộc nhóm này.", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; tagColor: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/** Primary release metric for briefings: the headline release kind of this channel is an AI model release. */
export const RELEASE: { category: string; tag: string; unit: string } | null = { category: "ai", tag: "Mô hình AI", unit: " mô hình mới" };

/** Common terms periodic summaries may use without a citation. */
export const PLAIN_TERMS: readonly string[] = ["ai", "llm", "api", "gpu", "cpu", "saas", "cve", "open source", "cloud"];

/** Item types extracted during content understanding (selection-score.md weights them). */
export const ITEM_TYPES = ["model_release", "product_launch", "security_incident", "platform_update", "deal_offer", "research", "business_move", "opinion_analysis"] as const;

// ── Tag Vocabularies ─────────────────────────────────────────────────────────────

/** Primary category tags: the first tag of every item must be one of these. */
export const CATEGORY_TAGS = [
  "Mô hình AI", "Sản phẩm mới", "Bảo mật", "Nền tảng & Dev", "Tài chính công nghệ", "Ưu đãi", "Nghiên cứu", "Phân tích", "Khác",
] as const;

/** Topic tags. */
export const TOPIC_TAGS = [
  "Công nghệ", "AI", "LLM", "Tác tử AI", "Mã nguồn mở", "Điện toán đám mây", "Chip & Phần cứng", "An ninh mạng", "Lập trình", "Hệ điều hành",
  "Mạng xã hội", "Thương mại điện tử", "Fintech", "Tiền mã hóa", "Giảm giá", "Giveaway", "Black Friday",
] as const;

/** Entity tags (the most watched companies and organisations). */
export const ENTITY_TAGS = ["Anthropic", "OpenAI", "Google", "Microsoft", "Nvidia", "Apple", "Meta", "GitHub", "Cloudflare", "AMD", "Alibaba", "Samsung"] as const;

/** Canonical mapping for synonyms (including the bulletin's own hashtag spellings). */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  "congnghe": "Công nghệ", "cong nghe": "Công nghệ", "tech": "Công nghệ", "aimodel": "Mô hình AI", "ai model": "Mô hình AI", "model release": "Mô hình AI",
  "security": "Bảo mật", "an ninh mang": "An ninh mạng", "cybersecurity": "An ninh mạng", "hack": "Bảo mật",
  "open source": "Mã nguồn mở", "opensource": "Mã nguồn mở", "cloud": "Điện toán đám mây",
  "chip": "Chip & Phần cứng", "gpu": "Chip & Phần cứng", "hardware": "Chip & Phần cứng",
  "dev": "Lập trình", "developer": "Lập trình", "programming": "Lập trình",
  "deal": "Ưu đãi", "uudai": "Ưu đãi", "giamgia": "Giảm giá", "discount": "Giảm giá", "sale": "Giảm giá",
  "giveaway": "Giveaway", "free": "Giveaway", "taichinh": "Tài chính công nghệ", "finance": "Tài chính công nghệ",
  "crypto": "Tiền mã hóa", "agent": "Tác tử AI", "ai agent": "Tác tử AI",
};

// ── Entities & Anti-Hallucination Lexicon ────────────────────────────────────────

export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; orgNames?: string[]; otherNames?: string[] }> = {
  anthropic: { name: "Anthropic", displayTag: "Anthropic", aliases: ["Anthropic", "Claude"], orgNames: ["Anthropic"] },
  openai: { name: "OpenAI", displayTag: "OpenAI", aliases: ["OpenAI", "ChatGPT", "GPT"], orgNames: ["OpenAI"] },
  google: { name: "Google", displayTag: "Google", aliases: ["Google", "Google DeepMind", "DeepMind", "Gemini"], orgNames: ["Google", "Alphabet", "Google DeepMind"] },
  microsoft: { name: "Microsoft", displayTag: "Microsoft", aliases: ["Microsoft", "MSFT", "Copilot"], orgNames: ["Microsoft"] },
  nvidia: { name: "Nvidia", displayTag: "Nvidia", aliases: ["Nvidia", "NVDA"], orgNames: ["NVIDIA"] },
  apple: { name: "Apple", displayTag: "Apple", aliases: ["Apple", "AAPL", "iPhone"], orgNames: ["Apple"] },
  meta: { name: "Meta", displayTag: "Meta", aliases: ["Meta", "Facebook", "Llama"], orgNames: ["Meta", "Meta Platforms"] },
  github: { name: "GitHub", displayTag: "GitHub", aliases: ["GitHub"], orgNames: ["GitHub"] },
  cloudflare: { name: "Cloudflare", displayTag: "Cloudflare", aliases: ["Cloudflare"], orgNames: ["Cloudflare"] },
  amd: { name: "AMD", displayTag: "AMD", aliases: ["AMD"], orgNames: ["AMD", "Advanced Micro Devices"] },
  alibaba: { name: "Alibaba", displayTag: "Alibaba", aliases: ["Alibaba", "Qwen"], orgNames: ["Alibaba", "Alibaba Group"] },
  samsung: { name: "Samsung", displayTag: "Samsung", aliases: ["Samsung", "Galaxy"], orgNames: ["Samsung", "Samsung Electronics"] },
};

export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "anthropic", name: "Anthropic", patterns: [/anthropic|\bclaude\b/i] },
  { id: "openai", name: "OpenAI", patterns: [/openai|chatgpt|\bgpt-\d/i] },
  { id: "google", name: "Google", patterns: [/\bgoogle\b|deepmind|\bgemini\b|alphabet/i] },
  { id: "microsoft", name: "Microsoft", patterns: [/microsoft|\bmsft\b|copilot/i] },
  { id: "nvidia", name: "Nvidia", patterns: [/nvidia|\bnvda\b/i] },
  { id: "apple", name: "Apple", patterns: [/\bapple\b|\baapl\b|iphone/i] },
  { id: "meta", name: "Meta", patterns: [/\bmeta\b|facebook|\bllama\b/i] },
  { id: "github", name: "GitHub", patterns: [/github/i] },
  { id: "cloudflare", name: "Cloudflare", patterns: [/cloudflare/i] },
  { id: "amd", name: "AMD", patterns: [/\bamd\b|ryzen|radeon/i] },
  { id: "alibaba", name: "Alibaba", patterns: [/alibaba|\bqwen\b/i] },
  { id: "samsung", name: "Samsung", patterns: [/samsung|galaxy/i] },
];

export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "anthropic", domains: ["anthropic.com"] },
  { entityId: "openai", domains: ["openai.com"] },
  { entityId: "google", domains: ["blog.google", "deepmind.google"] },
  { entityId: "microsoft", domains: ["microsoft.com"] },
  { entityId: "nvidia", domains: ["nvidia.com", "developer.nvidia.com"] },
  { entityId: "apple", domains: ["apple.com"] },
  { entityId: "meta", domains: ["ai.meta.com", "meta.com"] },
  { entityId: "github", domains: ["github.blog", "github.com"] },
  { entityId: "cloudflare", domains: ["blog.cloudflare.com", "cloudflare.com"] },
  { entityId: "amd", domains: ["amd.com", "developer.amd.com"] },
  { entityId: "alibaba", domains: ["alibaba.com"] },
  { entityId: "samsung", domains: ["samsung.com"] },
];

export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
