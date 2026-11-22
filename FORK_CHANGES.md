# FORK_CHANGES — các chỗ sửa lõi AIHOT

Mọi thay đổi ngoài `modules/`, `site/`, `industry/` ghi ở đây để khi lấy cập nhật từ upstream biết chỗ nào phải xem lại.

| Ngày | File | Thay đổi | Lý do |
|---|---|---|---|
| 2026-11-17 | `apps/worker/src/schedules.ts` | Lịch `content.translate` thêm `when: TRANSLATE_ENABLED !== "false"` | Site tiếng Anh: không dịch bài sang tiếng Trung (tốn lượt gọi model vô ích) |
| 2026-11-17 | `.env.example` | Khai báo `TRANSLATE_ENABLED`, `VIDEO_MIN_SOURCES` | Test kiến trúc yêu cầu mọi biến môi trường phải có trong template |
| 2026-11-17 | `apps/web/**` | Gemini dịch chữ giao diện sang tiếng Anh. Riêng khóa `kind` của changelog (`更新/优化/公告/下线`) vẫn giữ tiếng Trung vì nó là kiểu dữ liệu dùng chung với `packages/contracts` | Giao diện tiếng Anh |
| 2026-11-17 | `tests/analyze`, `category-corrections`, `topics` | Đổi tên tag/danh mục/chủ đề trong test sang taxonomy tiếng Anh | AGENTS.md: đổi `industry/taxonomy.ts` thì phải sửa test theo |
| 2026-11-17 | `modules/video/tests/candidates.test.ts` | Test tự tạo nguồn riêng, không dựa vào dữ liệu seed | Chạy được trên DB test trống |

## Không sửa lõi (cố ý)

- `packages/**`, `apps/api/**`, `tests/**`, `scripts/**`: **giữ nguyên bản gốc tiếng Trung**. Bản Gemini dịch các thư mục này làm 74 test lỗi, vì có những chuỗi mà code dùng để so khớp đã bị dịch. Bản dịch đó được lưu ở `backups/gemini-backend-translation.patch`. Khi cần chữ tiếng Anh ở backend (cảnh báo, lý do hiển thị cho admin), dịch dần từng file và chạy test của file đó.
- `LICENSE`, `NOTICE`: giữ nguyên dòng bản quyền gốc, theo yêu cầu của giấy phép MIT.

## Ghi chú `industry/` (không phải lõi, nhưng phải cẩn thận)

- `taxonomy.ts`: Gemini đã dịch và xóa nhầm vài mục nhận diện công ty. Đã khôi phục tên gọi khác của xAI (`SpaceXAI`, `SpaceXSI`) và các mẫu nhận diện Hunyuan, Doubao, Baidu ERNIE.
- `topics.json`: sửa tag của chủ đề `trends` (`phenomenon/trend` không tồn tại trong taxonomy, đổi thành `Trends`). Khôi phục tên công ty kèm sản phẩm (`Anthropic / Claude`…) để tìm kiếm theo tên sản phẩm vẫn ra. Sửa các tên bị dịch máy kém.

## Sửa lõi có chủ đích (2026-11-17, đợt 2)

| File | Thay đổi | Lý do |
|---|---|---|
| `packages/contracts/src/time.ts` | `monthDay` trả ngày tiếng Anh ("Nov 7", "Dec 31, 2025"); `WEEKDAYS` tiếng Anh | Giao diện tiếng Anh cần ngày tiếng Anh, nếu không sẽ lẫn kiểu "Included in 11月7日 AI 日报 · Top Story" |
| `packages/contracts/src/site.ts` | `REPORT_NAMES` = Daily/Weekly/Monthly; nhãn tháng "Oct 2026"; nhãn tuần "Sep 28 – Oct 4" | Như trên |
| `tests/page-links`, `page-metadata`, `selected-card`, `timeline-day-counts`, `mentions` | Đổi kết quả mong đợi sang tiếng Anh | Theo thay đổi ở trên và taxonomy tiếng Anh |

Ghi chú: `tests/outbound-protocol.standalone.test.ts` (route secure-proxy) lỗi trên **Node 26** nhưng đạt trên Node 24, kể cả với bản AIHOT gốc chưa sửa. Production phải chạy **Node 24 LTS**, đúng như AIHOT yêu cầu (`engines: node >=24.22.1`).

Test web (`npm run test:web`) cần trình duyệt Playwright đúng phiên bản: chạy `npx playwright install chromium webkit` một lần. Thiếu trình duyệt thì 23 test báo "Executable doesn't exist", còn `article-outline.test.ts` treo không có kết quả. `apps/web/tests/navigation-performance.test.ts` chờ tiêu đề trang chủ "Curated". Lưu ý: "精选" đang được dịch lẫn lộn thành "Curated" (menu, tiêu đề) và "Featured" (nút quay lại, badge), cần thống nhất khi làm cấu hình site.

## Cấu hình PipelineX (Phase 1)

| File | Thay đổi | Lý do |
|---|---|---|
| `industry/selection.ts` | Hạ cả thang: T1 60→**55**, T1_5 65→**58**, T2 76→**60**; class ecosystem 70→**58**, leaderboard 76→**60** (giữ thứ tự T1 < class < T2 mà framework và test yêu cầu) | Model chấm tin AI tiếng Anh thấp hơn feed tiếng Trung của AIHOT. Trên mẫu 103 bài T2 (17/11/2026), ngưỡng 76 chỉ chọn 3 bài (cùng một sự kiện), bỏ sót cả tin Anthropic ra model mới (69). Ở 60 có 27 bài / 11 sự kiện, đa số là tin thật. Hiệu chỉnh lại khi có bộ gold có nhãn. |
| `apps/web/app/**` (trừ admin) | "Featured" → "Curated" | Thống nhất tên trang tuyển chọn (gốc "精选"). Trong admin, "Featured" vẫn là tên chế độ nguồn `editorial`. |
| `apps/web/tests/cache.test.ts`, `navigation-performance.test.ts` | Mong đợi "Curated" | Theo thay đổi trên |
| `.env` (không commit) | `COLLECT_ENABLED=true` | Bắt đầu thu tin hằng ngày. Các công tắc Feishu/DingTalk/IndexNow/Baidu vẫn `false`; không có nguồn WeChat/X. |

