const { Router } = require('express');
const pool = require('../../db');

const router = Router();

// --- SIMULADOR DE ENVÍO DE NOTIFICACIÓN (POST /api/notificaciones) ---
router.post('/', async (req, res) => {
  const { id_usuario, mensaje } = req.body;

  if (!id_usuario || !mensaje) {
    return res.status(400).json({ error: 'Faltan el ID del usuario o el mensaje.' });
  }

  try {
   
    const userResult = await pool.query('SELECT correo_electronico FROM Usuarios WHERE id = $1', [id_usuario]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario para notificación no encontrado.' });
    }

    const email = userResult.rows[0].correo_electronico;

    console.log('----------------------------------------------------');
    console.log(`[SIMULACIÓN DE NOTIFICACIÓN]`);
    console.log(`DESTINATARIO: ${email} (ID: ${id_usuario})`);
    console.log(`MENSAJE: ${mensaje}`);
    console.log('----------------------------------------------------');

    await pool.query(
      'INSERT INTO Notificaciones (id_usuario, mensaje) VALUES ($1, $2)',
      [id_usuario, mensaje]
    );

    res.status(200).json({ success: true, message: 'Notificación simulada enviada.' });

  } catch (error) {
    console.error('Error en el servicio de notificaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor de notificaciones.' });
  }
});

module.exports = router;