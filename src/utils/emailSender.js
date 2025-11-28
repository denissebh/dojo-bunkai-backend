const nodemailer = require('nodemailer');

// Configuración del transporte (reutilizable)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Función genérica para enviar correos
 */
const sendEmail = async (destinatario, asunto, contenidoHTML) => {
  try {
    const info = await transporter.sendMail({
      from: `"Dojo Bunkai Sistema" <${process.env.EMAIL_USER}>`,
      to: destinatario,
      subject: asunto,
      html: contenidoHTML,
    });
    console.log(`📧 Correo enviado a: ${destinatario} | ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    return false;
  }
};

module.exports = { sendEmail };