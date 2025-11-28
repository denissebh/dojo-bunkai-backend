const { Router } = require('express');
const pool = require('../../db');
const checkAuth = require('../../middleware/checkAuth');
const { sendEmail } = require('../../utils/emailSender');

const router = Router();

// --- OBTENER TODOS LOS COMUNICADOS (GET /api/comunicados) ---
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT c.*, u.nombre as autor_nombre 
            FROM Comunicados c
            LEFT JOIN Usuarios u ON c.id_autor = u.id
            ORDER BY c.fecha_publicacion DESC
        `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener comunicados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- PUBLICAR UN NUEVO COMUNICADO (POST /api/comunicados) ---
router.post('/enviar', checkAuth, async (req, res) => {
  const { asunto, mensaje, destinatarios } = req.body; 

  if (!asunto || !mensaje) {
    return res.status(400).json({ error: 'Faltan datos.' });
  }

  try {
    //  Definimos a quién se lo enviamos
    let query = 'SELECT nombre, correo_electronico FROM Usuarios';
    if (destinatarios === 'alumnos') query += " WHERE rol = 'Alumno'";
    else if (destinatarios === 'profesores') query += " WHERE rol = 'Profesor'";

    const result = await pool.query(query);
    const usuarios = result.rows;

    if (usuarios.length === 0) return res.status(404).json({ error: 'No hay destinatarios.' });

    //  Preparamos el HTML base
    const htmlContent = `
        <div style="font-family: Arial; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #D32F2F;">Nuevo Comunicado - Dojo Bunkai</h2>
          <p style="font-size: 16px; white-space: pre-wrap;">${mensaje}</p>
          <hr />
          <p style="font-size: 12px; color: #666;">Enviado por la administración.</p>
        </div>
    `;

    //  Enviamos usando la utilidad (en segundo plano para no bloquear)
    // No usamos 'await' dentro del map para que sea más rápido, o usamos Promise.all
    console.log(`Iniciando envío a ${usuarios.length} usuarios...`);
    
    usuarios.forEach(usuario => {
        sendEmail(usuario.correo_electronico, `[Aviso] ${asunto}`, htmlContent);
    });

    // Guardar en historial
    await pool.query(
      `INSERT INTO Comunicados (titulo, contenido, fecha_publicacion, id_autor) 
       VALUES ($1, $2, NOW(), $3)`,
      [asunto, mensaje, req.userData.id]
    );

    res.json({ message: `Envío iniciado a ${usuarios.length} usuarios.` });

  } catch (error) {
    console.error('Error comunicados:', error);
    res.status(500).json({ error: 'Error interno.' });
  }
});

module.exports = router;