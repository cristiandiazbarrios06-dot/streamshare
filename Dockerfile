FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
<<<<<<< HEAD
RUN npm ci --omit=dev
=======
RUN npm install --omit=dev
>>>>>>> 80c12e551a1d1d8114787dd958b7c59bb04a9359
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["node","server.js"]