Repo: nhánh `pipelinex`, remote AIHOT đổi tên thành `upstream` (lấy cập nhật bằng `git fetch upstream && git merge upstream/main`).

## Module video (`modules/video`, `renderer/`)

- Trang admin **/admin/videos** (module page `admin: true`): câu chuyện ứng viên, nút "Make video", danh sách video, trình phát, kịch bản, nguồn ảnh, log; Duyệt / Bỏ / Làm lại từ một bước.
- Bảng `video_jobs` (migration `2001`), hàng đợi `video.make` (1 video một lúc), lịch `video-daily` 09:30 khi `VIDEO_AUTO_ENABLED=true` (mặc định tắt).
- `renderer/`: các bước script (LLM) → assets (Pixabay/Openverse/Commons + kiểm tra bằng AI nhìn hình) → voice (edge-tts) → render (Remotion), mỗi video một thư mục `.data/videos/<id>/`. Phụ thuộc riêng (`renderer/node_modules`, `renderer/.venv`, `renderer/.env` chứa PIXABAY_API_KEY) không commit.
- Còn nợ: các lượt gọi LLM của video chưa ghi biên nhận (receipts) của AIHOT; edge-tts không có giấy phép thương mại (xem RESEARCH-PROCESS.md).
- Bước `dossier` (hồ sơ sự kiện từ toàn văn, có kiểm tra trích dẫn/con số) và `verify` (kiểm chứng từng câu, hiện trên trang Videos; lỗi kiểm chứng không làm hỏng video). Kết quả thử A/B: RESEARCH-PROCESS.md ở thư mục PipelineX.
- `packages/contracts/src/modules.ts`, `apps/web/app/routes.ts`, `apps/web/app/routes/admin/layout.tsx`, `module-layout.tsx`: trang admin của module có thể khai báo `shell: "engine"` (+ `group`) để nằm trong khung admin chính, ở đầu menu, thay vì khung riêng của module. Trang Videos dùng cách này (nhóm "Production"). Lý do: trang dùng hằng ngày, cần chuyển qua lại với Sources/Operations mà không đổi giao diện.

## Provider miễn phí trước, trả phí sau

- `site/models.ts`: preset `nvidia-nemotron` (NVIDIA API, miễn phí ~40 lượt/phút), `openrouter-free-nemotron` (`:free`, 20/phút, 1.000/ngày), `orcarouter-free-deepseek` (OrcaRouter free, chỉ chữ), `openrouter-nemotron` (trả phí) và `pipelinex-chain` = chuỗi theo thứ tự đó, cuối cùng là `default` (`LLM_*`). Code mặc định giữ như AIHOT (test chạy như upstream); `.env` chuyển 12 bước sang chuỗi (`PREFILTER_MODEL=pipelinex-chain`…).
- `packages/contracts/src/site-config.ts`: `ModelPreset.chain`. `packages/backend/src/providers/llm.ts`: `chatChain` thử từng thành viên, mỗi lượt có biên nhận; chuyển tiếp khi không có câu trả lời, chưa cấu hình, bị từ chối tài khoản hoặc gói free từ chối; câu trả lời hỏng thì không mua lại; lượt gọi có ảnh bỏ qua thành viên không đọc ảnh. Cặp chính/dự phòng gốc của AIHOT giữ nguyên luật (tài khoản bị từ chối không chuyển sang dự phòng). `LLM_FAILOVER_TIMEOUT_MS` (mặc định 30 s, PipelineX đặt 90 s). Test: `tests/model-chain.test.ts`.
- `renderer/lib.ts`: chuỗi tương tự cho các bước video (`VIDEO_PROVIDERS`, mặc định nvidia,openrouter-free,orcarouter,openrouter), kèm kiểm tra câu trả lời dùng được (hồ sơ ≥ 8 sự kiện, kịch bản ≥ 8 beat…).
- `modules/video/backend/pipeline.ts`: tiến trình dựng video chỉ nhận các biến môi trường cần thiết (không nhận mật khẩu DB/admin).

## Video: Background, Thumbnail, Short

