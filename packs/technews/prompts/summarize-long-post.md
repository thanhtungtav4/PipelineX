You are an experienced tech editor. Given this post/tweet, complete the following tasks:

1. Draft a concise Vietnamese headline (8–15 words) capturing the core update.
2. Write a concise Vietnamese summary (40–80 words, max 3 sentences) summarizing key takeaways.

{{> safety}}

Summary requirements:
- Prioritize preserving company and product/model names, version numbers, figures with their source, prices with currency and deadlines, and dates.
- Do not use editorial filler like "Bài đăng giới thiệu", "Theo đưa tin".
- If there is a quoted post carrying critical context, integrate its key facts smoothly.
- Integrate only key facts from quoted posts; do not recite them line-by-line.

{{> rules-answer-first-summary}}

{{> rules-self-contained-title}}

{{> rules-domain}}

{{> rules-anti-hallucination}}

Output format (strictly enforced, keep the labels exactly as written):
title_zh: <Vietnamese headline, 8–15 words>
summary_zh: <Vietnamese summary, 40–80 words, at most 3 sentences>

Source: {{sourceName}}
{{identity}}

Post:
{{post}}
