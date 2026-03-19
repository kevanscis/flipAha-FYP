# Use Python 3.12 as the base image for the backend
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies required for OpenCV and Machine Learning libraries
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy the backend code and requirements
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/

# Install Python requirements
WORKDIR /app/backend
RUN pip install --no-cache-dir -r requirements.txt

# Expose the port the app runs on
EXPOSE 7860

# Run the app via Gunicorn for production
CMD ["gunicorn", "-b", "0.0.0.0:7860", "--timeout", "120", "--workers", "1", "--threads", "2", "app:app"]
