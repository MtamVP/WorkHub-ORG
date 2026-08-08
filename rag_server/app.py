import os
import re
import gc
import json
import glob
import time
import csv
import math
import logging
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Any
from pathlib import Path

import numpy as np
from rank_bm25 import BM25Okapi
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("WorkHub-RAG")

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://gqsbsqaxzpzcloaopzvv.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR")
BRONZE_BUCKET = os.getenv("BRONZE_BUCKET", "general_bucket")
LOCAL_CORPUS_DIR = os.getenv("LOCAL_CORPUS_DIR", "./data_bronze")
PORT = int(os.getenv("PORT", "7860"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

try:
    from underthesea import word_tokenize
    HAVE_UNDERTHESEA = True
except ImportError:
    HAVE_UNDERTHESEA = False

try:
    from pypdf import PdfReader
    HAVE_PYPDF = True
except ImportError:
    HAVE_PYPDF = False

try:
    import docx
    HAVE_DOCX = True
except ImportError:
    HAVE_DOCX = False

try:
    import openpyxl
    HAVE_OPENPYXL = True
except ImportError:
    HAVE_OPENPYXL = False

gemini_model = None
HAVE_GEMINI = False
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        HAVE_GEMINI = True
        logger.info("Gemini API configured successfully.")
    except Exception as e:
        logger.warning(f"Failed to configure Gemini: {e}")
        HAVE_GEMINI = False


def clean_document_title(raw_name: str) -> str:
    """Loại bỏ mã hash/timestamp ngẫu nhiên từ Supabase và chuẩn hóa tên hiển thị."""
    if not raw_name:
        return ""
    base = raw_name.split("#")[0]
    # Bỏ prefix F_<timestamp>_ hoặc <timestamp>_
    clean = re.sub(r'^(?:F_)?\d{10,20}_?', '', base, flags=re.IGNORECASE)
    root, ext = os.path.splitext(clean)
    
    # Từ điển dịch các từ tiếng Việt (cả dạng bị sanitize _ và dạng không dấu)
    subs = [
        (r'(?i)\b(?:N_I_DUNG|NOI_DUNG)\b', 'Nội Dung'),
        (r'(?i)\b(?:KH_A_H_C|KHOA_HOC)\b', 'Khóa Học'),
        (r'(?i)\b(?:C_A|CUA)\b', 'Của'),
        (r'(?i)\b(?:B_O_C_O|BAO_CAO)\b', 'Báo Cáo'),
        (r'(?i)\b(?:QUY__NH|QUY_DINH)\b', 'Quy Định'),
        (r'(?i)\b(?:T_I_LI_U|TAI_LIEU)\b', 'Tài Liệu'),
        (r'(?i)\b(?:T_I_CH_NH|TAI_CHINH)\b', 'Tài Chính'),
        (r'(?i)\b(?:H_P___NG|HOP_DONG)\b', 'Hợp Đồng'),
        (r'(?i)\b(?:K_HO_CH|KE_HOACH)\b', 'Kế Hoạch'),
        (r'(?i)\b(?:TH_NG_B_O|THONG_BAO)\b', 'Thông Báo'),
        (r'(?i)\b(?:H__NG_D_N|HUONG_DAN)\b', 'Hướng Dẫn'),
        (r'(?i)\b(?:QUY_TR_NH|QUY_TRINH)\b', 'Quy Trình'),
        (r'(?i)\b(?:CH_NH_S_CH|CHINH_SACH)\b', 'Chính Sách'),
        (r'(?i)\b(?:DOANH_NGHIEP)\b', 'Doanh Nghiệp'),
        (r'(?i)\b(?:PHAN_TICH)\b', 'Phân Tích'),
    ]
    for pattern, repl in subs:
        root = re.sub(pattern, repl, root)
    
    root = re.sub(r'_+', ' ', root).strip()
    root = re.sub(r'\s+', ' ', root)
    
    if not root:
        root = base
    return f"{root}{ext}".strip()


def tokenize_vietnamese(text: str) -> List[str]:
    clean_text = re.sub(r'[^\w\s]', " ", text).lower()
    if HAVE_UNDERTHESEA:
        try:
            tokens = word_tokenize(clean_text, format="text").split()
            return tokens
        except Exception:
            pass
    return clean_text.split()


def extract_text_from_file(file_path: str) -> List[Dict[str, Any]]:
    ext = os.path.splitext(file_path)[1].lower()
    doc_id = os.path.basename(file_path)
    chunks = []

    if ext == ".pdf" and HAVE_PYPDF:
        try:
            reader = PdfReader(file_path)
            for page_idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                text = text.strip()
                if text:
                    chunks.append({
                        "doc_id": doc_id,
                        "chunk_id": f"{doc_id}#Trang_{page_idx + 1}",
                        "page": page_idx + 1,
                        "text": text
                    })
        except Exception as e:
            logger.warning(f"Error reading PDF {file_path}: {e}")

    elif ext in [".docx", ".doc"] and HAVE_DOCX:
        try:
            doc = docx.Document(file_path)
            full_text = []
            for para in doc.paragraphs:
                if para.text.strip():
                    full_text.append(para.text.strip())
            
            for table in doc.tables:
                for row in table.rows:
                    row_data = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_data:
                        full_text.append(" | ".join(row_data))
            
            combined = "\n\n".join(full_text)
            if combined:
                chunks.append({
                    "doc_id": doc_id,
                    "chunk_id": f"{doc_id}#Toàn_văn",
                    "text": combined
                })
        except Exception as e:
            logger.warning(f"Error reading DOCX {file_path}: {e}")

    elif ext in [".xlsx", ".xls"] and HAVE_OPENPYXL:
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
            for sheet in wb.sheetnames:
                ws = wb[sheet]
                rows_text = []
                for row in ws.iter_rows(values_only=True):
                    row_vals = [str(v).strip() for v in row if v is not None and str(v).strip()]
                    if row_vals:
                        rows_text.append(" , ".join(row_vals))
                if rows_text:
                    chunks.append({
                        "doc_id": doc_id,
                        "chunk_id": f"{doc_id}#Sheet_{sheet}",
                        "text": f"Bảng tính {sheet}:\n" + "\n".join(rows_text)
                    })
        except Exception as e:
            logger.warning(f"Error reading Excel {file_path}: {e}")

    elif ext == ".csv":
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f)
                rows = [" | ".join(r) for r in reader if any(r)]
                if rows:
                    chunks.append({
                        "doc_id": doc_id,
                        "chunk_id": f"{doc_id}#CSV",
                        "text": "\n".join(rows)
                    })
        except Exception as e:
            logger.warning(f"Error reading CSV {file_path}: {e}")

    elif ext == ".json":
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                raw = json.load(f)
                if isinstance(raw, list):
                    for idx, item in enumerate(raw):
                        if isinstance(item, dict):
                            t = item.get("passage") or item.get("content") or item.get("text") or json.dumps(item, ensure_ascii=False)
                            c_id = str(item.get("id", f"{doc_id}_{idx}"))
                            chunks.append({"doc_id": doc_id, "chunk_id": c_id, "text": str(t)})
                elif isinstance(raw, dict):
                    for k, v in raw.items():
                        if isinstance(v, str) and v.strip():
                            chunks.append({"doc_id": doc_id, "chunk_id": str(k), "text": v})
                        elif isinstance(v, dict):
                            t = v.get("passage") or v.get("content") or v.get("text") or json.dumps(v, ensure_ascii=False)
                            chunks.append({"doc_id": doc_id, "chunk_id": str(k), "text": str(t)})
        except Exception as e:
            logger.warning(f"Error reading JSON {file_path}: {e}")

    else:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read().strip()
                if text:
                    chunks.append({
                        "doc_id": doc_id,
                        "chunk_id": f"{doc_id}#Raw",
                        "text": text
                    })
        except Exception as e:
            logger.warning(f"Error reading text {file_path}: {e}")

    return chunks


def adaptive_chunking(doc_id: str, text: str, chunk_size: int = 700, chunk_overlap: int = 150) -> List[Dict[str, str]]:
    legal_segments = re.split(r'(?i)\n(Điều\s+\d+.*?)(?=\nĐiều\s+\d+|$)', text)
    if len(legal_segments) > 2:
        chunks = []
        for seg in legal_segments:
            seg = seg.strip()
            if len(seg) > 30:
                chunks.append({
                    "doc_id": doc_id,
                    "doc_text": seg
                })
        if chunks:
            return chunks

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    curr_chunk = []
    curr_len = 0

    for p in paragraphs:
        p_len = len(p)
        if curr_len + p_len > chunk_size and curr_chunk:
            combined = "\n\n".join(curr_chunk)
            chunks.append({
                "doc_id": doc_id,
                "doc_text": combined
            })
            curr_chunk = [p]
            curr_len = p_len
        else:
            curr_chunk.append(p)
            curr_len += p_len

    if curr_chunk:
        chunks.append({
            "doc_id": doc_id,
            "doc_text": "\n\n".join(curr_chunk)
        })

    return chunks if chunks else [{"doc_id": doc_id, "doc_text": text}]


def split_sentences(text: str) -> List[str]:
    raw_sentences = re.split(r'(?<=[.!?\n])\s+', text)
    sentences = [s.strip() for s in raw_sentences if len(s.strip()) > 15]
    return sentences


def build_global_idf(corpus_tokens: List[List[str]]) -> Dict[str, float]:
    num_docs = len(corpus_tokens)
    if num_docs == 0:
        return {}
    df = {}
    for doc in corpus_tokens:
        seen = set(doc)
        for token in seen:
            df[token] = df.get(token, 0) + 1

    idf = {}
    for token, freq in df.items():
        idf[token] = math.log((num_docs - freq + 0.5) / (freq + 0.5) + 1.0)
    return idf


def extract_best_sentences(query: str, document_text: str, global_idf: Dict[str, float], top_k: int = 8, max_chars: int = 1500) -> str:
    sentences = split_sentences(document_text)
    if not sentences:
        return document_text[:max_chars]

    q_tokens = tokenize_vietnamese(query)
    q_token_set = set(q_tokens)
    if not q_token_set:
        return document_text[:max_chars]

    sent_scores = []
    for idx, sent in enumerate(sentences):
        s_tokens = tokenize_vietnamese(sent)
        score = sum(global_idf.get(t, 1.0) for t in s_tokens if t in q_token_set)
        sent_scores.append((score, idx, sent))

    sent_scores.sort(key=lambda x: x[0], reverse=True)
    selected_indices = sorted([item[1] for item in sent_scores[:top_k] if item[0] > 0])

    if not selected_indices:
        return "\n".join(sentences[:top_k])[:max_chars]

    result = []
    cur_len = 0
    for idx in selected_indices:
        s = sentences[idx]
        if cur_len + len(s) > max_chars:
            break
        result.append(s)
        cur_len += len(s)

    return "\n\n".join(result) if result else document_text[:max_chars]


class BronzeStorageManager:
    def __init__(self, local_dir: str = LOCAL_CORPUS_DIR):
        self.local_dir = local_dir
        os.makedirs(self.local_dir, exist_ok=True)
        self.headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }

    def sync_from_supabase(self, bucket_name: str = BRONZE_BUCKET) -> List[str]:
        downloaded = []
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.warning("Supabase URL or Key missing.")
            return downloaded

        target_buckets = ["general_bucket", "finance_bucket", "science_bucket", "bronze_storage"]
        if bucket_name and bucket_name not in target_buckets:
            target_buckets.append(bucket_name)

        for b_name in target_buckets:
            for prefix in ["bronze", ""]:
                try:
                    list_url = f"{SUPABASE_URL}/storage/v1/object/list/{b_name}"
                    req = urllib.request.Request(
                        list_url,
                        data=json.dumps({"prefix": prefix, "limit": 100, "offset": 0}).encode("utf-8"),
                        headers=self.headers,
                        method="POST"
                    )
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        file_list = json.loads(resp.read().decode("utf-8"))

                    for f in file_list:
                        fname = f.get("name")
                        if not fname or fname.startswith(".") or fname == "bronze":
                            continue
                        
                        full_key = f"{prefix}/{fname}".strip("/") if prefix else fname
                        pub_url = f"{SUPABASE_URL}/storage/v1/object/public/{b_name}/{full_key}"
                        auth_url = f"{SUPABASE_URL}/storage/v1/object/authenticated/{b_name}/{full_key}"
                        
                        file_bytes = None
                        try:
                            d_req = urllib.request.Request(pub_url, headers=self.headers)
                            with urllib.request.urlopen(d_req, timeout=20) as d_resp:
                                file_bytes = d_resp.read()
                        except Exception:
                            try:
                                d_req = urllib.request.Request(auth_url, headers=self.headers)
                                with urllib.request.urlopen(d_req, timeout=20) as d_resp:
                                    file_bytes = d_resp.read()
                            except Exception:
                                pass
                        
                        if file_bytes:
                            local_path = os.path.join(self.local_dir, fname)
                            with open(local_path, "wb") as out_f:
                                out_f.write(file_bytes)
                            if fname not in downloaded:
                                downloaded.append(fname)
                                logger.info(f"Downloaded: {fname} ({len(file_bytes)} bytes)")
                except Exception as ex:
                    logger.warning(f"Error scanning {b_name}/{prefix}: {ex}")

        try:
            tbl_url = f"{SUPABASE_URL}/rest/v1/files?select=*"
            t_req = urllib.request.Request(tbl_url, headers=self.headers)
            with urllib.request.urlopen(t_req, timeout=15) as t_resp:
                records = json.loads(t_resp.read().decode("utf-8"))
            for rec in records:
                name = rec.get("name")
                storage_path = rec.get("storage_path") or ""
                if not storage_path or not name:
                    continue
                parts = storage_path.split("/", 1)
                b_name = parts[0]
                inner = parts[1] if len(parts) > 1 else name
                try:
                    d_req = urllib.request.Request(f"{SUPABASE_URL}/storage/v1/object/public/{b_name}/{inner}", headers=self.headers)
                    with urllib.request.urlopen(d_req, timeout=20) as d_resp:
                        data = d_resp.read()
                        safe_name = name.replace("/", "_").replace("\\", "_")
                        with open(os.path.join(self.local_dir, safe_name), "wb") as out_f:
                            out_f.write(data)
                        if safe_name not in downloaded:
                            downloaded.append(safe_name)
                            logger.info(f"Downloaded from files table: {safe_name}")
                except Exception:
                    pass
        except Exception:
            pass

        return downloaded

    def get_document_catalog(self) -> List[Dict[str, Any]]:
        catalog = []
        all_files = glob.glob(os.path.join(self.local_dir, "*.*")) + glob.glob(os.path.join("DeBai", "*.*"))
        seen_files = set()

        for file_path in all_files:
            fname = os.path.basename(file_path)
            if fname in seen_files or fname.startswith("."):
                continue
            seen_files.add(fname)

            size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            if size_bytes >= 1024 * 1024:
                size_str = f"{size_bytes / (1024 * 1024):.1f} MB"
            elif size_bytes >= 1024:
                size_str = f"{size_bytes / 1024:.1f} KB"
            else:
                size_str = f"{size_bytes} B"

            chunks = extract_text_from_file(file_path)
            total_pages = len(chunks)

            preview_text = ""
            if chunks:
                preview_text = "\n".join([c["text"] for c in chunks[:2]]).strip()
                if len(preview_text) > 300:
                    preview_text = preview_text[:300] + "..."

            display_title = clean_document_title(fname)

            catalog.append({
                "file_name": fname,
                "display_name": display_title,
                "clean_name": re.sub(r'\.[^/.]+$', '', display_title),
                "total_pages": total_pages,
                "file_size": size_str,
                "preview": preview_text or "Tài liệu văn bản số hóa"
            })

        return catalog

    def load_all_documents(self) -> Dict[str, str]:
        corpus: Dict[str, str] = {}
        all_files = glob.glob(os.path.join(self.local_dir, "*.*")) + glob.glob(os.path.join("DeBai", "*.*"))
        
        for file_path in all_files:
            extracted_chunks = extract_text_from_file(file_path)
            for c in extracted_chunks:
                corpus[c["chunk_id"]] = c["text"]

        logger.info(f"Loaded {len(corpus)} document chunks from {len(all_files)} files.")
        return corpus