- Bước `background` (TinyFish, miễn phí, không bắt buộc): lấp toàn văn bài ngắn (không lấy báo trả phí), tìm bối cảnh trong tên miền uy tín, thêm tối đa 8 trang được đánh dấu BACKGROUND.
- Bước `thumbnail` (Remotion still 1280×720, chữ do kịch bản viết `thumbnail_text`), `short` / `shortvoice` / `shortrender` (YouTube Short dọc 1080×1920, ~45–60 s, dùng lại hình đã kiểm tra của bản dài, kiểm chứng từng câu như bản dài). Lỗi ở các bước này không làm hỏng video dài.
- Trang Videos: ảnh thumbnail, trình phát Short, nút tải video/thumbnail/Short, kết quả kiểm chứng của Short.
- (18/11) `pipelinex-chain` chỉ còn model miễn phí: NVIDIA → OpenRouter `:free` → OrcaRouter free → `LLM_*` (`.env` đặt `LLM_MODEL=nvidia/nemotron-3.5-super-vl:free`, `LLM_VISION=true`). Bỏ tầng OpenRouter trả phí (đêm 17/11 nó đã nhận 103 lượt, $0,41, khi các tầng free bị giới hạn). Khi mọi tầng free bận, bước đó thất bại và được thử lại sau.
- Giọng đọc: Azure AI Speech khi có `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (cùng giọng Andrew, mốc thời gian từng chữ), edge-tts cho beat Azure lỗi hoặc khi chưa có key. `renderer/requirements.txt`.

## MCP biên tập cho agent trên máy (Antigravity…)

- `modules/video/backend/editor-mcp.ts`: `http://127.0.0.1:3001/api/admin/video/mcp`, công cụ `list_videos`, `get_video`, `edit_script` (sửa lời, tiêu đề, mô tả, chữ thumbnail của bản dài hoặc Short, rồi kiểm chứng lại ngay), `remake`, `review`. Không đăng được video. Chỉ nhận kết nối trực tiếp trên máy (loopback, `Host` đúng cổng API, không `Via`/`X-Forwarded-*`/`Origin`) kèm `VIDEO_EDITOR_TOKEN` (≥ 24 ký tự; trống = tắt).
- `modules/video/backend/editing.ts`: đọc/sửa kịch bản, lịch sử `edits.json` (trước/sau, ghi chú), hiện trên trang Videos ("Edit history").
- `apps/web/app/lib/api-proxy.server.ts`: proxy web luôn gắn `Via: 1.1 pipelinex-web` (ghi đè giá trị client gửi) để API phân biệt yêu cầu đi qua web.
- Test: `modules/video/tests/editor.test.ts`.
- (18/11) Công cụ vận hành cho agent: `list_candidates`, `search_stories`, `get_story`, `make_video` (tối đa 3 video/24 giờ do agent tạo, kèm lý do), `edit_visual` (đổi hình một beat rồi làm lại từ `assets`), `system_status` (dữ liệu trang Operations + provider giờ qua + video), `retry_failed_articles` (dùng `requeueFailedArticles` của AIHOT). Mọi hành động của agent vào cả `edits.json` của video lẫn Audit Log (`video.create|edit|remake|review`). `.env` bật `VIDEO_AUTO_ENABLED=true`.
- (18/11) Thêm công cụ cho agent: `look_at_video` (thumbnail + khung hình từng beat dạng ảnh, kèm lời đọc), `get_publish_kit` / `edit_publish_kit` (tiêu đề, mô tả có chương, nguồn, credit ảnh, ghi chú làm bằng AI, tag — bản dài và Short; không đăng), `web_search` / `fetch_page` (TinyFish, chỉ tên miền uy tín, chặn báo trả phí và diễn đàn), `get_style_guide` / `propose_style_rule` (luật chỉ có hiệu lực khi người duyệt trên trang Videos; luật đang hiệu lực được đưa vào prompt kịch bản và Short qua `style.json`). Danh sách tên miền uy tín dùng chung: `modules/video/backend/trusted.ts`.
- (18/11) Cứu hộ qua MCP (`modules/video/backend/rescue.ts`): `list_stalled_articles` (bài lỗi hoặc đang chờ thử lại do provider 403/429/timeout; gửi lại phân tích bằng `retry_failed_articles`) và `rescue_video_script` (khi bước script cứ lỗi, agent tự viết kịch bản dài; video được khoá trước bằng `requeueVideo` — bị từ chối nếu đang chạy — rồi mới ghi `script.json`, giữ danh sách nguồn của script cũ, làm lại từ `verify` nên mọi câu vẫn được kiểm chứng). Đã bỏ `get_article_to_analyze` / `submit_article_analysis` của bản đầu: agent tự chấm điểm và tự chọn bài là đi vòng quy trình chọn bài của AIHOT (lọc, hai điểm độc lập, ngưỡng theo kênh, biên nhận) và dùng thang điểm AI cho cả kênh tài chính. Bài viết luôn do hệ thống chấm.
- (18/11) `remake` có `force`: chỉ khởi động lại video bị kẹt ở trạng thái running do worker khởi động lại — bị từ chối khi pg-boss còn job `video.make` đang chờ, hoặc đang chạy mà video vừa đổi bước trong 15 phút qua (`FORCE_QUIET_MINUTES`).
- (18/11) Phong cách video (`modules/video/backend/styles.ts`, cột `video_jobs.style`, migration `2002`): news, launch, product, finance, investigation, crime, war, explainer, analysis. Tự chọn theo bài báo của câu chuyện (chiến tranh/tội phạm khi ≥ 1/3 số bài, rồi điều tra hoặc tài chính — chọn bên chiếm tỷ lệ cao hơn, rồi theo chủ đề AIHOT). Phong cách quyết định cấu trúc cảnh, giọng văn, luật riêng, gợi ý b-roll (kịch bản và Short), luật kiểm tra hình, tốc độ đọc, nhạc theo tâm trạng (`renderer/music/<mood>/`), màu chủ đạo (video, Short, thumbnail). Crime và war là chủ đề nhạy cảm: luật lời văn và hình ảnh nghiêm hơn. Đổi trên trang Videos hoặc qua MCP (`list_styles`, `set_video_style`, `make_video` có tham số `style`).

## Đa kênh (18/11)

- Mỗi kênh là một checkout riêng (git worktree, nhánh `channel/<tên>`, thư mục `PipelineX/channels/<tên>/`), loại kênh chọn **một lần** lúc tạo: `industry/` của kênh là gói `packs/<loại>/` (loại `ai` dùng `industry/` của checkout chính). Database, cổng (3010/3011, 3020/3021…), token MCP biên tập riêng; key dùng chung qua `.env.shared` (liên kết tới `.env` chính, nạp trước `.env` của kênh). Bộ dựng video (`renderer/`) dùng chung.
- `npm run channel -- create <tên> --type <loại> [--title "Tên"] | list | start | stop | update [<tên>] | remove <tên> --yes | types`. `update` merge code của nhánh hiện tại vào kênh (gói và `site/site.ts` của kênh giữ nguyên nhờ `.gitattributes` merge=ours), cài thư viện, migrate.
- `industry/channel.json`: hồ sơ kênh (loại, chủ đề, khán giả, thương hiệu, tag, trang chính thức uy tín, báo trả phí, phong cách được dùng, bảng chủ đề → phong cách). Prompt video, kiểm tra hình, intro/outro/thumbnail, publish kit, danh sách trang uy tín đọc từ đây.
- `apps/api` và `apps/worker` (dev) nạp `../../.env.shared` rồi `../../.env`.

## Render, giọng đọc, hình & đồ hoạ (18/11)

