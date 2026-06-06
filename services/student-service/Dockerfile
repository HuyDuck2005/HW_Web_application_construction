FROM node:20-alpine
WORKDIR /app
COPY ./services/student-service/package*.json ./
RUN npm install --production
COPY ./services/student-service/knexfile.js ./
COPY ./services/student-service/src ./src
COPY ./protos ./protos
EXPOSE 50051
CMD ["sh", "-c", "npm start"]
