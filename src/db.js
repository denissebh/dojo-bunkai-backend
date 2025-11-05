const { Pool } = require('pg');
require('dotenv').config();

// Creamos un nuevo "pool" de conexiones usando las variables de entorno
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Exportamos el pool para poder usarlo en otras partes de la aplicación
module.exports = pool;