import os
import re
import gc
import json
import glob
import time
import csv
from typing import Dict, List, Optional, Any
from pathlib import Path

import numpy as np
import torch
import faiss
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://gqsbsqaxzpzcloaopzvv.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR")
BRONZE_BUCKET = os.getenv("BRONZE_BUCKET", "general_bucket")
LOCAL_CORPUS_DIR = os.getenv("LOCAL_CORPUS_DIR", "./data_bronze")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "keepitreal/vietnamese-sbert")
PORT = int(os.getenv("PORT", "8000"))
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

if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        HAVE_GEMINI = True
    except Exception:
        HAVE_GEMINI = False
else:
    HAVE_GEMINI = False


def tokenize_vietnamese(text: str) -> List[str]:
    clean_text = re.sub(r'[^\w\s]', " ", text).lower()
    if HAVE_UNDERTHESEA:
        return word_tokenize(clean_text, format="text").split()
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
        except Exception:
            pass

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
        except Exception:
            pass

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
        except Exception:
            pass

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
        except Exception:
            pass

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
        except Exception:
            pass

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
        except Exception:
            pass

    return chunks


def adaptive_chunking(doc_id: str, text: str, chunk_size: int = 700, chunk_overlap: int = 150) -> List[Dict[str, str]]:
    legal_segments = re.split(r'(?i)\n(Điều\s+\d+.*?)(?=\nĐiều\s+\d+|$)', text)
    legal_segments = [seg.strip() for seg in legal_segments if seg.strip()]

    if len(legal_segments) > 1:
        return [
            {"id": f"{doc_id}_{idx}", "doc_id": doc_id, "doc_text": seg}
            for idx, seg in enumerate(legal_segments)
        ]

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [text]

    chunks = []
    current_chunk = ""
    chunk_index = 0

    for para in paragraphs:
        if len(current_chunk) + len(para) <= chunk_size:
            current_chunk += ("\n\n" + para if current_chunk else para)
        else:
            if current_chunk:
                chunks.append({
                    "id": f"{doc_id}_chunk_{chunk_index}",
                    "doc_id": doc_id,
                    "doc_text": current_chunk.strip()
                })
                chunk_index += 1
                current_chunk = current_chunk[-chunk_overlap:] + "\n\n" + para
            else:
                for i in range(0, len(para), chunk_size - chunk_overlap):
                    sub = para[i:i + chunk_size].strip()
                    if sub:
                        chunks.append({
                            "id": f"{doc_id}_chunk_{chunk_index}",
                            "doc_id": doc_id,
                            "doc_text": sub
                        })
                        chunk_index += 1
                current_chunk = ""

    if current_chunk.strip():
        chunks.append({
            "id": f"{doc_id}_chunk_{chunk_index}",
            "doc_id": doc_id,
            "doc_text": current_chunk.strip()
        })

    return chunks


def split_sentences(text: str) -> List[str]:
    text = re.sub(r'\s+', ' ', text).strip()
    parts = re.split(r'(?<=[.!?])\s+(?=[A-ZĐ0-9])', text)
    return [p.strip() for p in parts if p.strip()]


def get_bigrams(tokens: List[str]):
    return set(zip(tokens, tokens[1:])) if len(tokens) >= 2 else set()


def extract_numbers_and_codes(text: str):
    return set(re.findall(r'\d+(?:[./]\d+)*[A-ZĐ\-]*', text))


def build_global_idf(corpus_tokens: List[List[str]]) -> Dict[str, float]:
    doc_freq = {}
    for doc_toks in corpus_tokens:
        for token in set(doc_toks):
            doc_freq[token] = doc_freq.get(token, 0) + 1
    n_docs = len(corpus_tokens)
    return {token: float(np.log(n_docs / (1 + freq))) for token, freq in doc_freq.items()}