class RAGEngine:
    def __init__(self):
        self.corpus: Dict[str, str] = {}
        self.doc_ids: List[str] = []
        self.article_chunks: List[Dict[str, str]] = []
        self.bm25_index: Optional[BM25Okapi] = None
        self.tfidf_vectorizer: Optional[TfidfVectorizer] = None
        self.tfidf_matrix = None
        self.global_idf: Dict[str, float] = {}
        self.is_ready = False
        self.last_indexed_time = None

    def build_index(self, corpus: Dict[str, str]):
        if not corpus:
            self.is_ready = False
            return

        self.corpus = corpus
        self.doc_ids = list(corpus.keys())

        self.article_chunks = []
        for doc_id, doc_text in self.corpus.items():
            self.article_chunks.extend(adaptive_chunking(doc_id, doc_text))

        # 1. Build Okapi BM25 index with Vietnamese tokenization
        corpus_tokens = [tokenize_vietnamese(text) for text in self.corpus.values()]
        self.bm25_index = BM25Okapi(corpus_tokens)
        self.global_idf = build_global_idf(corpus_tokens)

        # 2. Build TF-IDF Semantic n-gram index (Ultra lightweight < 20MB RAM)
        chunk_texts = [c["doc_text"] for c in self.article_chunks]
        self.tfidf_vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=25000)
        self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(chunk_texts)

        self.is_ready = True
        self.last_indexed_time = time.strftime("%Y-%m-%d %H:%M:%S")
        logger.info(f"RAG Index ready: {len(self.corpus)} chunks indexed.")

    def query(self, question: str, top_k_docs: int = 3, use_llm: bool = False) -> Dict[str, Any]:
        if not self.is_ready or not self.corpus:
            return {
                "answer": "Hệ thống RAG chưa có dữ liệu.",
                "sources": [],
                "retrieved_docs": []
            }

        # BM25 scores
        q_tokens = tokenize_vietnamese(question)
        bm25_scores = self.bm25_index.get_scores(q_tokens)
        bm25_ranks = {
            self.doc_ids[i]: rank + 1
            for rank, i in enumerate(np.argsort(bm25_scores)[::-1][:20])
        }

        # TF-IDF Cosine similarity
        q_vec = self.tfidf_vectorizer.transform([question])
        cos_sim = cosine_similarity(q_vec, self.tfidf_matrix)[0]
        top_chunk_indices = np.argsort(cos_sim)[::-1][:20]

        tfidf_ranks = {}
        for rank, chunk_idx in enumerate(top_chunk_indices):
            parent_doc_id = self.article_chunks[chunk_idx]["doc_id"]
            if parent_doc_id not in tfidf_ranks:
                tfidf_ranks[parent_doc_id] = rank + 1

        # Reciprocal Rank Fusion (RRF)
        fused_score = {}
        for doc_id in set(bm25_ranks) | set(tfidf_ranks):
            fused_score[doc_id] = (
                1.0 / (60.0 + bm25_ranks.get(doc_id, 999)) +
                1.0 / (60.0 + tfidf_ranks.get(doc_id, 999))
            )

        ranked_doc_ids = [
            doc_id
            for doc_id, _ in sorted(fused_score.items(), key=lambda x: (x[1], x[0]), reverse=True)[:top_k_docs]
        ]

        if not ranked_doc_ids:
            return {
                "answer": "Không tìm thấy thông tin phù hợp trong Bronze Storage.",
                "sources": [],
                "retrieved_docs": []
            }

        best_doc_id = ranked_doc_ids[0]
        context_text = self.corpus.get(best_doc_id, "")

        extracted_answer = extract_best_sentences(question, context_text, self.global_idf, top_k=8, max_chars=1500)

        final_answer = extracted_answer
        if use_llm and HAVE_GEMINI and gemini_model:
            try:
                prompt = f"""Bạn là trợ lý tài liệu thông minh WorkHub. Dựa vào nội dung trích xuất từ tài liệu sau đây, hãy trả lời câu hỏi một cách chính xác, chi tiết, logic và đầy đủ:

[Nội dung tài liệu trích xuất]:
{extracted_answer or context_text[:2500]}

[Câu hỏi]: {question}

Hãy trả lời bằng tiếng Việt chuyên nghiệp, định dạng Markdown đẹp mắt (dùng tiêu đề, gạch đầu dòng, bảng số liệu nếu có)."""
                resp = gemini_model.generate_content(prompt)
                if resp and resp.text:
                    final_answer = resp.text
            except Exception as e:
                logger.warning(f"Gemini LLM error: {e}")

        # Chuẩn hóa tên nguồn trích dẫn
        clean_sources = []
        for d_id in ranked_doc_ids:
            parts = d_id.split("#")
            clean_file = clean_document_title(parts[0])
            if len(parts) > 1:
                clean_page = parts[1].replace("_", " ")
                clean_sources.append(f"{clean_file} ({clean_page})")
            else:
                clean_sources.append(clean_file)

        retrieved_details = []
        for d_id in ranked_doc_ids:
            parts = d_id.split("#")
            clean_file = clean_document_title(parts[0])
            page_info = f" ({parts[1].replace('_', ' ')})" if len(parts) > 1 else ""
            retrieved_details.append({
                "doc_id": d_id,
                "display_name": f"{clean_file}{page_info}",
                "text": self.corpus.get(d_id, "")[:400] + "...",
                "score": float(fused_score.get(d_id, 0.0))
            })

        return {
            "answer": final_answer,
            "sources": clean_sources,
            "best_doc_id": clean_sources[0] if clean_sources else "",
            "retrieved_docs": retrieved_details
        }


