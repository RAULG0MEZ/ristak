#!/usr/bin/env node

/**
 * Script para agregar usuario de prueba: test@ristak.com
 * Contraseña: FacebookDev123
 *
 * USO: node api/scripts/add-test-user.js
 */

const bcrypt = require('bcryptjs');
const { databasePool } = require('../src/config/database.config');

async function addTestUser() {
  try {
    const email = 'test@ristak.com';
    const password = 'FacebookDev123';
    const name = 'Usuario de Prueba';

    console.log('🔒 Hasheando contraseña...');
    // Hashear la contraseña con bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    console.log('📧 Verificando si el usuario ya existe...');
    // Verificar si el usuario ya existe
    const checkQuery = 'SELECT id FROM users WHERE email = $1';
    const checkResult = await databasePool.query(checkQuery, [email]);

    if (checkResult.rows.length > 0) {
      console.log('⚠️  El usuario test@ristak.com ya existe');

      // Actualizar la contraseña del usuario existente
      const updateQuery = `
        UPDATE users
        SET password_hash = $1,
            name = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = $3
      `;

      await databasePool.query(updateQuery, [passwordHash, name, email]);
      console.log('✅ Contraseña actualizada para el usuario existente');
    } else {
      console.log('➕ Creando nuevo usuario de prueba...');

      // Primero verificar si la tabla users existe
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'users'
        );
      `;

      const tableExists = await databasePool.query(tableCheckQuery);

      if (!tableExists.rows[0].exists) {
        // Crear la tabla users si no existe
        console.log('📦 Creando tabla users...');
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255),
            password_hash VARCHAR(255),
            role VARCHAR(50) DEFAULT 'user',
            last_login_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `;

        await databasePool.query(createTableQuery);
        console.log('✅ Tabla users creada');
      }

      // Insertar el nuevo usuario
      const insertQuery = `
        INSERT INTO users (email, name, password_hash, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      await databasePool.query(insertQuery, [
        email,
        name,
        passwordHash,
        'admin' // Le damos rol admin al usuario de prueba
      ]);

      console.log('✅ Usuario de prueba creado exitosamente');
    }

    console.log('\n📋 Datos del usuario de prueba:');
    console.log('   Email: test@ristak.com');
    console.log('   Contraseña: FacebookDev123');
    console.log('   Rol: admin');
    console.log('\n🚀 Ya puedes hacer login con estas credenciales');

  } catch (error) {
    console.error('❌ Error al agregar usuario de prueba:', error);
    process.exit(1);
  } finally {
    // Cerrar la conexión a la base de datos
    await databasePool.end();
    process.exit(0);
  }
}

// Ejecutar el script
addTestUser();