def extract_best_sentences(question: str, context: str, idf_table: Dict[str, float], top_k: int = 8, max_chars: int = 1500) -> str:
    if not question.strip() or not context.strip():
        return ""
    sentences = split_sentences(context)
    if not sentences:
        return context[:max_chars]

    question_tokens_list = tokenize_vietnamese(question)
    question_tokens = set(question_tokens_list)
    question_bigrams = get_bigrams(question_tokens_list)
    question_numbers = extract_numbers_and_codes(question)

    scored = []
    for idx, sentence in enumerate(sentences):
        sentence_tokens_list = tokenize_vietnamese(sentence)
        sentence_tokens = set(sentence_tokens_list)

        unigram_score = sum(idf_table.get(t, 0) for t in question_tokens & sentence_tokens)

        sentence_bigrams = get_bigrams(sentence_tokens_list)
        bigram_score = 4.0 * len(question_bigrams & sentence_bigrams)

        sentence_numbers = extract_numbers_and_codes(sentence)
        num_score = 3.0 * len(question_numbers & sentence_numbers)

        total_score = unigram_score + bigram_score + num_score
        scored.append((total_score, idx, sentence))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]
    top.sort(key=lambda x: x[1])

    answer = " ".join(s[2] for s in top)
    if len(answer) > max_chars:
        answer = answer[:max_chars].rsplit(" ", 1)[0] + "..."
    return answer or context[:max_chars]


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
                except Exception:
                    pass

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
                except Exception:
                    pass
        except Exception:
            pass

        return downloaded

    def load_all_documents(self) -> Dict[str, str]:
        corpus: Dict[str, str] = {}
        all_files = glob.glob(os.path.join(self.local_dir, "*.*")) + glob.glob(os.path.join("DeBai", "*.*"))
        
        for file_path in all_files:
            extracted_chunks = extract_text_from_file(file_path)
            for c in extracted_chunks:
                corpus[c["chunk_id"]] = c["text"]

        return corpus


