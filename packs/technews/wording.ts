// Disallowed wording patterns for reader-facing text ([pattern, replacement instruction]).
// Checked after drafting headlines, summaries, and editorial rationales; matches trigger a mend-wording pass.
// Technews: the channel reports tech news in Vietnamese; it never hypes, never promises giveaway outcomes,
// and never gives investment advice on its finance items.

export const READER_WORDING: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(không thể tin được|gây sốc|sốc nặng|kinh hoàng)\b/i, "Bỏ từ ngữ giật gân; nêu thẳng sự việc và con số như nguồn đã đưa."],
  [/\b(chắc chắn (nhận|trúng|thắng)|đảm bảo (nhận|trúng) (quà|thưởng))\b/i, "Không hứa kết quả giveaway; nêu điều kiện và thời hạn tham gia như nguồn đã công bố."],
  [/\b(nên (mua|bán|đầu tư)|cơ hội (làm giàu|x\d+ tài khoản)|cam kết lợi nhuận)\b/i, "Bỏ lời khuyên đầu tư; chỉ đưa tin và ghi rõ nguồn của con số."],
  [/\b(đỉnh cao|đẳng cấp nhất|tốt nhất mọi thời đại|vô đối)\b/i, "Bỏ từ ngữ quảng cáo tuyệt đối; mô tả trung tính tính năng và số liệu như nguồn đã đưa."],
];
