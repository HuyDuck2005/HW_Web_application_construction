FROM node:20-alpine
WORKDIR /app
COPY ./graphql-server/package*.json ./
RUN npm install --production
COPY ./graphql-server/src ./src
COPY ./protos ./protos
EXPOSE 4000
CMD ["sh", "-c", "npm start"]
