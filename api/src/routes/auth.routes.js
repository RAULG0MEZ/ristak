const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { databasePool } = require('../config/database.config');
const jwt = require('jsonwebtoken');

// Configuración de autenticación

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  (process.env.NODE_ENV !== 'production' ? 'dev-secret' : undefined);

function getAuthSecret() {
  if (!AUTH_SECRET) {
    throw new Error('AUTH_SECRET no está configurado. Define AUTH_SECRET en las variables de entorno.');
  }
  return AUTH_SECRET;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son requeridos'
      });
    }

    // Buscar el usuario por email
    const userQuery = `
      SELECT id, email, name, password_hash, role
      FROM users
      WHERE email = $1
      LIMIT 1
    `;

    const userResult = await databasePool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    const user = userResult.rows[0];

    // Verificar contraseña con bcrypt
    let isValidPassword = false;

    if (user.password_hash) {
      // Verificar contraseña con bcrypt
      isValidPassword = await bcrypt.compare(password, user.password_hash);
    } else if (process.env.NODE_ENV === 'development') {
      // Solo en desarrollo, si no hay password_hash, aceptar 'admin123' como temporal
      isValidPassword = password === 'admin123';
      console.warn('⚠️  Usuario sin contraseña configurada. Use script setup-password.js');
    }

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    // Actualizar last_login_at
    await databasePool.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    ).catch(err => {
      console.error('Error actualizando last_login_at:', err);
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      getAuthSecret(),
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      userId: user.id,
      name: user.name || email.split('@')[0],
      accountName: user.name || email.split('@')[0], // Agregar accountName para compatibilidad con el frontend
      email,
      role: user.role
    });
  } catch (error) {
    console.error('Login error:', error);
    const message = error instanceof Error && error.message.includes('AUTH_SECRET')
      ? 'Configuración del servidor incompleta: define AUTH_SECRET'
      : 'Error al iniciar sesión';
    res.status(500).json({
      error: message
    });
  }
});

// GET /api/auth/verify
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token no proporcionado'
      });
    }

    const token = authHeader.substring(7);
    try {
      const payload = jwt.verify(token, getAuthSecret());

      // Buscar el nombre actual del usuario en la DB
      const userQuery = 'SELECT name, email FROM users WHERE id = $1 LIMIT 1';
      const userResult = await databasePool.query(userQuery, [payload.userId]);

      let accountName = payload.email.split('@')[0]; // Default
      if (userResult.rows.length > 0 && userResult.rows[0].name) {
        accountName = userResult.rows[0].name;
      }

      res.json({
        success: true,
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        accountName: accountName // Agregar nombre del usuario
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' });
      }
      return res.status(401).json({ error: 'Token inválido' });
    }
  } catch (error) {
    console.error('Verify error:', error);
    const message = error instanceof Error && error.message.includes('AUTH_SECRET')
      ? 'Configuración del servidor incompleta: define AUTH_SECRET'
      : 'Error al verificar token';
    res.status(500).json({
      error: message
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Error al cerrar sesión'
    });
  }
});

module.exports = router;
