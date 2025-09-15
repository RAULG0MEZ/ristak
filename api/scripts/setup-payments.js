const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_liGBDM5cUd2X@ep-curly-bird-adn7jer3-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function setupPaymentsTable() {
  try {
    // Verificar si la tabla existe
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'payments'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.log('Creando tabla payments...');
      
      // Crear tabla payments
      await pool.query(`
        CREATE TABLE payments (
          id SERIAL PRIMARY KEY,
          contact_id INTEGER REFERENCES contacts(contact_id),
          amount DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'MXN',
          transaction_id VARCHAR(255) UNIQUE NOT NULL,
          payment_method VARCHAR(50),
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
          description TEXT,
          invoice_number VARCHAR(100),
          paid_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Crear índices
      await pool.query(`
        CREATE INDEX idx_payments_contact_id ON payments(contact_id);
        CREATE INDEX idx_payments_paid_at ON payments(paid_at);
        CREATE INDEX idx_payments_status ON payments(status);
        CREATE INDEX idx_payments_created_at ON payments(created_at);
      `);

      console.log('Tabla payments creada exitosamente');
    } else {
      console.log('La tabla payments ya existe');
    }

    // Insertar datos de prueba
    console.log('Insertando datos de prueba...');

    // Primero verificar si hay contactos
    const contactsCheck = await pool.query('SELECT contact_id FROM contacts LIMIT 5');
    const hasContacts = contactsCheck.rows.length > 0;
    
    const samplePayments = [
      {
        contact_id: hasContacts ? contactsCheck.rows[0]?.contact_id : null,
        amount: 2500.00,
        transaction_id: 'TRX-' + Date.now() + '-001',
        payment_method: 'stripe',
        status: 'completed',
        description: 'Pago de suscripción mensual',
        invoice_number: 'INV-2025-001',
        paid_at: new Date('2025-01-10')
      },
      {
        contact_id: hasContacts ? contactsCheck.rows[1]?.contact_id : null,
        amount: 5000.00,
        transaction_id: 'TRX-' + Date.now() + '-002',
        payment_method: 'paypal',
        status: 'completed',
        description: 'Pago de servicio premium',
        invoice_number: 'INV-2025-002',
        paid_at: new Date('2025-01-11')
      },
      {
        contact_id: hasContacts ? contactsCheck.rows[2]?.contact_id : null,
        amount: 1500.00,
        transaction_id: 'TRX-' + Date.now() + '-003',
        payment_method: 'stripe',
        status: 'completed',
        description: 'Renovación automática',
        invoice_number: 'INV-2025-003',
        paid_at: new Date('2025-01-12')
      },
      {
        contact_id: hasContacts ? contactsCheck.rows[0]?.contact_id : null,
        amount: -500.00,
        transaction_id: 'TRX-' + Date.now() + '-004',
        payment_method: 'stripe',
        status: 'refunded',
        description: 'Reembolso por cancelación',
        invoice_number: 'REF-2025-001',
        paid_at: new Date('2025-01-12')
      },
      {
        contact_id: hasContacts ? contactsCheck.rows[3]?.contact_id : null,
        amount: 3200.00,
        transaction_id: 'TRX-' + Date.now() + '-005',
        payment_method: 'transfer',
        status: 'pending',
        description: 'Pago pendiente de verificación',
        invoice_number: 'INV-2025-004',
        paid_at: null
      },
      {
        contact_id: hasContacts ? contactsCheck.rows[1]?.contact_id : null,
        amount: 7500.00,
        transaction_id: 'TRX-' + Date.now() + '-006',
        payment_method: 'stripe',
        status: 'completed',
        description: 'Pago anual con descuento',
        invoice_number: 'INV-2025-005',
        paid_at: new Date('2025-01-08')
      },
      {
        contact_id: hasContacts ? contactsCheck.rows[2]?.contact_id : null,
        amount: 1000.00,
        transaction_id: 'TRX-' + Date.now() + '-007',
        payment_method: 'paypal',
        status: 'completed',
        description: 'Servicio adicional',
        invoice_number: 'INV-2025-006',
        paid_at: new Date('2025-01-09')
      }
    ];

    for (const payment of samplePayments) {
      try {
        await pool.query(`
          INSERT INTO payments (
            contact_id, amount, currency, transaction_id, 
            payment_method, status, description, invoice_number, paid_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (transaction_id) DO NOTHING
        `, [
          payment.contact_id,
          payment.amount,
          'MXN',
          payment.transaction_id,
          payment.payment_method,
          payment.status,
          payment.description,
          payment.invoice_number,
          payment.paid_at
        ]);
      } catch (err) {
        console.log('Error insertando pago:', err.message);
      }
    }

    // Verificar cuántos pagos hay ahora
    const countResult = await pool.query('SELECT COUNT(*) FROM payments');
    console.log(`Total de pagos en la base de datos: ${countResult.rows[0].count}`);

    console.log('✅ Configuración de pagos completada');
    
  } catch (error) {
    console.error('Error configurando tabla de pagos:', error);
  } finally {
    await pool.end();
  }
}

setupPaymentsTable();