# 1. Usamos una versión ligera de Node.js como base
FROM node:18-alpine

# 2. Creamos la carpeta de trabajo dentro del contenedor
WORKDIR /app

# 3. Copiamos los archivos de definición de dependencias primero
COPY package*.json ./

# 4. Instalamos las dependencias
RUN npm install --production

# 5. Copiamos el resto de tu código al contenedor
COPY . .

# 6. Le decimos al contenedor que tu app usa el puerto 4000
EXPOSE 4000

# 7. El comando para iniciar tu backend
CMD ["npm", "start"]