FROM node:22-alpine
WORKDIR /app
RUN npm i -g nodemon
COPY ./package*.json ./
RUN npm install
COPY src/ ./src/
CMD ["nodemon", "--inspect=0.0.0.0:9229", "src/start.js"]