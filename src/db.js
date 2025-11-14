const { Pool } = require('pg');
require('dotenv').config();

// Detectamos si estamos en producción
const isProduction = process.env.NODE_ENV === 'production';

//  Configuramos las credenciales según el entorno
const connectionConfig = {
  user: isProduction ? process.env.PROD_DB_USER : process.env.DB_USER,
  host: isProduction ? process.env.PROD_DB_HOST : process.env.DB_HOST,
  database: isProduction ? process.env.PROD_DB_DATABASE : process.env.DB_DATABASE,
  password: isProduction ? process.env.PROD_DB_PASSWORD : process.env.DB_PASSWORD,
  port: isProduction ? process.env.PROD_DB_PORT : process.env.DB_PORT,
};

// Si estamos en producción, forzamos la conexión SSL que AWS requiere.
if (isProduction) {
  connectionConfig.ssl = {
    rejectUnauthorized: false
  };
}

//Creamos el "pool" de conexiones con la configuración correcta
const pool = new Pool(connectionConfig);

// Exportamos el pool
module.exports = pool;