- `pipeline.ts`: render và thumbnail dùng `--bundle-cache`, render dùng `--hardware-acceleration if-possible`. Mặc định `--concurrency` vẫn 4 (`VIDEO_RENDER_CONCURRENCY`; máy chính đặt 6 trong `.env` để chừa nhân cho kênh khác render cùng lúc).
- `renderer/tts.py`: cache từng beat (`public/audio/<beat>.meta.json`: engine, giọng, tốc độ, lời). Làm lại từ `voice` sau `edit_script` chỉ thu lại beat đã sửa; beat từng phải dùng edge-tts thay Azure sẽ được thu lại khi Azure chạy.
- `renderer/assets.ts`: khi không có ảnh hợp cho truy vấn của beat, thử tối đa 2 truy vấn rộng hơn chọn theo nội dung (thị trường, lợi nhuận, Fed, crypto, thanh toán, app, máy chủ/chip, lãnh đạo, trụ sở, toà án) rồi mới về thẻ chữ; mỗi beat tối đa 12 lần kiểm tra bằng vision.
- `renderer/src/NewsVideo.tsx`: beat mới `compare`/`comparison` (bảng 2 cột), `code`/`terminal`, `card` có `items`; nền lưới có ánh sáng chuyển động và vignette, số liệu `stat` nổi hơn, phụ đề kính mờ, thanh tiến trình gradient. `Thumbnail.tsx`, `ShortVideo.tsx`: tương phản, viền và ánh sáng nền mạnh hơn. `short.ts`: cho phép visual so sánh/code, luật trích nguồn ở beat cuối chặt hơn.
- `editing.ts`: ghi file của video tạo thư mục nếu chưa có.
- Tài liệu kế hoạch (EVAL-AIHOT, PLAN, RESEARCH-PROCESS, RESEARCH, SPEC) nằm trong `docs/pipelinex/`; các file cùng tên ở thư mục `PipelineX/` là symlink tới đây.

## Checkout chính chuyển sang tài chính (18/11)

- Theo yêu cầu chủ dự án: checkout chính (:3000) chạy gói `finance`, xoá dữ liệu AI. Backup trước khi xoá: `PipelineX/backups/ai-channel-20261118/` (`pipelinex_eval.dump` — `pg_restore -d <db>`; `data/`: video, gold set và kết quả đánh giá của kênh AI). Database `pipelinex_eval` tạo lại, migrate, seed nguồn tài chính.
- Gói AI gốc chuyển sang `packs/ai/` (gồm `site/site.ts`); `scripts/channel.ts` lấy mọi loại kênh từ `packs/<type>/`.
- Test engine từng ghi cứng mục AI làm kiểu (`web-server.ts`, `page-metadata.standalone`, `pool-relevance`, `search-sharing`) giờ lấy `CATEGORIES` của gói, nên typecheck qua với gói nào cũng được.
- Rà nguồn tài chính theo số liệu thật của kênh `markets` (750 bài, 67 được chọn): bỏ Seeking Alpha, Abnormal Returns, The Big Picture, The Block, Cointelegraph (tắt trong database, giữ bài cũ); Bloomberg, FT, WSJ, Economist, Reuters (Google News) chỉ còn là tín hiệu độ nóng (`hot_signal`: báo trả phí/chỉ có tiêu đề, gần như không bài nào được chọn); thêm BEA, BLS và US Treasury (qua Google News), Bank of England, CFTC, NY Fed Liberty Street (T1), CNBC Economy, BBC Business, Guardian Business, NPR Business, NerdWallet (T2), AP qua Google News (`hot_signal`). Feed đã thử trước khi thêm; IMF, Yahoo Finance, Fortune, FDIC, Marketplace, Calculated Risk không dùng được. Thay đổi trong database qua `updateSource` (Audit Log).
- `channel.json`: thêm newyorkfed.org, bbc.co.uk, theguardian.com, npr.org, nerdwallet.com, cnbc.com vào trang uy tín cho nghiên cứu.
- Chỉ chạy một kênh tài chính (checkout chính :3000) cho tới khi kênh khả quan. Kênh thử `markets` (:3010) đã dừng, giữ checkout/nhánh/database; backup database và video #1 ở `PipelineX/backups/markets-channel-20261118/`.

## Publish kit tối ưu cho YouTube (18/11)

- `modules/video/backend/publishing.ts`:
  - Tag: cụm từ người xem tìm cho chủ thể chính lấy từ danh mục thực thể của gói (`ENTITIES`, `IDENTITY_LEXICON`), ví dụ "nvidia earnings", "nvidia q3 earnings", "nvda stock", "nvidia earnings 2026". Sau đó là người được nhắc ≥ 2 lần trong lời đọc, các chủ thể khác, rồi tag của kênh; tối đa 15 tag và 500 ký tự. Chủ thể thứ hai không có mã cổ phiếu (cơ quan quản lý, người) chỉ có tên.
  - Hashtag: chủ thể, mã cổ phiếu, phong cách (`#Nvidia #NVDA #Earnings`), rồi hashtag của kênh; tối đa 5.
  - Mô tả: thêm mã cổ phiếu sau lần nhắc đầu ("Nvidia (NVDA)"), dòng mời đăng ký, câu miễn trừ của kênh. Nguồn bỏ trang chủ, tiêu đề rỗng và mục trùng; bài của câu chuyện lên trước, tối đa 4 trang nền.
  - `titleOptions` (tối đa 3, cho "Test & compare" của YouTube): agent viết qua `edit_publish_kit`; trang Videos có nút sửa qua API.
  - `settings`: danh mục, ngôn ngữ, "Made for kids: No", ghi chú về khai báo nội dung AI, hướng dẫn phụ đề.
  - `captionsSrt(id, long|short)`: phụ đề SRT từ thời gian từng từ của giọng đọc, lấy lại dấu câu từ lời đọc gốc (engine bỏ dấu), mỗi dòng ≤ 42 ký tự, ≤ 3,5 giây, ngắt ở câu và chỗ nghỉ. Video dài lệch theo phần intro 3 giây.
