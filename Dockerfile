FROM node:12.18.4

WORKDIR /app

COPY ["package.json", "package-lock.json*", "./"]

RUN yarn

COPY . .