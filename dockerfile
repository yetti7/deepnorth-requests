# Use an official Node.js runtime based on Alpine
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies needed for `better-sqlite3`
RUN apk add --no-cache python3 make g++ sqlite

# Copy package.json and package-lock.json first (for efficient Docker caching)
COPY package*.json ./

# Remove any existing `node_modules` to prevent architecture mismatches
RUN rm -rf node_modules

# Install dependencies inside the container (rebuilds `better-sqlite3` for Alpine)
RUN npm install --omit=dev

# Copy the rest of the application files
COPY . .

# Expose the correct port
EXPOSE 3000

# Command to run the application
CMD ["node", "app.js"]