app = FastAPI(title="WorkHub Universal RAG API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage_mgr = BronzeStorageManager(LOCAL_CORPUS_DIR)
rag_engine = RAGEngine()


@app.on_event("startup")
def startup_event():
    try:
        storage_mgr.sync_from_supabase()
    except Exception as e:
        logger.warning(f"Startup sync error: {e}")
    corpus = storage_mgr.load_all_documents()
    if corpus:
        rag_engine.build_index(corpus)


class ChatQueryRequest(BaseModel):
    question: str
    top_docs: Optional[int] = 3
    use_llm: Optional[bool] = False


class SyncRequest(BaseModel):
    bucket_name: Optional[str] = BRONZE_BUCKET


@app.get("/")
def home():
    catalog = storage_mgr.get_document_catalog()
    return {
        "service": "WorkHub Universal RAG API",
        "status": "online",
        "is_indexed": rag_engine.is_ready,
        "docs_count": len(catalog),
        "chunks_count": len(rag_engine.article_chunks),
        "last_indexed": rag_engine.last_indexed_time
    }


@app.get("/api/status")
def get_status():
    catalog = storage_mgr.get_document_catalog()
    return {
        "status": "ready" if rag_engine.is_ready else "empty",
        "model": "BM25 + TF-IDF + Gemini",
        "device": "cpu",
        "documents_indexed": len(catalog),
        "chunks_indexed": len(rag_engine.corpus),
        "have_gemini": HAVE_GEMINI,
        "have_underthesea": HAVE_UNDERTHESEA,
        "have_pypdf": HAVE_PYPDF,
        "have_docx": HAVE_DOCX,
        "last_indexed": rag_engine.last_indexed_time,
        "local_storage_dir": LOCAL_CORPUS_DIR
    }


@app.post("/api/chat")
def chat_endpoint(req: ChatQueryRequest):
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống.")

    res = rag_engine.query(
        question=req.question.strip(),
        top_k_docs=req.top_docs or 3,
        use_llm=req.use_llm or False
    )
    return {
        "success": True,
        "data": res
    }


@app.post("/api/sync")
def sync_bronze_storage(req: SyncRequest = SyncRequest()):
    try:
        bucket = req.bucket_name or BRONZE_BUCKET
        downloaded = storage_mgr.sync_from_supabase(bucket)
        corpus = storage_mgr.load_all_documents()
        catalog = storage_mgr.get_document_catalog()
        if corpus:
            rag_engine.build_index(corpus)
            return {
                "success": True,
                "message": f"Đã đồng bộ {len(downloaded)} file và tạo chỉ mục {len(catalog)} tài liệu ({len(corpus)} trang/phân đoạn).",
                "downloaded_files": downloaded,
                "total_documents": len(catalog),
                "total_chunks": len(rag_engine.article_chunks)
            }
        else:
            return {
                "success": False,
                "message": "Không tìm thấy tài liệu nào trong Bronze Storage.",
                "downloaded_files": downloaded
            }
    except Exception as e:
        logger.error(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents")
def list_documents():
    catalog = storage_mgr.get_document_catalog()
    return {
        "total": len(catalog),
        "items": catalog
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=True)
