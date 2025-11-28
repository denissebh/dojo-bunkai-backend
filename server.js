const express = require('express');
const cors = require('cors');
require('dotenv').config();
const iniciarCronJobs = require('./src/cronJobs');

const usuarioRoutes = require('./src/api/usuarios/usuarios.routes.js');
const pagosRoutes = require('./src/api/pagos/pagos.routes.js');
const authRoutes = require('./src/api/auth/auth.routes.js');
const seguimientoRoutes = require('./src/api/seguimiento/seguimiento.routes.js');
const actividadesRoutes = require('./src/api/actividades/actividades.routes.js');
const documentosRoutes =require('./src/api/documentos/documentos.routes.js');
const notificacionesRoutes = require('./src/api/notificaciones/notificaciones.routes.js');
const comunicadosRoutes = require('./src/api/comunicados/comunicados.routes.js');
const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- API GATEWAY ACTUALIZADO ---
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/pagos', pagosRoutes); 
app.use('/api/auth', authRoutes);
app.use('/api/seguimiento', seguimientoRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/actividades', actividadesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/comunicados', comunicadosRoutes);


app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  iniciarCronJobs();
});
