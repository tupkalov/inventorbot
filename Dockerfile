FROM node:22-alpine
WORKDIR /app
COPY ./package*.json ./
RUN npm install
COPY src/ ./src/
CMD ["node", "src/start.js"]