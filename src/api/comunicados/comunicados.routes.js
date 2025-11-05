const { Router } = require('express');
const pool = require('../../db');

const router = Router();

// --- OBTENER TODOS LOS COMUNICADOS (GET /api/comunicados) ---
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.mensaje, c.fecha_publicacion, u.nombre AS nombre_profesor 
       FROM Comunicados c
       JOIN Usuarios u ON c.id_profesor = u.id
       ORDER BY c.fecha_publicacion DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener comunicados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- PUBLICAR UN NUEVO COMUNICADO (POST /api/comunicados) ---
router.post('/', async (req, res) => {
  const { id_profesor, mensaje } = req.body;

  try {
    //Guardamos el comunicado en la base de datos
    const result = await pool.query(
      'INSERT INTO Comunicados (id_profesor, mensaje) VALUES ($1, $2) RETURNING *',
      [id_profesor, mensaje]
    );
    const newComunicado = result.rows[0];


    const alumnosResult = await pool.query("SELECT id FROM Usuarios WHERE rol = 'Alumno'");
    const alumnosIds = alumnosResult.rows.map(a => a.id);

    // Llamamos al MS Notificaciones por cada alumno
    for (const alumnoId of alumnosIds) {
      await fetch('http://localhost:4000/api/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_usuario: alumnoId,
          mensaje: `Nuevo comunicado del profesor: "${mensaje}"`
        })
      });
    }

    console.log(`[MS Comunicados] Notificación enviada a ${alumnosIds.length} alumnos.`);
    res.status(201).json(newComunicado);

  } catch (error) {
    console.error('Error al crear comunicado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;