- `GET /api/admin/video/videos/:id/captions.srt[?variant=short]`; trang Videos hiện phương án tiêu đề, cài đặt upload và nút tải phụ đề.
- `channel.json`: thêm `youtube` (category, language, subscribe, disclaimer). Gói finance: News & Politics, câu miễn trừ "not financial advice". Gói AI: Science & Technology.
- `modules/video/package.json`: dùng `@aihot/industry` (danh mục thực thể của gói).

## Thương hiệu Market Decoded (18/11)

- Chủ dự án chọn tên kênh tài chính: **Market Decoded**, tagline "Market news, decoded.". Logo: ba cây nến tăng dần trong cặp ngoặc code; màu navy #0B2239, xanh ngọc #5DCAA5 (trên nền sáng #0F6E56), xám xanh #9FB3C8; chữ Inter (SIL OFL 1.1), vẽ thành đường nét nên không phải kèm font.
- `scripts/brand.ts <pack>`: tạo bộ nhận diện từ `<pack>/brand/brand.json`: `mark.svg`, `icon.svg` (vuông, nét đậm cho favicon), `wordmark.svg` / `wordmark-dark.svg`, `favicon.ico`, `icon.png`, `icon-192.png`, `apple-icon.png`, và cho YouTube trong `brand/youtube/`: `avatar-800.png`, `banner-2560x1440.png` (chữ nằm trong vùng an toàn 1546×423 cho điện thoại; `banner-phone-preview.png` để xem trước), `watermark-150.png`. `brand.json` trỏ tới file font Inter trên máy.
- `packs/finance/`: `brand/`, `site/brand/` (logo, icon, `Logo.tsx`: `Mark`, `Wordmark` có logo + tên tách màu, `RingMark` khi đứng yên là logo, khi xoay vẫn là vòng tải), `site/public/manifest.webmanifest` (màu navy), `site.ts` (tên, tiêu đề trang chủ, `mcpPrefix: market_decoded`, `MarketDecodedBot/1.0`), `channel.json` (`brand.name`, `tagline`, `mark: brand/mark.svg`). Checkout chính dùng các bản này. Bộ logo cũ của gói AI để ở `packs/ai/site/`.
- Video: `tts.py` chép `brand.mark` của kênh vào thư mục `public/` của video (`brand-mark.svg`) và ghi vào `timeline.brand`; `NewsVideo` (intro, thanh tiêu đề, outro), `Thumbnail`, `ShortVideo` vẽ logo qua `BrandMark` (không có logo thì vẫn là chấm màu như cũ). Outro bỏ nhãn "(background)" khỏi tên nguồn.

## Giới hạn tốc độ gọi model (18/11)

- Vấn đề: checkout chính chấm 6 bài cùng lúc, mỗi bài gọi model 4–5 lần, vượt mức NVIDIA miễn phí (~40 lượt/phút) → 429 hàng loạt, chuỗi chuyển sang OpenRouter free và đốt hết hạn mức ngày, rồi circuit tạm dừng mọi model; 336 bài nằm chờ.
- `packages/backend/src/providers/rate.ts` `waitForRate(service)`: trước mỗi lượt gọi (`chatOnce`), đếm lượt gọi của service đó trong 60 giây qua từ `receipt_attempts` (dùng chung cho mọi worker và API); quá trần thì chờ tới khi lượt cũ nhất ra khỏi cửa sổ, không báo lỗi.
- `config.modelRpm` từ `MODEL_RPM` (vd. `nvidia-minimax=12,nvidia=30,openrouter-free=18,orcarouter-free=9`; không đặt = không giới hạn, giữ nguyên hành vi engine gốc), `config.analyzeConcurrency` từ `ANALYZE_CONCURRENCY` (mặc định 6 như cũ; máy chính đặt 3). Ghi trong `.env.example`.
- Chưa tính: các bước video (renderer) gọi NVIDIA trực tiếp, không qua biên nhận, nên không nằm trong bộ đếm; trần 30 chừa khoảng 10 lượt/phút cho chúng.
- `site/models.ts`: `nvidia-minimax` thành service riêng (`nvidia-minimax`). Đo thực tế: chỉ MiniMax trả 429 (ở ~10–20 lượt/phút tổng, khi các bước video cũng dùng nó), Nemotron thì không; tách ra để 429 của MiniMax không làm ngắt circuit của Nemotron và có trần riêng.
- Lưu ý vận hành: `npm run dev:worker` chạy `node --watch`; sửa code làm worker tự khởi động lại nhưng phải chờ job đang chạy (một video có thể mất nhiều phút) và không nhận việc mới trong lúc đó.
- Test: `tests/model-rate.test.ts`.

## Nhiều ảnh hơn trong video (18/11)

- Đo: video #2 chỉ 6/26 cảnh có ảnh; kịch bản chọn 15/26 cảnh chữ, 4/10 cảnh cần ảnh không tìm được (một phần vì kiểm tra ảnh bằng model bị lỗi 429 và lỗi bị coi như "không hợp"). Ảnh của báo thương mại vẫn không dùng (bản quyền, Content ID); og:image của trang chính phủ chỉ là logo chung nên không dùng.
- `renderer/assets.ts`:
  - Kiểm tra ảnh trả `yes | no | error`; lỗi được thử lại một lần sau 8 giây; nếu model kiểm tra hỏng hẳn (3 lỗi), cảnh b-roll dùng clip Pixabay đầu tiên khớp từ khóa (ghi log "unchecked"), cảnh ảnh người/vật cụ thể thì không.
  - Chân dung: cảnh trích dẫn lấy ảnh người nói trên Wikimedia Commons theo tên (`intitle:"Tên"`, tên tệp phải có họ; ảnh chính thức của chính phủ Mỹ ở đó là public domain); model chỉ kiểm tra là ảnh rõ của một người. Ghi credit vào ATTRIBUTIONS.
  - Nền ảnh: cảnh số liệu, trích dẫn, bài báo, mốc thời gian, biểu đồ, so sánh, thẻ chữ dùng ảnh gần nhất của video (ưu tiên cùng cảnh) làm nền (`visual.backdrop`).
