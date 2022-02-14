FROM node:12-alpine

WORKDIR /GameAPI

COPY package.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]