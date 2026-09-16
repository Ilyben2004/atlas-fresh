FROM node:22-alpine

WORKDIR /app

ENV HOST=0.0.0.0 \
    PORT=3000

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
