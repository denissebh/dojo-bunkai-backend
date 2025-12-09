const { Router } = require('express');
const pool = require('../../db');

const router = Router();

// --- OBTENER TODOS LOS EVENTOS (GET /api/actividades) ---
router.get('/', async (req, res) => {
  try {
    // Obtenemos los eventos ordenados por fecha de inicio
    const result = await pool.query('SELECT * FROM Actividades ORDER BY fecha_inicio DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener actividades:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- CREAR UN NUEVO EVENTO (POST /api/actividades) ---
router.post('/', async (req, res) => {
  const { name, date, type, imageUrl } = req.body; 

  try {
    const result = await pool.query(
      `INSERT INTO Actividades (titulo, fecha_inicio, tipo, descripcion) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, date, type, imageUrl] 
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear la actividad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- ELIMINAR UN EVENTO (DELETE /api/actividades/:id) ---
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM Actividades WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada.' });
    }
    res.status(204).send(); 
  } catch (error) {
    console.error('Error al eliminar la actividad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;