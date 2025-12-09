const pool = require('../../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Nativo de Node.js
const { sendEmail } = require('../../utils/emailSender');

// --- LOGIN ---
const login = async (req, res) => {
  const { correo_electronico, password } = req.body;

  if (!correo_electronico || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
  }

  try {
    // Usamos 'usuarios' en minúsculas como indicaste
    const userResult = await pool.query('SELECT * FROM usuarios WHERE correo_electronico = $1', [correo_electronico]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    
    const user = userResult.rows[0];

    // Comparar contraseña con el hash
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    // Crear Token
    const payload = {
      id: user.id,
      rol: user.rol,
      email: user.correo_electronico
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Limpiar datos sensibles antes de enviar
    delete user.password_hash;
    delete user.reset_token; 
    delete user.reset_token_expires;

    res.json({
      message: 'Inicio de sesión exitoso',
      token: token,
      user: user
    });

  } catch (error) {
    console.error('Error en /login:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// --- REGISTRO ---
const register = async (req, res) => {
  const { nombre, apellido_paterno, correo_electronico, password } = req.body;

  if (!nombre || !correo_electronico || !password) {
     return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const createResult = await pool.query(
      `INSERT INTO usuarios (correo_electronico, password_hash, rol, nombre, apellido_paterno) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [correo_electronico, password_hash, 'Alumno', nombre, apellido_paterno || 'N/A']
    );

    const newUser = createResult.rows[0];
    delete newUser.password_hash;
    
    res.status(201).json(newUser);

  } catch (error) {
    if (error.code === '23505') {
        return res.status(400).json({ error: 'Este correo electrónico ya está registrado.' });
    }
    console.error('Error en /register:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// --- OLVIDE PASSWORD (Generar Token) ---
const olvidePassword = async (req, res) => {
  const { correo_electronico } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM usuarios WHERE correo_electronico = $1', [correo_electronico]);
    
    if (userResult.rows.length === 0) {
      // Retornamos éxito por seguridad (para no revelar qué correos existen)
      return res.json({ msg: 'Si el correo existe, se enviarán las instrucciones.' });
    }

    // Generar token
    const token = crypto.randomBytes(20).toString('hex');
    const expiracion = Date.now() + 3600000; // 1 hora

    // Guardar en BD
    await pool.query(
      'UPDATE usuarios SET reset_token = $1, reset_token_expires = $2 WHERE correo_electronico = $3',
      [token, expiracion, correo_electronico]
    );

    // URL del Frontend para resetear
    const resetUrl = `http://localhost:3000/reset-password/${token}`;
    
    // Creamos un mensaje en HTML simple (ya que tu función espera HTML)
    const mensajeHTML = `
      <h3>Recuperación de Contraseña - Dojo Bunkai</h3>
      <p>Hola,</p>
      <p>Has solicitado restablecer tu contraseña.</p>
      <p>Haz clic en el siguiente enlace para crear una nueva:</p>
      <a href="${resetUrl}" style="background-color: #d32f2f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Restablecer Contraseña</a>
      <p>Si no fuiste tú, ignora este mensaje.</p>
    `;

    // AHORA LLAMAMOS A TU FUNCIÓN CORRECTAMENTE:
    // sendEmail(destinatario, asunto, contenidoHTML)
    const enviado = await sendEmail(
      correo_electronico, 
      'Recuperación de Contraseña', 
      mensajeHTML
    );

    if (enviado) {
        res.json({ msg: 'Correo de recuperación enviado.' });
    } else {
        res.status(500).json({ error: 'No se pudo enviar el correo.' });
    }

  } catch (error) {
    console.error('Error en /olvide-password:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// --- NUEVO PASSWORD (Guardar nueva clave) ---
const nuevoPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body; // La nueva contraseña

  try {
    // Buscar usuario con ese token Y que no haya expirado
    const userResult = await pool.query(
      'SELECT * FROM usuarios WHERE reset_token = $1 AND reset_token_expires > $2',
      [token, Date.now()]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const user = userResult.rows[0];

    // Encriptar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Actualizar usuario y limpiar el token
    await pool.query(
      'UPDATE usuarios SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [password_hash, user.id]
    );

    res.json({ msg: 'Contraseña actualizada exitosamente' });

  } catch (error) {
    console.error('Error en /nuevo-password:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = {
  login,
  register,
  olvidePassword,
  nuevoPassword
};