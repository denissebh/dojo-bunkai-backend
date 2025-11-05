const { Router } = require('express');
const pool = require('../../db');

const router = Router();

// --- REGISTRAR RESULTADO DE EXAMEN (POST /api/seguimiento/examenes) ---
router.post('/examenes', async (req, res) => {
    const { userId, gradoAlcanzado, date, result, puntuacion } = req.body; 
    try {
       const dbResult = await pool.query(
         `INSERT INTO Eventos_Deportivos 
         (id_usuario, tipo_evento, fecha, resultado, descripcion, puntuacion) 
         VALUES ($1, 'Examen', $2, $3, $4, $5) RETURNING *`, 
        [userId, date, result, gradoAlcanzado, puntuacion] 
     );
      res.status(201).json(dbResult.rows[0]);
    } catch (error) 
    {
      console.error('Error al guardar resultado de examen:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- REGISTRAR SEMINARIO (POST /api/seguimiento/seminarios) ---
router.post('/seminarios', async (req, res) => {
  //  Obtenemos los nuevos campos del body
  const { id_usuario, tipo_evento, descripcion, fecha, ponente } = req.body;

  try {
    // Actualizamos el query SQL para incluir 'ponente'
    const dbResult = await pool.query(
      `INSERT INTO Eventos_Deportivos
        (id_usuario, tipo_evento, descripcion, fecha, ponente)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id_usuario, tipo_evento, descripcion, fecha, ponente] // 5 valores
    );
    res.status(201).json(dbResult.rows[0]);
  } catch (error) {
    console.error('Error al guardar resultado de seminario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- REGISTRAR RESULTADO DE TORNEO (POST /api/seguimiento/torneos) ---
router.post('/torneos', async (req, res) => {
  const { id_usuario, tipo_evento, descripcion, categoria, resultado, fecha } = req.body;
  try {
     const dbResult = await pool.query(
       `INSERT INTO Eventos_Deportivos
       (id_usuario, tipo_evento, descripcion, categoria, resultado, fecha)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
     [id_usuario, tipo_evento, descripcion, categoria, resultado, fecha] 
 );
  res.status(201).json(dbResult.rows[0]);
 } catch (error) {
 console.error('Error al guardar resultado de torneo:', error);
 res.status(500).json({ error: 'Error interno del servidor' });
 }
});

module.exports = router;