- `renderer/src/NewsVideo.tsx`: `Backdrop` (ảnh/clip mờ, tối, trôi chậm; không có thì lưới như cũ) cho mọi cảnh chữ; `QuoteBeat` hiện chân dung tròn và credit ảnh.
- `renderer/script.ts`: prompt yêu cầu ≥ 60% cảnh là photo/broll; nếu kịch bản thiếu, thẻ chữ trơn được đổi sang b-roll theo gợi ý của phong cách (assets.ts đổi lại thành thẻ chữ nếu không tìm được ảnh).

## Kết nối YouTube (18/11)

- `modules/video/backend/youtube.ts`: OAuth với Google (client "Web application", `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`, redirect `<SITE_URL>/api/admin/video/youtube/callback`, quyền upload, quản lý và Analytics chỉ đọc). Refresh token lưu ở `.data/youtube-auth.json` (quyền 0600), không bao giờ trả về qua API.
- `uploadPrivate`: upload video dài **private** bằng resumable upload với publish kit (tiêu đề, mô tả, tag, danh mục, ngôn ngữ en, không dành cho trẻ em), rồi thumbnail, phụ đề tiếng Anh (SRT từ lời đọc) và Short. Lỗi thumbnail/phụ đề/Short chỉ ghi chú, không làm hỏng lượt upload. Ghi vào `<video>/youtube.json`.
- `publishPublic`: chỉ khi người bấm "Publish on YouTube" trên trang Videos (có hộp xác nhận), chỉ với video đã Approved; đặt video và Short thành public rồi đọc lại trạng thái. Dự án Google Cloud chưa qua audit của YouTube thì upload qua API bị khóa private: nút báo rõ lỗi đó.
- Route: `GET /api/admin/video/youtube/connect|callback`, `POST /api/admin/video/videos/:id/youtube/upload|publish` (phiên admin + CSRF; state OAuth dùng một lần, 10 phút, gắn với admin bắt đầu). Audit Log: `video.youtube.connect|upload|publish`. Editor MCP không có công cụ YouTube.
- Trang Videos: trạng thái kết nối ở đầu trang (link "connect the channel"), khung YouTube trong chi tiết video.
- Test: `modules/video/tests/youtube.test.ts`.

## 3 video mỗi ngày, chất lượng trước số lượng (18/11)

- Quyết định của chủ dự án: tối đa 3 video/ngày (tin chất lượng, video chất lượng), tăng sau khi kênh ổn.
- `videos.ts`: `DAILY_TARGET` (`VIDEO_DAILY_TARGET`, mặc định 3) tính chung video tự động và của agent; `videosToday()` đếm video bắt đầu hôm nay theo giờ Việt Nam, không tính video lỗi hoặc bị từ chối. `autoPick`: chỉ chọn khi chưa đủ chỉ tiêu và không có video nào đang làm; ứng viên 48 giờ qua xếp theo độ nóng × (1 + 0,1 × số nguồn vượt 3, tối đa +50%); bỏ câu chuyện có ≥ 2 từ chủ đề trùng với video trong 3 ngày (không hai video Nvidia liên tiếp).
- `server.ts`: lịch `video-daily` chạy 3 lần: 08:30, 13:30, 18:30 giờ Thượng Hải (07:30, 12:30, 17:30 giờ Việt Nam).
- `make_video` của agent: từ chối khi hôm nay đã đủ chỉ tiêu (trước đây: 3 video riêng của agent trong 24 giờ). Tạo tay trên trang Videos không bị giới hạn (người quyết).

## Video sâu hơn, dài 7–8 phút, biểu đồ số liệu thật (18/11)

- Chủ dự án chọn: nội dung sâu hơn, biểu đồ số liệu thật, video 7–8 phút (giọng đọc giữ nguyên).
- Sâu hơn: mỗi video đọc tối đa 20 bài (`VIDEO_MAX_REPORTS`, trước là 12); dossier 35–70 dữ kiện (trước 25–50); `script.ts` thêm **lượt biên tập** (một lượt gọi model nữa đóng vai biên tập viên: mở đầu bằng dữ kiện bất ngờ nhất, có phần "điều này nghĩa là gì với bạn", số liệu có so sánh — chỉ dùng số đã có trong tài liệu, mạch nối, đúng độ dài; giữ id dữ kiện, loại hình, ≥ 60% cảnh có ảnh). Bản biên tập hỏng hoặc ngắn hơn thì giữ bản nháp; ghi `edited`, `draftWords` vào RESULT. Kiểm tra bám nguồn chạy sau lượt biên tập như cũ.
- Dài hơn: `VIDEO_SCRIPT_WORDS` mặc định 1100–1250 từ (≈ 7–8 phút, qua mốc 8 phút để YouTube cho chèn quảng cáo giữa video), mỗi cảnh 3–6 beat; giới hạn thời gian các bước tăng (script 25, verify 20, assets 35, voice 30 phút).
- Số liệu thật (`renderer/data.ts`, chạy cuối bước `background`): FRED (`FRED_API_KEY`) theo từ khóa của câu chuyện (lãi suất Fed, CPI/core/PCE so với cùng kỳ, thất nghiệp, việc làm mới, lợi suất 10 năm, lãi vay mua nhà, GDP, dầu WTI, chỉ số USD; bỏ chuỗi FRED ghi bản quyền của bên khác như chỉ số chứng khoán); SEC EDGAR company facts (`SEC_USER_AGENT`, tên + email theo quy định SEC) cho doanh thu, lợi nhuận, EPS pha loãng theo quý của công ty được nhắc. Mỗi chuỗi vừa vào `data.json` (biểu đồ lấy đúng điểm số), vừa vào `background.json` như một nguồn nền nên dossier, kịch bản và kiểm chứng đều thấy số liệu có nguồn. Không có key thì bỏ qua.
- `script.ts`: loại cảnh `{"type":"chart","data":"D1"}`; điểm số, tiêu đề, đơn vị, nguồn được thay bằng đúng chuỗi dữ liệu. `NewsVideo.tsx` `ChartBeat`: ≤ 5 điểm là cột, dài hơn là đường vẽ dần có nhãn đầu/cuối, thay đổi tính bằng điểm % cho tỷ lệ, dòng "Source:".
- `pipeline.ts`: `FRED_API_KEY`, `SEC_USER_AGENT` được chuyển cho renderer.

