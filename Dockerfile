FROM node:20 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./

COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]