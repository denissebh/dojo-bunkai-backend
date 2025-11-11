const { Router } = require('express');
const pool = require('../../db');

const router = Router();

const sendNotification = async (id_usuario, mensaje) => {
  try {

    await fetch('http://localhost:4000/api/notificaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_usuario, mensaje })
    });
    console.log(`[MS Pagos] Notificación enviada para usuario ${id_usuario}`);
  } catch (err) {

    console.error(`[MS Pagos] Error al intentar enviar notificación: ${err.message}`);
  }
};


// --- OBTENER TODOS LOS PAGOS (GET /) ---
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pagos.id, pagos.concepto, pagos.fecha_vencimiento, pagos.estatus_pago, pagos.tipo_pago, usuarios.nombre AS studentName 
       FROM Pagos 
       JOIN Usuarios ON pagos.id_usuario = usuarios.id 
       ORDER BY pagos.fecha_vencimiento DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener los pagos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- AÑADIR UN NUEVO PAGO (POST /) ---
router.post('/', async (req, res) => {
  const { id_usuario, monto, concepto, estatus_pago, fecha_vencimiento, tipo_pago } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO Pagos (id_usuario, monto, concepto, estatus_pago, fecha_vencimiento, tipo_pago) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id_usuario, monto, concepto, estatus_pago, fecha_vencimiento, tipo_pago]
    );
    
    const newPayment = result.rows[0];

    // Si el admin registra un nuevo pago PENDIENTE, notifica al alumno.
    if (newPayment.estatus_pago === 'Pendiente') {
      await sendNotification(newPayment.id_usuario, 
        `Se ha registrado un nuevo pago pendiente: ${newPayment.concepto} (Vence: ${new Date(newPayment.fecha_vencimiento).toLocaleDateString()}).`
      );
    }

    res.status(201).json(newPayment);
  } catch (error) {
    console.error('Error al crear el pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- ACTUALIZAR ESTADO DE UN PAGO (PUT /:id) ---
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { estatus_pago } = req.body;

  if (!estatus_pago || !['Pagado', 'Pendiente', 'Vencido'].includes(estatus_pago)) {
    return res.status(400).json({ error: 'Estado de pago inválido.' });
  }

  try {    

    let updateQuery = 'UPDATE Pagos SET estatus_pago = $1';
    const queryParams = [estatus_pago];
    
    if (estatus_pago === 'Pagado') {
      updateQuery += ', fecha_pago = NOW()';
    }
    
    updateQuery += ' WHERE id = $2 RETURNING *';
    queryParams.push(id); 

    const result = await pool.query(updateQuery, queryParams);


    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado.' });
    }
    
    const updatedPayment = result.rows[0];


    if (updatedPayment.estatus_pago === 'Pagado') {
      await sendNotification(updatedPayment.id_usuario, 
        `¡Tu pago de "${updatedPayment.concepto}" ha sido confirmado! Gracias.`
      );
    }
    
    res.json(updatedPayment);
  } catch (error) {
    console.error('Error al actualizar el pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// --- ELIMINAR UN PAGO (DELETE /:id) ---
router.delete('/:id', async (req, res) => {

  try {
    const result = await pool.query('DELETE FROM Pagos WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Pago no encontrado.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar el pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;