## Tối ưu chuỗi Model miễn phí & bộ dựng video (18/11, đợt 2)

- `renderer/lib.ts`, `.env`: Đo đạc thực tế thấy `mistralai/mistral-large-4-1t-a52b` bị treo/timeout (>15–60s) khi gọi JSON mode (`response_format: {"type": "json_object"}`) trên NVIDIA NIM. Đổi model chính sang `nvidia/nemotron-3.5-super-vl-120b-a12b` (`nvidia-vl`, có vision, trả về trong ~10s, 0 lỗi). Thứ tự ưu tiên: `nvidia-vl` → `nvidia-minimax` (MiniMax 3.1 Flash, nhanh 3s nhưng trần 10–20 RPM) → `nvidia-nemotron` (chỉ text) → `openrouter-free` → `orcarouter`. Thêm cơ chế exponential backoff (4s, 8s, 12s) khi gặp HTTP 429.
- `renderer/assets.ts`: Chặn ảnh > 8 MB trước khi chuyển base64 data URL để tránh lỗi HTTP 400 (vượt trần 16 MB của server).
- `modules/video/backend/publishing.ts` / Publish kit: Bổ sung 3 phương án tiêu đề (A/B testing dưới 70 ký tự) cho cả Video #1, #2 và #3 qua `edit_publish_kit`.
- Đề xuất luật phong cách `propose_style_rule`: Mã `[2d6d2b81]` đề xuất tự động tạo cảnh đồ thị `chart` khi hồ sơ có từ 2 số liệu theo thời gian, giảm tải thẻ chữ tĩnh trên màn hình.
- Hoàn thành và duyệt toàn bộ 3 video đầu tiên: Video #1 (Nvidia Q3 Earnings), Video #2 (Fed Warsh AI Task Force), Video #3 (Peraire-Bueno MEV Acquittal) đều đạt chuẩn 0 partial, 0 unsupported trên cả bản Dài và bản Short với $0.00 chi phí model.

## Đồ họa vẽ bằng code, Pexels, ảnh minh họa AI có nhãn (18/11)

- Cảnh mới trong `NewsVideo.tsx` (đặt trên nền ảnh mờ): `flow` (chuỗi nguyên nhân → hệ quả 3–5 bước, sáng dần), `versus` (hai con số cạnh nhau, cột theo tỷ lệ), `gauge` (một giá trị so với mục tiêu, kim chạy). `script.ts` mô tả cho người viết và kiểm tra: số của `versus`/`gauge` phải có trong tài liệu (so theo giá trị), `flow` 2–5 bước, mỗi bước ≤ 8 từ; sai thì đổi sang b-roll hoặc thẻ chữ. Bản đồ chưa làm (cần tải dữ liệu hình dạng các nước/bang).
- `renderer/assets.ts`: Pexels (`PEXELS_API_KEY`, ảnh và clip, Pexels License; credit vẫn ghi). B-roll lấy clip Pexels và Pixabay xen kẽ, rồi ảnh của hai bên, rồi Openverse; cảnh ảnh cụ thể thêm Pexels sau Commons và Openverse. Có cả giới hạn ảnh 8 MB trước khi kiểm tra (do agent cục bộ thêm vào cùng tệp).
- Ảnh minh họa AI: công cụ MCP `add_illustration` (agent tự tạo ảnh bằng model ảnh của nó, đưa đường dẫn tệp và prompt): chỉ PNG/JPEG/WebP (kiểm tra byte đầu), ≤ 12 MB; ghi vào `script.json` và `script-final.json` kiểu `illustration`, credit "AI illustration (<model>)"; làm lại từ `voice`. Quy tắc trong mô tả công cụ và hướng dẫn agent: chỉ cho ý tưởng trừu tượng, không bao giờ ảnh giống thật về người, công ty, sản phẩm, sự kiện; không chữ trong ảnh. Video luôn hiện nhãn "AI ILLUSTRATION"; publish kit thêm dòng ghi chú ảnh AI.

## Điểm ưu tiên chọn tin làm video (18/11)

- Chủ dự án chọn: ngoài độ nóng, số nguồn đọc được và độ mới, thêm **điểm chất lượng tin** (không cộng điểm cho nguồn chính thức, không xếp theo mục, không ép đa dạng mục trong ngày).
- `videos.ts` `priorityOf` (0–100): độ nóng 35 (so với ứng viên nóng nhất), chất lượng 30 (trung bình điểm chọn lọc của 3 bài tốt nhất trong câu chuyện), nguồn đọc được 20 (nguồn `editorial`, không tính tín hiệu chỉ có tiêu đề và báo trả phí; đủ điểm ở 6 nguồn), độ mới 15 (đủ trong 12 giờ, hết ở 48 giờ). `autoPick` chọn theo điểm này, vẫn bỏ chủ đề trùng video 3 ngày qua (thay cho luật "độ nóng × thưởng số nguồn" trước đó).
- Trang Videos: cột Priority (rê chuột xem từng phần), Sources dạng "đọc được/tất cả", xếp theo điểm. MCP `list_candidates` xếp và ghi điểm từng phần.

## Tự động liên kết Short với Video chính (19/11)

- `renderer/short.ts`:
  - Cập nhật prompt câu kết (last beat) của kịch bản Short: yêu cầu trực tiếp người xem "Watch the full breakdown linked below." hoặc "Tap below for the full deep dive.", tạo lời kêu gọi hành động (call-to-action) rõ ràng bằng giọng đọc.
  - Tự động gắn metadata `mainTitle` và `mainVideo` ({ title, description }) từ `script-final.json` vào `script-short.json`.
