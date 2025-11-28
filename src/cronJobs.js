// src/cronJobs.js
const cron = require('node-cron');
const pool = require('./db'); // Ajusta la ruta a tu db.js
const { sendEmail } = require('./utils/emailSender');

const iniciarCronJobs = () => {
  console.log('⏰ Sistema de tareas programadas (Cron) iniciado.');

  // Tarea: "El día 6 de cada mes a las 9:00 AM"
  // Sintaxis Cron:  Minuto Hora DiaMes Mes DiaSemana
  cron.schedule('0 9 6 * *', async () => {
    console.log('🔔 Ejecutando recordatorio mensual de pagos...');

    try {
      // 1. Obtener todos los alumnos activos
      const result = await pool.query("SELECT nombre, correo_electronico FROM Usuarios WHERE rol = 'Alumno'");
      const alumnos = result.rows;

      if (alumnos.length === 0) return;

      // 2. Enviar correos
      console.log(`Enviando recordatorios a ${alumnos.length} alumnos.`);
      
      const asunto = 'Recordatorio de Colegiatura - Dojo Bunkai';
      
      // Enviamos uno por uno (o podrías usar BCC para uno solo masivo)
      alumnos.forEach(alumno => {
        const mensaje = `
            <div style="font-family: Arial;">
                <h2 style="color: #f57c00;">Recordatorio de Pago</h2>
                <p>Hola ${alumno.nombre},</p>
                <p>Te recordamos que la fecha límite para el pago de tu colegiatura es el próximo <b>día 11</b>.</p>
                <p>Por favor, realiza tu pago a tiempo para evitar recargos.</p>
                <p><i>Si ya realizaste tu pago, haz caso omiso a este mensaje.</i></p>
            </div>
        `;
        sendEmail(alumno.correo_electronico, asunto, mensaje);
      });

    } catch (error) {
      console.error('Error en el Cron de pagos:', error);
    }
  });
};

module.exports = iniciarCronJobs;