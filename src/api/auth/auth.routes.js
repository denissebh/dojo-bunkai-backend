const { Router } = require('express');
const pool = require('../../db');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

const router = Router();

// ---  POST /api/auth/login ---
router.post('/login', async (req, res) => {
  const { correo_electronico, password } = req.body;

  if (!correo_electronico || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
  }

  try {
    //Buscar al usuario por su email en la DB
    const userResult = await pool.query('SELECT * FROM Usuarios WHERE correo_electronico = $1', [correo_electronico]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    
    const user = userResult.rows[0];

    //Comparar la contraseña enviada con el hash de la DB
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    //Si la contraseña es correcta, crear un Token (JWT)
    const payload = {
      id: user.id,
      rol: user.rol,
      email: user.correo_electronico
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1d' } // El token expira en 1 día
    );

    //Enviar el token y los datos del usuario 
    delete user.password_hash;
    res.json({
      message: 'Inicio de sesión exitoso',
      token: token,
      user: user // Enviamos el perfil de la DB
    });

  } catch (error) {
    console.error('Error en /login:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---  POST /api/auth/register ---
router.post('/register', async (req, res) => {
  const { nombre, apellido_paterno, correo_electronico, password } = req.body;

  if (!nombre || !correo_electronico || !password) {
     return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos.' });
  }

  try {
    // Hashear la contraseña
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Crear el nuevo usuario
    const createResult = await pool.query(
      `INSERT INTO Usuarios (correo_electronico, password_hash, rol, nombre, apellido_paterno) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [correo_electronico, password_hash, 'Alumno', nombre, apellido_paterno || 'N/A']
    );

    const newUser = createResult.rows[0];
    delete newUser.password_hash;
    
    
    res.status(201).json(newUser);

  } catch (error)
 {
    if (error.code === '23505') {
        return res.status(400).json({ error: 'Este correo electrónico ya está registrado.' });
    }
    console.error('Error en /register:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});


module.exports = router;