# Clickstream Analytics Platform

Nền tảng phân tích hành vi người dùng thương mại điện tử dựa trên dữ liệu clickstream 68 triệu sự kiện (Oct–Nov 2019). Toàn bộ xử lý dữ liệu chạy trên máy local bằng Polars + DuckDB, dashboard chạy hoàn toàn trên trình duyệt thông qua DuckDB-WASM — không cần server, không cần database.

---

## Kiến trúc tổng quan

```
01-log-tracking.csv (9 GB)
        │
        ▼ ETL Pipeline (Python — chạy local, 1 lần)
        │
        ├── Stage 1: Raw Ingest     Polars scan_csv → sink_parquet
        │           ~60-90 giây    CSV 9GB → events_raw.parquet (1.5GB)
        │
        ├── Stage 2: Normalize      Polars lazy scan → Star Schema
        │           ~36 giây       → dim_categories, dim_users
        │                          → dim_products (SCD Type 2)
        │                          → fact_events (67.5M rows)
        │
        └── Stage 3: Aggregate      DuckDB in-memory SQL
                    ~14 giây       → 5 summary parquet (~165 KB tổng)
                                   → copy vào dashboard/public/data/

        ↓

dashboard/public/data/              (5 file tĩnh, tổng 165 KB)
        │
        ▼ Next.js Dashboard (deploy Vercel — static)
        │
        └── Browser DuckDB-WASM
                Fetch 5 parquet → đăng ký view → SELECT trực tiếp
                Mọi query chạy trong browser, không cần server
```

---

## Stack công nghệ

| Layer | Công nghệ | Phiên bản | Vai trò |
|---|---|---|---|
| ETL Ingest | Polars | >= 1.41.0 | Streaming CSV → Parquet |
| ETL Normalize | Polars | >= 1.41.0 | Star Schema, SCD Type 2 |
| ETL Aggregate | DuckDB | >= 1.5.0 | OLAP SQL aggregation |
| Dashboard | Next.js | 16.2.6 | Static site generation |
| UI Framework | React | 19.2.4 | Component rendering |
| Styling | Tailwind CSS | v4 | Utility-first CSS |
| In-browser DB | DuckDB-WASM | 1.33.1 | Client-side analytics |
| Charts | Recharts | 3.8.1 | Recharts |
| Icons | Lucide React | 1.17.0 | Icon library |
| Language | TypeScript | v5 | Type safety |
| Deploy | Vercel | - | CDN static hosting |

---

## Cấu trúc thư mục

