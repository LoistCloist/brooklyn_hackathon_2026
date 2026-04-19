FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install everything except basic-pitch first (tensorflow conflict)
RUN pip install --no-cache-dir \
    fastapi "uvicorn[standard]" python-multipart \
    essentia numpy httpx mido firebase-admin \
    python-dotenv librosa scipy scikit-learn \
    mir-eval pretty-midi "resampy<0.4.3,>=0.2.2"

# Install TF that supports Python 3.12, then basic-pitch without strict dep check
RUN pip install --no-cache-dir "tensorflow-cpu>=2.16"
RUN pip install --no-cache-dir basic-pitch --no-deps

COPY . .

ENV PORT=8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
