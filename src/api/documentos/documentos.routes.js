const { Router } = require('express');
const pool = require('../../db');
const multer = require('multer');
const AWS = require('aws-sdk'); // Importamos el SDK de AWS
const checkAuth = require('../../middleware/checkAuth'); 

const router = Router();

// --- Configuración de AWS S3 ---
// Creamos una instancia de S3. Automáticamente leerá las variables de .env
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_BUCKET_REGION,
});

const upload = multer({ storage: multer.memoryStorage() });

/**
 * Función "helper" para subir un archivo a S3
 * @param {object} file - El archivo de multer (req.file)
 * @param {number} userId - El ID del usuario (para organizar la carpeta)
 * @returns {Promise<object>} - La respuesta de S3 (incluye .Location)
 */
const uploadToS3 = (file, userId, fileType) => {
  const bucketName = process.env.AWS_BUCKET_NAME;

  // Creamos un nombre de archivo único para S3
  // Ej: renade/1007/foto_167888654.jpg
  const key = `renade/${userId}/${fileType}_${Date.now()}_${file.originalname}`;

  const params = {
    Bucket: bucketName,
    Key: key,
    Body: file.buffer,        // El archivo en sí
    ContentType: file.mimetype, // El tipo de archivo (ej. image/jpeg)
           
  };

  //  Subimos el archivo y devolvemos la promesa
  return s3.upload(params).promise();
};

// --- SUBIR DOCUMENTOS DE RENADE ---
//  Añadimos checkAuth para obtener el ID del usuario del token
router.post('/renade', checkAuth, upload.fields([{ name: 'foto', maxCount: 1 }, { name: 'curp', maxCount: 1 }]), async (req, res) => {
  
  const { id: id_usuario } = req.userData;

  const fotoFile = req.files.foto ? req.files.foto[0] : null;
  const curpFile = req.files.curp ? req.files.curp[0] : null;

  if (!fotoFile || !curpFile) {
    return res.status(400).json({ error: 'Se requieren ambos archivos (foto y CURP).' });
  }

  try {
    //  Subimos ambos archivos a S3 en paralelo 
    const [fotoData, curpData] = await Promise.all([
      uploadToS3(fotoFile, id_usuario, 'foto'),
      uploadToS3(curpFile, id_usuario, 'curp')
    ]);

    //  Obtenemos las URLs públicas reales de S3
    const fotoDataLocation = fotoData.Location;
    const curpDataLocation = curpData.Location;

    console.log('Archivos subidos a S3. URLs generadas:', { fotoDataLocation, curpDataLocation });

    //  Guardamos las URLs reales en la base de datos 
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

// --- OBTENER SOLICITUDES RENADE PENDIENTES (GET /renade/pendientes) ---
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

// --- ACTUALIZAR ESTADO DE SOLICITUD RENADE (PUT /renade/:id) ---
router.put('/renade/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  const { nuevoEstado, motivoRechazo } = req.body;

  if (!nuevoEstado || !['Validado', 'Rechazado'].includes(nuevoEstado)) {
      return res.status(400).json({ error: 'Estado inválido.' });
  }

  try {
    const result = await pool.query(
      'UPDATE Documentos_RENADE SET estatus_validacion = $1, fecha_validacion = NOW() WHERE id = $2 RETURNING *',
      [nuevoEstado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud RENADE no encontrada.' });
    }
    
    const solicitudActualizada = result.rows[0];

    // Lógica de notificación 
    try {
      let mensajeNotificacion = '';
      if (nuevoEstado === 'Validado') {
        mensajeNotificacion = '¡Buenas noticias! Tus documentos de RENADE han sido validados por un administrador.';
      } else {
        mensajeNotificacion = `Tu solicitud de RENADE fue rechazada. Motivo: ${motivoRechazo || 'Sin motivo'}`;
      }

      await fetch('http://localhost:4000/api/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_usuario: solicitudActualizada.id_usuario,
          mensaje: mensajeNotificacion
        })
      });

    } catch (notificationError) {
      console.error('Error al enviar la notificación:', notificationError.message);
    }

    res.json(solicitudActualizada);

  } catch (error) {
    console.error('Error al actualizar solicitud RENADE:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;