```
BigDataProject/
├── 01-log-tracking.csv          # Raw clickstream CSV (9 GB — không commit lên Git)
├── 02-purchase-behavior.csv     # Supplementary purchase data
│
├── etl/                         # Pipeline ETL (Python)
│   ├── pyproject.toml           # Dependencies: polars, duckdb
│   ├── main.py                  # Entry point: --stage 1|2|3
│   ├── config.py                # Đường dẫn file, thư mục
│   ├── stages/
│   │   ├── 01_raw_ingest.py     # CSV → Parquet (Polars streaming)
│   │   ├── 02_normalize.py      # Star Schema normalization (Polars)
│   │   └── 03_aggregate.py      # SQL aggregation → summary (DuckDB)
│   ├── queries/
│   │   ├── overview_kpis.sql    # KPI tổng hợp
│   │   ├── sales_trends.sql     # Xu hướng doanh thu theo ngày/tuần
│   │   ├── brand_preferences.sql # So sánh thương hiệu Top 10
│   │   ├── cohort_retention.sql  # Ma trận giữ chân nhóm khách hàng
│   │   └── rfm_segmentation.sql  # Phân khúc RFM 11 nhóm
│   └── data/
│       ├── raw/
│       │   └── events_raw.parquet       # 1.5 GB (không commit)
│       ├── warehouse/
│       │   ├── dim_categories.parquet   # 11 KB
│       │   ├── dim_users.parquet        # 53 MB (không commit)
│       │   ├── dim_products.parquet     # 8.1 MB (không commit)
│       │   └── fact_events.parquet      # 1.08 GB (không commit)
│       └── summary/
│           ├── overview_kpis.parquet    # 2 KB
│           ├── sales_trends.parquet     # 4 KB
│           ├── brand_preferences.parquet # 155 KB
│           ├── cohort_retention.parquet  # 1.4 KB
│           └── rfm_segmentation.parquet  # 1.8 KB
│
└── dashboard/                   # Next.js dashboard (deploy lên Vercel)
    ├── package.json
    ├── public/
    │   └── data/                # 5 summary parquet — được serve tĩnh
    │       ├── overview_kpis.parquet
    │       ├── sales_trends.parquet
    │       ├── brand_preferences.parquet
    │       ├── cohort_retention.parquet
    │       └── rfm_segmentation.parquet
    └── src/
        ├── app/
        │   ├── layout.tsx                  # Root layout, providers
        │   ├── page.tsx                    # Trang Dashboard Overview
        │   ├── sales-trends/page.tsx       # Xu hướng doanh thu
        │   ├── cohort-retention/page.tsx   # Nhóm khách hàng (Cohort)
        │   ├── brand-preferences/page.tsx  # Thị hiếu thương hiệu
        │   ├── rfm-segmentation/page.tsx   # Phân khúc RFM
        │   └── report/page.tsx             # Báo cáo chiến lược tổng hợp
        ├── components/
        │   ├── layout/
        │   │   ├── Sidebar.tsx             # Sidebar navigation + mobile drawer
        │   │   └── MobileHeader.tsx        # Top bar mobile (hamburger)
        │   ├── providers/
        │   │   ├── DuckDBProvider.tsx      # DuckDB-WASM init + query context
        │   │   ├── LangProvider.tsx        # Ngôn ngữ VN/EN global context
        │   │   └── SidebarProvider.tsx     # Mobile sidebar open/close state
        │   ├── cards/
        │   │   ├── KpiCard.tsx             # Card chỉ số KPI với sparkline
        │   │   └── ContentCard.tsx         # Card wrapper cho chart section
        │   └── ui/
        │       ├── SkeletonCard.tsx        # Loading skeleton
        │       ├── ErrorCard.tsx           # Error state UI
        │       └── InsightCallout.tsx      # Callout box nhận xét phân tích
        └── lib/
            └── duckdb.ts                   # DuckDB-WASM init + loadParquet helper
```

---

## Hướng dẫn cài đặt và chạy

### Yêu cầu hệ thống

- Python 3.10+
- Node.js 18+
- RAM: tối thiểu 8 GB (Stage 2 xử lý 67M rows)
- Dung lượng: ~15 GB (bao gồm CSV gốc và intermediate files)

### 1. Cài đặt ETL

```bash
cd etl
pip install -e .
```

### 2. Chạy ETL Pipeline

> Đặt file `01-log-tracking.csv` vào thư mục gốc project trước khi chạy.

```bash
# Chạy toàn bộ pipeline (Stage 1 + 2 + 3)
python -m etl.main

# Hoặc chạy từng stage riêng
python -m etl.main --stage 1   # CSV → raw parquet (~60-90 giây)
python -m etl.main --stage 2   # Normalize → star schema (~36 giây)
python -m etl.main --stage 3   # Aggregate → summary parquet (~14 giây)
```

**Output Stage 3** — 5 file summary được lưu vào `etl/data/summary/`.  
Sau đó copy vào dashboard để serve:

```bash
# Windows PowerShell
Copy-Item etl\data\summary\*.parquet dashboard\public\data\

# Linux/macOS
cp etl/data/summary/*.parquet dashboard/public/data/
```

### 3. Chạy Dashboard (development)

```bash
cd dashboard
npm install
npm run dev        # http://localhost:3000
```

### 4. Build production

```bash
cd dashboard
npm run build      # TypeScript check + static generation
npm run start      # Serve bản production tại localhost:3000
```

---

## Benchmark hiệu năng

### ETL Pipeline (đo thực tế trên local machine)

| Stage | Công việc | Thời gian |
|---|---|---|
| Stage 1 | CSV 9GB → Parquet (Polars streaming) | ~60–90 giây |
| Stage 2 | Normalize 67.5M rows → Star Schema | 36 giây |
| Stage 3 | 5 SQL aggregation queries (DuckDB) | 14 giây |
| **Tổng** | **CSV thô → Dashboard-ready** | **~2 phút** |

### Dashboard (browser, DuckDB-WASM)

| Metric | Giá trị |
|---|---|
| Dữ liệu cần load | ~165 KB (5 summary parquet) |
| Tốc độ query điển hình | < 50ms (Blazing) |
| Render kiểu | Static prerender (không cần server roundtrip) |

### So sánh Polars+DuckDB vs Apache Spark (cùng workload)

