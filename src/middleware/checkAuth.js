const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Acceso denegado: No hay token.' });
    }

    // Verificar el token con nuestra clave secreta
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    
    req.userData = { 
      id: decodedToken.id, 
      rol: decodedToken.rol,
      email: decodedToken.email
    };
    
    // Permitir que la petición continúe
    next();

  } catch (error) {
    return res.status(401).json({ 
      error: 'Acceso denegado: Token inválido o expirado.' 
    });
  }
};
