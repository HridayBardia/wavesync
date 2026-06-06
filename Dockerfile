# Use the official Bun image
FROM oven/bun:1.1.27

# Install Python, pip, and ffmpeg for yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install -U pip yt-dlp
ENV PATH="/opt/venv/bin:$PATH"

# Set the working directory
WORKDIR /app

# Copy the entire monorepo
COPY . .

# Install dependencies using bun
RUN bun install

# Build the Next.js client
RUN bun run build

# Expose port 8000 which is used by our reverse-proxy
EXPOSE 8000

# Start the backend server directly
CMD ["bun", "run", "apps/server/src/index.ts"]
