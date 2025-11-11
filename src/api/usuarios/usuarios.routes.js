const { Router } = require('express');
const pool = require('../../db');
const bcrypt = require('bcrypt');
const checkAuth = require('../../middleware/checkAuth');

const router = Router();

// --- CREAR UN NUEVO USUARIO ---
router.post('/', async (req, res) => {
  
 
  const { nombre, apellido_paterno, apellido_materno, correo_electronico, password, rol, grado, edad, curp, telefono, fecha_nacimiento } = req.body;
  
  const passwordToHash = password || 'dojo2025'; // Contraseña por defecto

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(passwordToHash, salt);

    const result = await pool.query(
      `INSERT INTO Usuarios 
         (nombre, apellido_paterno, apellido_materno, correo_electronico, password_hash, rol, grado, edad, curp, telefono, fecha_nacimiento) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`, 
      [nombre, apellido_paterno || 'N/A', apellido_materno, correo_electronico, password_hash, rol || 'Profesor', grado, edad, curp, telefono, fecha_nacimiento] // Añadido apellido_materno
    );

    const newUser = result.rows[0];
    delete newUser.password_hash;
    
    res.status(201).json(newUser);

  } catch (error) {
    console.error('Error al crear el usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// --- OBTENER TODOS LOS USUARIOS (GET /) ---
router.get('/', checkAuth, async (req, res) => {
  try {

    const result = await pool.query(
      `SELECT 
         id, nombre, apellido_paterno, apellido_materno, rol, grado, correo_electronico, edad, telefono, curp 
       FROM Usuarios 
       ORDER BY fecha_registro DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener los usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- ACTUALIZAR UN USUARIO (PUT /:id) ---
router.put('/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  const { 
    nombre, 
    apellido_paterno, 
    apellido_materno, 
    correo_electronico, 
    telefono, 
    curp, 
    fecha_nacimiento, 
    grupo_sanguineo, 
    alergias, 
    grado 
  } = req.body; 

  try {
    // --- CONSULTA SQL  ---
    
    const result = await pool.query(
      `UPDATE Usuarios 
       SET 
         nombre = $1, 
         apellido_paterno = $2, 
         apellido_materno = $3, 
         correo_electronico = $4, 
         telefono = $5, 
         curp = $6, 
         fecha_nacimiento = $7, 
         grupo_sanguineo = $8, 
         alergias = $9, 
         grado = $10 
       WHERE id = $11 
       RETURNING *`, 
      [
        nombre, 
        apellido_paterno, 
        apellido_materno, 
        correo_electronico, 
        telefono, 
        curp|| null, 
        fecha_nacimiento || null, 
        grupo_sanguineo, 
        alergias, 
        grado, 
        id 
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const updatedUser = result.rows[0];
    delete updatedUser.password_hash; 
    res.json(updatedUser); 

  } catch (error) {
    console.error('Error al actualizar el usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- ELIMINAR UN USUARIO (DELETE /:id) ---
router.delete('/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM Usuarios WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: `Usuario '${result.rows[0].nombre}' eliminado exitosamente.` });
  } catch (error) {
    console.error('Error al eliminar el usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- OBTENER DATOS COMPLETOS DE UN USUARIO POR ID (GET /:id/profile) ---
router.get('/:id/profile', checkAuth, async (req, res) => {
  const { id } = req.params; // ID del perfil que se QUIERE VER.
  
  

  // Nivel de Seguridad: Un Alumno solo puede ver su propio perfil
  // Comparamos el ID del token (req.userData.id) con el ID de la URL (req.params.id)
  if (req.userData.rol === 'Alumno' && req.userData.id !== parseInt(id, 10)) {
    return res.status(403).json({ error: 'Acceso denegado: No puedes ver el perfil de otro alumno.' });
  }
  

  try {
    // Obtener datos básicos del usuario
    const userResult = await pool.query('SELECT id, nombre, apellido_paterno, apellido_materno, correo_electronico, telefono, fecha_nacimiento, edad, curp, grupo_sanguineo, alergias, grado, rol FROM Usuarios WHERE id = $1', [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const userData = userResult.rows[0];

    // Obtener historial de pagos 
    const paymentsResult = await pool.query(
      `SELECT id, concepto, monto, fecha_pago, fecha_vencimiento, estatus_pago, tipo_pago 
       FROM Pagos 
       WHERE id_usuario = $1 
       ORDER BY fecha_vencimiento DESC`, 
      [id]
    );
    userData.pagos = paymentsResult.rows;

    // Obtener historial de eventos deportivos 
    const eventsResult = await pool.query('SELECT id, tipo_evento, descripcion, categoria, fecha, resultado FROM Eventos_Deportivos WHERE id_usuario = $1 ORDER BY fecha DESC', [id]);
    // Separamos los eventos 
    userData.examenes = eventsResult.rows.filter(e => e.tipo_evento === 'Examen');
    userData.torneos = eventsResult.rows.filter(e => e.tipo_evento === 'Torneo');
    userData.seminarios = eventsResult.rows.filter(e => e.tipo_evento === 'Seminario');

    res.json(userData); // Devolvemos el objeto completo

  } catch (error) {
    console.error(`Error al obtener el perfil del usuario ${id}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


module.exports = router;

