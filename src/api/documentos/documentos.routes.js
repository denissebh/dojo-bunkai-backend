const { Router } = require('express');
const pool = require('../../db');
const multer = require('multer');
const AWS = require('aws-sdk'); 
const checkAuth = require('../../middleware/checkAuth'); 
const { sendEmail } = require('../../utils/emailSender')

const router = Router();

// --- Configuración de AWS S3 ---
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_BUCKET_REGION,
});

const upload = multer({ storage: multer.memoryStorage() });

/**
 * Función "helper" para subir un archivo a S3
 */
const uploadToS3 = (file, userId, fileType) => {
  const bucketName = process.env.AWS_BUCKET_NAME;
  const key = `renade/${userId}/${fileType}_${Date.now()}_${file.originalname}`;

  const params = {
    Bucket: bucketName,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    
  };

  return s3.upload(params).promise();
};

// --- CONSULTAR ESTATUS (Para el Alumno) ---
router.get('/renade/mis-documentos', checkAuth, async (req, res) => {
  const { id } = req.userData; 
  try {
    const result = await pool.query(
      `SELECT * FROM Documentos_RENADE 
       WHERE id_usuario = $1 
       ORDER BY fecha_subida DESC LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.json({ estatus_validacion: 'Sin enviar' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error al consultar estatus:', error);
    res.status(500).json({ error: 'Error interno.' });
  }
});

// --- SUBIR DOCUMENTOS DE RENADE ---
router.post('/renade', checkAuth, upload.fields([{ name: 'foto', maxCount: 1 }, { name: 'curp', maxCount: 1 }]), async (req, res) => {
  const { id: id_usuario } = req.userData;
  const fotoFile = req.files.foto ? req.files.foto[0] : null;
  const curpFile = req.files.curp ? req.files.curp[0] : null;

  if (!fotoFile || !curpFile) {
    return res.status(400).json({ error: 'Se requieren ambos archivos (foto y CURP).' });
  }

  try {
    const [fotoData, curpData] = await Promise.all([
      uploadToS3(fotoFile, id_usuario, 'foto'),
      uploadToS3(curpFile, id_usuario, 'curp')
    ]);

    const fotoDataLocation = fotoData.Location;
    const curpDataLocation = curpData.Location;

    const result = await pool.query(
      `INSERT INTO Documentos_RENADE (id_usuario, url_foto, url_curp, estatus_validacion) 
       VALUES ($1, $2, $3, 'Pendiente') RETURNING *`,
      [id_usuario, fotoDataLocation, curpDataLocation]
    );
    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error al subir documentos a S3:', error);
    res.status(500).json({ error: 'Error interno del servidor al subir archivos.' });
  }
});

// --- ADMIN: VALIDAR O RECHAZAR  ---
router.put('/renade/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  const { nuevoEstado, motivoRechazo } = req.body; 

  try {
    const result = await pool.query(
      `UPDATE Documentos_RENADE 
       SET estatus_validacion = $1, fecha_validacion = NOW(), motivo_rechazo = $2
       WHERE id = $3 
       RETURNING *`,
      [nuevoEstado, motivoRechazo || null, id] 
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    
    const solicitud = result.rows[0];

    // --- LÓGICA DE CORREO REFACTORIZADA ---
    try {
        // 1. Buscamos datos del alumno
        const userRes = await pool.query('SELECT nombre, correo_electronico FROM Usuarios WHERE id = $1', [solicitud.id_usuario]);
        
        if (userRes.rows.length > 0) {
            const alumno = userRes.rows[0];
            let asunto = `Actualización RENADE - ${nuevoEstado}`;
            let mensajeHTML = '';

            if (nuevoEstado === 'Validado') {
                mensajeHTML = `
                    <div style="font-family: Arial; padding: 20px; border: 1px solid #4caf50; border-radius: 8px;">
                        <h2 style="color: #2e7d32;">¡Felicidades ${alumno.nombre}!</h2>
                        <p>Tus documentos RENADE han sido <b>VALIDADOS</b> correctamente en Dojo Bunkai.</p>
                        <p>Por favor continua con tu tramite en la pagina de la FEMEKA para obtener tu RENADE.</p>
                    </div>
                `;
            } else {
                mensajeHTML = `
                    <div style="font-family: Arial; padding: 20px; border: 1px solid #f44336; border-radius: 8px;">
                        <h2 style="color: #c62828;">Solicitud Rechazada</h2>
                        <p>Hola ${alumno.nombre},</p>
                        <p>Tu solicitud RENADE ha sido rechazada por el siguiente motivo:</p>
                        <blockquote style="background: #ffebee; padding: 10px;">${motivoRechazo}</blockquote>
                        <p>Por favor, ingresa a la plataforma y sube tus documentos nuevamente.</p>
                    </div>
                `;
            }

            // 2. Usamos la utilidad centralizada
            sendEmail(alumno.correo_electronico, asunto, mensajeHTML);
        }
    } catch (mailError) {
        console.error("Error enviando notificación RENADE:", mailError);
        // No detenemos la respuesta si falla el correo
    }
    // -------------------------------------

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error validando:', error);
    res.status(500).json({ error: 'Error interno.' });
  }
});
// --- OBTENER SOLICITUDES RENADE PENDIENTES ---
router.get('/renade/pendientes', checkAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         dr.id, dr.fecha_subida, dr.url_foto, dr.url_curp,
         u.nombre AS studentName, u.id AS userId
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

module.exports = router;