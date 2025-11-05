const { Router } = require('express');
const pool = require('../../db');
const multer = require('multer'); 
const router = Router();


const upload = multer({ storage: multer.memoryStorage() });

// --- SUBIR DOCUMENTOS DE RENADE  ---
router.post('/renade', upload.fields([{ name: 'foto', maxCount: 1 }, { name: 'curp', maxCount: 1 }]), async (req, res) => {
  const { id_usuario } = req.body;
  
  const fotoFile = req.files.foto ? req.files.foto[0].originalname : 'foto.jpg';
  const curpFile = req.files.curp ? req.files.curp[0].originalname : 'curp.pdf';

  try {
 
    const fotoDataLocation = `https://url-simulada.com/${Date.now()}_${fotoFile}`;
    const curpDataLocation = `https://url-simulada.com/${Date.now()}_${curpFile}`;
    
    console.log('Simulando subida de archivos. URLs generadas:', { fotoDataLocation, curpDataLocation });

    // Guardamos las URLs en la base de datos
    const result = await pool.query(
      `INSERT INTO Documentos_RENADE (id_usuario, url_foto, url_curp, estatus_validacion) 
       VALUES ($1, $2, $3, 'Pendiente') RETURNING *`,
      [id_usuario, fotoDataLocation, curpDataLocation]
    );
    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error al simular la subida de documentos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- OBTENER SOLICITUDES RENADE PENDIENTES (GET /renade/pendientes) ---
router.get('/renade/pendientes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         dr.id, 
         dr.fecha_subida, 
         dr.url_foto, 
         dr.url_curp,
         u.nombre AS studentName,
         u.id AS userId
       FROM Documentos_RENADE dr
       JOIN Usuarios u ON dr.id_usuario = u.id
       WHERE dr.estatus_validacion = 'Pendiente' 
       ORDER BY dr.fecha_subida ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener solicitudes RENADE pendientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- ACTUALIZAR ESTADO DE SOLICITUD RENADE (PUT /renade/:id) ---
router.put('/renade/:id', async (req, res) => {
  const { id } = req.params;
  const { nuevoEstado, motivoRechazo } = req.body;

  if (!nuevoEstado || !['Validado', 'Rechazado'].includes(nuevoEstado)) {
      return res.status(400).json({ error: 'Estado inválido.' });
  }

  try {
    const result = await pool.query(
      'UPDATE Documentos_RENADE SET estatus_validacion = $1, fecha_validacion = NOW() WHERE id = $2 RETURNING *',
      [nuevoEstado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud RENADE no encontrada.' });
    }
    
    const solicitudActualizada = result.rows[0];

    try {
      let mensajeNotificacion = '';
      if (nuevoEstado === 'Validado') {
        mensajeNotificacion = '¡Buenas noticias! Tus documentos de RENADE han sido validados por un administrador.';
      } else {
        mensajeNotificacion = `Tu solicitud de RENADE fue rechazada. Motivo: ${motivoRechazo || 'Sin motivo'}`;
      }

  
      await fetch('http://localhost:4000/api/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_usuario: solicitudActualizada.id_usuario,
          mensaje: mensajeNotificacion
        })
      });

    } catch (notificationError) {
    
      console.error('Error al enviar la notificación:', notificationError.message);
    }

    res.json(solicitudActualizada);

  } catch (error) {
    console.error('Error al actualizar solicitud RENADE:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;