class RAGEngine:
    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.embedder: Optional[SentenceTransformer] = None
        self.corpus: Dict[str, str] = {}
        self.doc_ids: List[str] = []
        self.article_chunks: List[Dict[str, str]] = []
        self.bm25_index: Optional[BM25Okapi] = None
        self.dense_index: Optional[faiss.IndexFlatIP] = None
        self.global_idf: Dict[str, float] = {}
        self.is_ready = False
        self.last_indexed_time = None

    def load_model(self):
        if self.embedder is None:
            self.embedder = SentenceTransformer(self.model_name, device=self.device)

    def build_index(self, corpus: Dict[str, str]):
        if not corpus:
            self.is_ready = False
            return

        self.corpus = corpus
        self.doc_ids = list(corpus.keys())
        self.load_model()

        self.article_chunks = []
        for doc_id, doc_text in self.corpus.items():
            self.article_chunks.extend(adaptive_chunking(doc_id, doc_text))

        corpus_tokens = [tokenize_vietnamese(text) for text in self.corpus.values()]
        self.bm25_index = BM25Okapi(corpus_tokens)
        self.global_idf = build_global_idf(corpus_tokens)
        del corpus_tokens
        gc.collect()

        chunk_texts = [c["doc_text"] for c in self.article_chunks]
        embeddings = self.embedder.encode(chunk_texts, convert_to_numpy=True, show_progress_bar=False)
        faiss.normalize_L2(embeddings)

        dim = embeddings.shape[1]
        self.dense_index = faiss.IndexFlatIP(dim)
        self.dense_index.add(embeddings)
        del embeddings
        gc.collect()

        self.is_ready = True
        self.last_indexed_time = time.strftime("%Y-%m-%d %H:%M:%S")

    def query(self, question: str, top_k_docs: int = 3, use_llm: bool = False) -> Dict[str, Any]:
        if not self.is_ready or not self.corpus:
            return {
                "answer": "Hệ thống RAG chưa có dữ liệu.",
                "sources": [],
                "retrieved_docs": []
            }

        q_tokens = tokenize_vietnamese(question)
        bm25_scores = self.bm25_index.get_scores(q_tokens)
        bm25_ranks = {
            self.doc_ids[i]: rank + 1
            for rank, i in enumerate(np.argsort(bm25_scores)[::-1][:20])
        }

        q_embed = self.embedder.encode([question], convert_to_numpy=True)
        faiss.normalize_L2(q_embed)
        sim_scores, top_chunk_indices = self.dense_index.search(q_embed, min(20, len(self.article_chunks)))

        dense_ranks = {}
        for rank, chunk_idx in enumerate(top_chunk_indices[0]):
            parent_doc_id = self.article_chunks[chunk_idx]["doc_id"]
            if parent_doc_id not in dense_ranks:
                dense_ranks[parent_doc_id] = rank + 1

        fused_score = {}
        for doc_id in set(bm25_ranks) | set(dense_ranks):
            fused_score[doc_id] = (
                1.0 / (60.0 + bm25_ranks.get(doc_id, 999)) +
                1.0 / (60.0 + dense_ranks.get(doc_id, 999))
            )

        ranked_doc_ids = [
            doc_id
            for doc_id, _ in sorted(fused_score.items(), key=lambda x: (x[1], x[0]), reverse=True)[:top_k_docs]
        ]

        if not ranked_doc_ids:
            return {
                "answer": "Không tìm thấy thông tin phù hợp trong kho tài liệu Bronze Storage.",
                "sources": [],
                "retrieved_docs": []
            }

        best_doc_id = ranked_doc_ids[0]
        context_text = self.corpus.get(best_doc_id, "")

        extracted_answer = extract_best_sentences(question, context_text, self.global_idf, top_k=8, max_chars=1500)

        final_answer = extracted_answer
        if use_llm and HAVE_GEMINI:
            try:
                prompt = f"""Bạn là trợ lý tài liệu thông minh. Dựa vào nội dung trích xuất từ tài liệu sau đây, hãy trả lời câu hỏi một cách chính xác, rõ ràng và đầy đủ:

[Nội dung tài liệu trích xuất]:
{extracted_answer or context_text[:2000]}

[Câu hỏi]: {question}

Hãy trả lời bằng tiếng Việt, định dạng Markdown đẹp mắt."""
                resp = gemini_model.generate_content(prompt)
                if resp.text:
                    final_answer = resp.text
            except Exception:
                final_answer = extracted_answer

        retrieved_details = []
        for d_id in ranked_doc_ids:
            snippet = self.corpus.get(d_id, "")[:300] + "..."
            retrieved_details.append({
                "doc_id": d_id,
                "score": round(float(fused_score.get(d_id, 0.0)) * 100, 3),
                "snippet": snippet
            })

        return {
            "answer": final_answer,
            "best_doc_id": best_doc_id,
            "sources": ranked_doc_ids,
            "retrieved_docs": retrieved_details
        }


app = FastAPI(title="WorkHub Universal RAG API", version="2.5.0")

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
    except Exception:
        pass
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
    return {
        "service": "WorkHub Universal RAG API",
        "status": "online",
        "is_indexed": rag_engine.is_ready,
        "docs_count": len(rag_engine.corpus),
        "chunks_count": len(rag_engine.article_chunks),
        "last_indexed": rag_engine.last_indexed_time
    }


@app.get("/api/status")
def get_status():
    return {
        "status": "ready" if rag_engine.is_ready else "empty",
        "model": EMBEDDING_MODEL_NAME,
        "device": rag_engine.device,
        "documents_indexed": len(rag_engine.corpus),
        "chunks_indexed": len(rag_engine.article_chunks),
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
        if corpus:
            rag_engine.build_index(corpus)
            return {
                "success": True,
                "message": f"Đã đồng bộ {len(downloaded)} file và tạo chỉ mục {len(corpus)} tài liệu/phân đoạn.",
                "downloaded_files": downloaded,
                "total_documents": len(corpus),
                "total_chunks": len(rag_engine.article_chunks)
            }
        else:
            return {
                "success": False,
                "message": "Không tìm thấy tài liệu nào trong Bronze Storage.",
                "downloaded_files": downloaded
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents")
def list_documents():
    docs_summary = []
    for doc_id, text in list(rag_engine.corpus.items())[:100]:
        docs_summary.append({
            "doc_id": doc_id,
            "length": len(text),
            "preview": text[:150] + "..." if len(text) > 150 else text
        })
    return {
        "total": len(rag_engine.corpus),
        "items": docs_summary
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=True)
