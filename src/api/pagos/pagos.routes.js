const { Router } = require('express');
const pool = require('../../db');
const { sendEmail } = require('../../utils/emailSender'); // Importamos la utilidad

const router = Router();

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

    // --- NOTIFICACIÓN DE NUEVO PAGO PENDIENTE ---
    if (newPayment.estatus_pago === 'Pendiente') {
        try {
            // 1. Buscamos el correo del usuario
            const userRes = await pool.query('SELECT nombre, correo_electronico FROM Usuarios WHERE id = $1', [id_usuario]);
            
            if (userRes.rows.length > 0) {
                const alumno = userRes.rows[0];
                
                const asunto = 'Nuevo Pago Asignado - Dojo Bunkai';
                const mensajeHTML = `
                    <div style="font-family: Arial; padding: 20px; border: 1px solid #f57c00; border-radius: 8px;">
                        <h2 style="color: #ef6c00;">Nuevo Pago Registrado</h2>
                        <p>Hola <b>${alumno.nombre}</b>,</p>
                        <p>Se ha registrado un nuevo pago pendiente en tu cuenta:</p>
                        <ul>
                            <li><b>Concepto:</b> ${newPayment.concepto}</li>
                            <li><b>Monto:</b> $${newPayment.monto}</li>
                            <li><b>Fecha de Vencimiento:</b> ${new Date(newPayment.fecha_vencimiento).toLocaleDateString()}</li>
                        </ul>
                        <p>Por favor, realiza el pago antes de la fecha límite.</p>
                    </div>
                `;

                // 2. Enviamos el correo
                sendEmail(alumno.correo_electronico, asunto, mensajeHTML);
            }
        } catch (mailError) {
            console.error("Error al enviar notificación de nuevo pago:", mailError);
        }
    }
    // ---------------------------------------------

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
    
    // Si se marca como pagado, actualizamos la fecha de pago a HOY
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

    // --- NOTIFICACIÓN DE PAGO EXITOSO (RECIBO) ---
    if (updatedPayment.estatus_pago === 'Pagado') {
        try {
            // 1. Buscamos el correo del usuario
            const userRes = await pool.query('SELECT nombre, correo_electronico FROM Usuarios WHERE id = $1', [updatedPayment.id_usuario]);
            
            if (userRes.rows.length > 0) {
                const alumno = userRes.rows[0];
                
                const asunto = 'Comprobante de Pago - Dojo Bunkai';
                const mensajeHTML = `
                    <div style="font-family: Arial; padding: 20px; border: 1px solid #2e7d32; border-radius: 8px;">
                        <h2 style="color: #2e7d32;">Pago Confirmado ✅</h2>
                        <p>Hola <b>${alumno.nombre}</b>, hemos recibido tu pago exitosamente.</p>
                        <hr/>
                        <p><b>Detalles del Pago:</b></p>
                        <table style="width: 100%; text-align: left;">
                            <tr><th>Concepto:</th><td>${updatedPayment.concepto}</td></tr>
                            <tr><th>Monto:</th><td>$${updatedPayment.monto}</td></tr>
                            <tr><th>Fecha de Pago:</th><td>${new Date().toLocaleDateString()}</td></tr>
                            <tr><th>Tipo:</th><td>${updatedPayment.tipo_pago}</td></tr>
                        </table>
                        <hr/>
                        <p>Gracias por tu cumplimiento.</p>
                    </div>
                `;

                // 2. Enviamos el correo
                sendEmail(alumno.correo_electronico, asunto, mensajeHTML);
            }
        } catch (mailError) {
            console.error("Error al enviar recibo de pago:", mailError);
        }
    }
    // ---------------------------------------------
    
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
