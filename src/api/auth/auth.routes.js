const { Router } = require('express');
const authController = require('./auth.controller'); // Importamos el controlador

const router = Router();

// Rutas de Autenticación
router.post('/login', authController.login);
router.post('/register', authController.register);

// Rutas de Recuperación de Contraseña
router.post('/olvide-password', authController.olvidePassword);
router.post('/nuevo-password/:token', authController.nuevoPassword);

module.exports = router;