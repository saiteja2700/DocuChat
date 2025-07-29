from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
import hashlib
import json
import time
from dotenv import load_dotenv
load_dotenv()

# Simple embedding class that uses text hashing
class SimpleEmbeddings:
    def __init__(self):
        self.dimension = 128
    
    def embed_documents(self, texts):
        embeddings = []
        for text in texts:
            # Create a simple hash-based embedding
            hash_obj = hashlib.md5(text.encode())
            hash_hex = hash_obj.hexdigest()
            # Convert hex to list of floats
            embedding = [float(int(hash_hex[i:i+2], 16)) / 255.0 for i in range(0, 32, 2)]
            # Pad to 128 dimensions
            embedding.extend([0.0] * (128 - len(embedding)))
            embeddings.append(embedding)
        return embeddings
    
    def embed_query(self, text):
        return self.embed_documents([text])[0]

# Debug: Check if environment variables are loaded
import os
print(f"OPENAI_API_KEY set: {'OPENAI_API_KEY' in os.environ}")
if 'OPENAI_API_KEY' in os.environ:
    print(f"OPENAI_API_KEY length: {len(os.environ['OPENAI_API_KEY'])}")
    print(f"OPENAI_API_KEY starts with: {os.environ['OPENAI_API_KEY'][:10]}...")
else:
    print("OPENAI_API_KEY not found in environment variables")
from langchain.chains import RetrievalQA
from langchain_openai import OpenAI
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI()

# Allow frontend (React) to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://saiteja2700.github.io",
        "https://saiteja2700.github.io/DocuChat",
        "https://saiteja2700.github.io/DocuChat/",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

UPLOAD_DIR = "uploaded_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Chroma DB directory
CHROMA_DIR = "chroma_db"
os.makedirs(CHROMA_DIR, exist_ok=True)

class ProcessPDFRequest(BaseModel):
    filename: str

@app.get("/")
def read_root():
    return {"message": "RAG backend is running!"}

@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """Handle CORS preflight requests"""
    return {"message": "CORS preflight handled"}

@app.post("/upload-pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Endpoint to upload a PDF file.
    - Receives a PDF from the frontend.
    - Saves it to a temporary directory for processing.
    """
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"message": f"PDF '{file.filename}' uploaded successfully!", "filename": file.filename}

@app.post("/process-pdf/")
async def process_pdf(request: ProcessPDFRequest):
    try:
        filename = request.filename
        pdf_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(pdf_path):
            return {"error": f"File {filename} not found."}

        # 1. Extract text from PDF
        reader = PdfReader(pdf_path)
        full_text = ""
        for page in reader.pages:
            full_text += page.extract_text() or ""

        # 2. Split text into chunks
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_text(full_text)

        # 3. Embed each chunk (using simple embeddings)
        embeddings = SimpleEmbeddings()

        # 4. Store in Chroma (clear existing data first)
        import shutil
        if os.path.exists(CHROMA_DIR):
            shutil.rmtree(CHROMA_DIR)
        # Use a unique collection name to avoid conflicts
        collection_name = f"pdf_{int(time.time())}"
        vectordb = Chroma.from_texts(chunks, embeddings, persist_directory=CHROMA_DIR, collection_name=collection_name)
        
        # Store the collection name for the ask endpoint
        with open(os.path.join(CHROMA_DIR, "current_collection.txt"), "w") as f:
            f.write(collection_name)

        return {"message": f"PDF '{filename}' processed and stored in Chroma!", "num_chunks": len(chunks)}
    except Exception as e:
        print(f"Error in process_pdf: {str(e)}")
        return {"error": f"Processing failed: {str(e)}"}

class AskRequest(BaseModel):
    question: str

@app.post("/ask/")
async def ask_question(request: AskRequest):
    try:
        question = request.question
        # 1. Load Chroma vector store
        embeddings = SimpleEmbeddings()
        
        # Get the current collection name
        collection_file = os.path.join(CHROMA_DIR, "current_collection.txt")
        if not os.path.exists(collection_file):
            return {"error": "No PDF has been processed yet. Please upload a PDF first."}
        
        with open(collection_file, "r") as f:
            collection_name = f.read().strip()
        
        try:
            vectordb = Chroma(persist_directory=CHROMA_DIR, embedding_function=embeddings, collection_name=collection_name)
        except Exception as e:
            # If there's a dimension mismatch, clear the database and recreate
            import shutil
            if os.path.exists(CHROMA_DIR):
                shutil.rmtree(CHROMA_DIR)
            return {"error": "Database was corrupted. Please upload your PDF again."}

        # 2. Set up retriever
        retriever = vectordb.as_retriever()

        # 3. Set up LLM (OpenAI)
        from langchain_openai import OpenAI as LangChainOpenAI
        llm = LangChainOpenAI(temperature=0)

        # 4. Set up RetrievalQA chain
        qa_chain = RetrievalQA.from_chain_type(llm=llm, retriever=retriever)

        # 5. Get answer
        answer = qa_chain.invoke({"query": question})["result"]

        return {"question": question, "answer": answer}
    except Exception as e:
        print(f"Error in ask_question: {str(e)}")
        return {"error": f"Failed to get answer: {str(e)}"}

class ExtractPointsRequest(BaseModel):
    filename: str

@app.post("/extract-points/")
async def extract_points(request: ExtractPointsRequest):
    try:
        filename = request.filename
        pdf_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(pdf_path):
            return {"error": f"File {filename} not found."}

        # Extract text from PDF
        reader = PdfReader(pdf_path)
        full_text = ""
        for page in reader.pages:
            full_text += page.extract_text() or ""

        # Summarize as bullet points using OpenAI
        prompt = (
            "Read the following document and extract the most important points as concise bullet points. "
            "Be specific and cover the main ideas, facts, or steps. "
            "Return only the bullet points, one per line, no introduction or conclusion.\n\n"
            f"{full_text[:6000]}"
        )
        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.3,
        )
        content = response.choices[0].message.content.strip()
        points = [line.lstrip("-•* ").strip() for line in content.splitlines() if line.strip()]
        return {"points": points}
    except Exception as e:
        print(f"Error in extract_points: {str(e)}")
        return {"error": f"Failed to extract points: {str(e)}"} 