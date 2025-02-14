# ✅ Use Debian-based image (NOT Alpine) to avoid musl/glibc issues
FROM node:18-slim

# Set working directory inside the container
WORKDIR /app

# ✅ Install system dependencies needed for `better-sqlite3`
RUN apt-get update && apt-get install -y python3 make g++ sqlite3 && rm -rf /var/lib/apt/lists/*

# ✅ Copy package.json and package-lock.json first (for efficient Docker caching)
COPY package*.json ./

# ✅ Remove any existing node_modules (fixes Windows/Linux conflicts)
RUN rm -rf node_modules

# ✅ Install dependencies inside the container (rebuilds `better-sqlite3` properly)
RUN npm install --omit=dev --force

# ✅ Copy the rest of the application files
COPY . .

# ✅ Expose the correct port
EXPOSE 3000

# ✅ Start the app
CMD ["node", "app.js"]