| Metric | Polars + DuckDB | PySpark (local) |
|---|---|---|
| JVM startup | 0s | ~20–30s |
| Stage 2 (normalize) | 36s | ~90–150s |
| Stage 3 (aggregate) | 14s | ~30–60s |
| RAM | ~4–6 GB | ~10–16 GB |
| **Kết luận** | **Phù hợp với < 500 GB, single node** | **Cần khi > 1 TB, multi-node cluster** |

---

## Các phân tích trong Dashboard

### 1. Tổng quan (Dashboard Overview)
- Tổng doanh thu, tổng khách hàng, tổng sự kiện, tỉ lệ chuyển đổi

### 2. Xu hướng Doanh thu (Sales Trends)
- Biểu đồ doanh thu và lượt xem theo ngày/tuần
- Phễu chuyển đổi: View → Cart → Purchase
- Phân tích độ trễ (Lag) từ xem đến mua

### 3. Nhóm Khách hàng - Cohort (Cohort Retention)
- Ma trận nhiệt độ giữ chân khách hàng theo tuần acquisition
- Đường cong suy giảm gắn bó (Decay Curve)

> **Lưu ý domain:** Weekly cohort retention không phù hợp cho bán lẻ điện tử cao cấp (chu kỳ mua 12–24 tháng). Metric thực tế nên dùng: 90-day RPR, TBP (Time Between Purchases), Accessory Attach Rate.

### 4. Thị hiếu Thương hiệu (Brand Preferences)
- So sánh Top 10 thương hiệu: doanh thu, số đơn, giá trung bình, tỉ lệ chuyển đổi
- Bảng có thể sort theo từng chiều

### 5. Phân khúc RFM (RFM Segmentation)
- Treemap phân bố 11 nhóm khách hàng theo volume
- Chi tiết từng nhóm: Recency, Frequency, Monetary
- Chiến lược marketing gợi ý cho từng phân khúc

### 6. Báo cáo Chiến lược (Strategy Report)
- Phân tích tổng hợp toàn bộ dữ liệu
- Song ngữ VN/EN, định dạng bullet prose

---

## Deploy lên Vercel

Dashboard có thể deploy trực tiếp lên Vercel **không cần server, không cần database** vì toàn bộ dữ liệu đã được pre-aggregate thành 5 file parquet tĩnh (~165 KB).

### Điều kiện

- 5 file parquet đã được copy vào `dashboard/public/data/`  
- Đã commit lên GitHub

### Cấu hình Vercel

| Setting | Giá trị |
|---|---|
| Framework | Next.js (auto-detect) |
| Root Directory | `dashboard` |
| Build Command | `npm run build` |
| Output Directory | `.next` (auto) |
| Environment Variables | Không cần |

### Cập nhật dữ liệu

Khi cần refresh data (ví dụ: tháng mới):

```bash
# 1. Chạy lại ETL Stage 3 (chỉ cần ~14 giây nếu warehouse đã có)
python -m etl.main --stage 3

# 2. Copy parquet mới vào dashboard
Copy-Item etl\data\summary\*.parquet dashboard\public\data\

# 3. Commit + push → Vercel auto-redeploy (~30 giây)
git add dashboard/public/data/
git commit -m "chore: refresh summary data [month]"
git push
```

---

## .gitignore đề xuất

```gitignore
# Raw data (quá lớn để commit)
01-log-tracking.csv
02-purchase-behavior.csv
etl/data/raw/
etl/data/warehouse/

# Summary data có thể commit (165 KB tổng) — bỏ comment nếu muốn
# etl/data/summary/

# Python
__pycache__/
*.pyc
.venv/
*.egg-info/

# Node
node_modules/
.next/
.vercel/

# OS
.DS_Store
Thumbs.db
```

---

## Tác giả và bối cảnh

Dự án được xây dựng phục vụ mục đích học tập và trình diễn kỹ thuật Big Data Engineering:

- **Dataset:** [eCommerce behavior data from multi category store](https://www.kaggle.com/datasets/mkechinov/ecommerce-behavior-data-from-multi-category-store) — Kaggle
- **Thời gian dữ liệu:** Tháng 10–11/2019
- **Quy mô:** 67.5 triệu sự kiện, 3.7 triệu người dùng, 379K sản phẩm

---

*Dashboard chạy hoàn toàn client-side — không có backend, không có API, không có chi phí vận hành.*