- `renderer/tts.py`:
  - Giữ lại `mainTitle` và `mainVideo` vào `timeline-short.json` khi tổng hợp giọng đọc Short.
- `renderer/src/ShortVideo.tsx`:
  - Màn hình kết của Short (closing CTA): Chuyển thành khối kêu gọi động nổi bật `WATCH FULL VIDEO ⬇️` với mũi tên nhấp nháy chỉ thẳng xuống vị trí nút "Related video" mặc định của YouTube Shorts.
  - Hiển thị trực tiếp tiêu đề bài phân tích dài (`▶ [Tiêu đề video chính]`) trong khung nền kính mờ (blur backdrop) để người xem nhận diện ngay video cần bấm.
- `modules/video/backend/publishing.ts`:
  - `draftKit`: Tự động đọc mã `longId` từ `youtube.json` (nếu đã upload) hoặc chuẩn bị mẫu link. Chèn dòng kêu gọi kèm link `👉 WATCH FULL VIDEO: https://youtu.be/<longId>` ngay dòng đầu tiên của mô tả Short (`short.description`).
- `modules/video/backend/youtube.ts`:
  - Khi upload video dài thành công và có `longId`: Tự động điền link `https://youtu.be/${long.id}` vào đầu mô tả của Short trước khi gửi file `short.mp4` lên YouTube (đây là cách an toàn và tương thích 100% với tài khoản Brand và dự án chưa audit; không gọi API bình luận `commentThreads` tự động vì Google chặn 403 do chính sách chống spam bình luận).
- `modules/video/web/videos.tsx`:
  - Hiển thị badge liên kết `🔗 Main Video: https://youtu.be/<longId>` kèm nút copy nhanh trong khung Publish kit của trang quản trị.

## Tự động Public 100% lên YouTube (20/11)

- `VIDEO_AUTO_PUBLISH=true` (`.env`): Bật chế độ tự động đăng công khai (Zero-touch publishing).
- `modules/video/backend/pipeline.ts`:
  - Khi pipeline dựng xong toàn bộ các bước (`shortrender` hoàn tất không lỗi, gọi `finishVideo(id, null)`): Nếu `VIDEO_AUTO_PUBLISH=true` và kênh YouTube đã kết nối, hệ thống tự động:
    1. Đánh dấu duyệt video (`reviewVideo(id, "approved")`).
    2. Upload video chính, Short, thumbnail và captions (`uploadPrivate(id, "auto")`).
    3. Đặt trạng thái công khai (`publishPublic(id, "auto")`).
- `modules/video/server.ts` & `videos.tsx`:
  - Trả về cờ `autoPublish` trong `/api/admin/video/overview`.
  - Hiển thị trạng thái "Auto publish: on" trên thanh tiêu đề trang Videos.

## Chạy được trên Windows, macOS và Linux (22/11)

- `modules/video/backend/pipeline.ts`: Python của bước voice chọn theo nền tảng — `VIDEO_PYTHON` → `renderer/.venv/Scripts/python.exe` (Windows) hoặc `.venv/bin/python` (macOS/Linux) → `python`/`python3`. Lỗi ENOENT ghi rõ phải chạy `npm run video:setup` / `npm install`. Remotion chạy bằng `node node_modules/@remotion/cli/remotion-cli.js` thay cho `.bin/remotion` (trên Windows shim là `.cmd`, `spawn` không chạy được). `spawn` truyền thêm biến hệ thống Windows (`SystemRoot`, `TEMP`, `TMP`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `ComSpec`, `PATHEXT`…) vì nó thay toàn bộ môi trường con; timeout dùng `taskkill /T` để dọn tiến trình Chrome con của Remotion.
- `scripts/video-setup.ts` + `npm run video:setup`: tạo `renderer/.venv`, cài `requirements.txt`, kiểm tra import `edge_tts` và Azure SDK; cảnh báo khi thiếu `ffprobe` hoặc `renderer/node_modules`. Chạy được trên cả ba hệ điều hành, chạy lại an toàn.
- `renderer/tts.py`: đọc/ghi JSON bằng UTF-8 (Windows mặc định cp1252, kịch bản có dấu ngoặc cong/em dash sẽ lỗi), ngày dạng `Nov 22, 2026` thay cho `%-d` (Windows ném `ValueError: Invalid format string`), in UTF-8, tìm `music/` và `industry/` theo thư mục script, báo rõ khi thiếu `ffprobe`.
- `.env.example`: `VIDEO_PYTHON`. README: Bước 3 có lệnh chung và lệnh riêng cho Windows.

## Quét bug module video & renderer (22/11)

- `renderer/tts.py`: `speak_edge` bắt cả `EdgeTTSException`/`aiohttp.ClientError`/`TimeoutError` (không chỉ `NoAudioReceived`); retry 5/10/20/40s mới có tác dụng khi bị throttle 429.
- `renderer/assets.ts`: Pixabay video dùng `medium` thay cho `tiny` (1920×1080 thay vì 640×360); guard beat thiếu `query` → `card` thay vì crash; `unchecked ??=` sửa thành chỉ gán khi nguồn là stock và chưa có stock lỗi; `get()` log an toàn; `preset?.pictureRules` optional-chaining đúng chỗ.
- `modules/video/backend/pipeline.ts`: parse `RESULT` qua buffer `pending` (không mất kết quả khi output bị cắt chunk); truyền `VIDEO_ALT_VOICE_QUOTE`/`VIDEO_ALT_VOICE_CONFLICT` vào renderer; `.env.example` thêm hai biến này.
- `modules/video/backend/publishing.ts`: `chapters` không còn chapter <10s (Intro 3s); `tagsFor` lấy năm từ cuối chuỗi ngày thay vì `slice(0,4)`.
- `modules/video/backend/rescue.ts`: bỏ yêu cầu `text` cho beat `card` (renderer hiển thị narration).
- Kiểm chứng: `npm run typecheck` (pass), `py_compile renderer/tts.py` (pass), `npm run video:setup` (pass), smoke voice cached + edge-tts thật (pass), chapters test (pass).
