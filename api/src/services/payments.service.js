const { databasePool } = require('../config/database.config');
const crypto = require('crypto');

class PaymentsService {

  // Generar transaction_id único
  generateTransactionId(contactId, amount, date) {
    const timestamp = new Date().getTime();
    const data = `${contactId}-${amount}-${date}-${timestamp}`;
    return 'txn_' + crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  // Generar payment_id único
  async generatePaymentId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomId = '';

    // Generar 16 caracteres aleatorios
    const randomBytes = crypto.randomBytes(16);
    for (let i = 0; i < 16; i++) {
      randomId += characters[randomBytes[i] % characters.length];
    }

    const paymentId = `pay_${randomId}`;

    // Verificar que no exista
    try {
      const existing = await databasePool.query(
        'SELECT id FROM payments WHERE id = $1',
        [paymentId]
      );

      if (existing.rows.length > 0) {
        // Si existe, intentar de nuevo
        return this.generatePaymentId();
      }
    } catch (error) {
      // En caso de error, continuar con el ID generado
    }

    return paymentId;
  }
  
  async getPayments(startDate, endDate, filters = {}) {
    try {
      let query = `
        SELECT 
          p.id,
          p.contact_id,
          p.amount,
          p.currency,
          p.transaction_id,
          p.payment_method,
          p.status,
          p.description,
          p.invoice_number,
          p.paid_at,
          p.created_at,
          p.updated_at,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.company
        FROM payments p
        LEFT JOIN contacts c ON p.contact_id = c.contact_id
        WHERE COALESCE(p.paid_at, p.created_at) >= $1 AND COALESCE(p.paid_at, p.created_at) <= $2
        ORDER BY COALESCE(p.paid_at, p.created_at) DESC
      `;
      
      const result = await databasePool.query(query, [startDate, endDate]);
      
      return result.rows.map(row => ({
        id: row.id,
        contactId: row.contact_id,
        contactName: row.first_name || row.last_name ? 
          `${row.first_name || ''} ${row.last_name || ''}`.trim() : 
          'Sin nombre',
        email: row.email,
        phone: row.phone,
        company: row.company,
        amount: parseFloat(row.amount),
        currency: row.currency,
        transactionId: row.transaction_id,
        paymentMethod: row.payment_method,
        status: row.status,
        description: row.description,
        invoiceNumber: row.invoice_number,
        date: row.paid_at || row.created_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        type: parseFloat(row.amount) >= 0 ? 'income' : 'expense'
      }));
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  }
  
  async createPayment(paymentData) {
    try {
      // Generar IDs únicos
      const paymentId = await this.generatePaymentId();
      const transactionId = this.generateTransactionId(
        paymentData.contactId,
        paymentData.amount,
        paymentData.date
      );

      // Preparar los valores
      const amount = Math.abs(paymentData.amount); // Siempre positivo
      const status = paymentData.status || 'completed';
      const paymentMethod = paymentData.paymentMethod || 'card';
      const currency = paymentData.currency || 'MXN';
      const description = paymentData.description || 'Pago manual';
      const paidAt = new Date(paymentData.date);
      const now = new Date();

      const insertQuery = `
        INSERT INTO payments (
          id,
          contact_id,
          amount,
          currency,
          transaction_id,
          payment_method,
          status,
          description,
          invoice_number,
          paid_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const result = await databasePool.query(insertQuery, [
        paymentId,
        paymentData.contactId,
        amount,
        currency,
        transactionId,
        paymentMethod,
        status,
        description,
        paymentData.invoiceNumber || null,
        paidAt,
        now,
        now
      ]);

      // Obtener información del contacto
      const contactQuery = `
        SELECT first_name, last_name, email, phone, company
        FROM contacts
        WHERE contact_id = $1
      `;

      const contactResult = await databasePool.query(contactQuery, [paymentData.contactId]);
      const contact = contactResult.rows[0] || {};

      const newPayment = result.rows[0];
      return {
        id: newPayment.id,
        contactId: newPayment.contact_id,
        contactName: contact.first_name || contact.last_name ?
          `${contact.first_name || ''} ${contact.last_name || ''}`.trim() :
          'Sin nombre',
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        amount: parseFloat(newPayment.amount),
        currency: newPayment.currency,
        transactionId: newPayment.transaction_id,
        paymentMethod: newPayment.payment_method,
        status: newPayment.status,
        description: newPayment.description,
        invoiceNumber: newPayment.invoice_number,
        date: newPayment.paid_at,
        createdAt: newPayment.created_at,
        updatedAt: newPayment.updated_at
      };
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  }

  async updatePayment(id, updateData) {
    try {
      const fields = [];
      const values = [];
      let fieldIndex = 1;
      
      // Build dynamic update query for payments table
      if (updateData.description !== undefined) {
        fields.push(`description = $${fieldIndex++}`);
        values.push(updateData.description);
      }
      if (updateData.amount !== undefined) {
        // Always store amount as positive
        fields.push(`amount = $${fieldIndex++}`);
        values.push(Math.abs(updateData.amount));
      }
      if (updateData.status !== undefined) {
        fields.push(`status = $${fieldIndex++}`);
        values.push(updateData.status);
      }
      
      // Update contact info separately if provided
      if (updateData.email !== undefined || updateData.contactName !== undefined) {
        const contactUpdateFields = [];
        const contactValues = [];
        let contactFieldIndex = 1;
        
        if (updateData.contactName !== undefined) {
          contactUpdateFields.push(`first_name = $${contactFieldIndex++}`);
          contactValues.push(updateData.contactName);
        }
        if (updateData.email !== undefined) {
          contactUpdateFields.push(`email = $${contactFieldIndex++}`);
          contactValues.push(updateData.email);
        }
        
        if (contactUpdateFields.length > 0) {
          contactValues.push(id);
          const contactQuery = `
            UPDATE contacts 
            SET ${contactUpdateFields.join(', ')}
            WHERE contact_id = (SELECT contact_id FROM payments WHERE id = $${contactFieldIndex})
          `;
          await databasePool.query(contactQuery, contactValues);
        }
      }
      
      if (fields.length === 0 && !updateData.email && !updateData.contactName) {
        // No updates to make
        return null;
      }
      
      // Update payment record if there are payment fields to update
      if (fields.length > 0) {
        fields.push(`updated_at = $${fieldIndex++}`);
        values.push(new Date());
        values.push(id);
        
        const query = `
          UPDATE payments
          SET ${fields.join(', ')}
          WHERE id = $${fieldIndex}
          RETURNING *
        `;
        
        const result = await databasePool.query(query, values);
        return result.rows[0];
      }
      
      // If only contact info was updated, return the payment record
      const selectQuery = 'SELECT * FROM payments WHERE id = $1';
      const result = await databasePool.query(selectQuery, [id]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error;
    }
  }
  
  async deletePayment(id) {
    try {
      const query = `
        DELETE FROM payments
        WHERE id = $1
        RETURNING id
      `;
      
      const result = await databasePool.query(query, [id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting payment:', error);
      throw error;
    }
  }
  
  async getPaymentMetrics(startDate, endDate) {
    try {
      // Completed payments
      const completedQuery = `
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) <= $2 
        AND status = 'completed'
      `;
      
      // Refunded payments
      const refundedQuery = `
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) <= $2 
        AND status = 'refunded'
      `;
      
      // Pending payments
      const pendingQuery = `
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE created_at >= $1 AND created_at <= $2 
        AND status = 'pending'
      `;
      
      // Income vs Expenses
      const incomeExpenseQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses,
          COUNT(CASE WHEN amount > 0 THEN 1 END) as income_count,
          COUNT(CASE WHEN amount < 0 THEN 1 END) as expense_count
        FROM payments
        WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) <= $2 
        AND status = 'completed'
      `;
      
      const [completed, refunded, pending, incomeExpense] = await Promise.all([
        databasePool.query(completedQuery, [startDate, endDate]),
        databasePool.query(refundedQuery, [startDate, endDate]),
        databasePool.query(pendingQuery, [startDate, endDate]),
        databasePool.query(incomeExpenseQuery, [startDate, endDate])
      ]);
      
      const completedCount = parseInt(completed.rows[0].count) || 0;
      const completedTotal = parseFloat(completed.rows[0].total) || 0;
      const refundedCount = parseInt(refunded.rows[0].count) || 0;
      const refundedTotal = parseFloat(refunded.rows[0].total) || 0;
      const pendingCount = parseInt(pending.rows[0].count) || 0;
      const pendingTotal = parseFloat(pending.rows[0].total) || 0;
      const income = parseFloat(incomeExpense.rows[0].income) || 0;
      const expenses = parseFloat(incomeExpense.rows[0].expenses) || 0;
      const incomeCount = parseInt(incomeExpense.rows[0].income_count) || 0;
      
      return {
        completed: {
          count: completedCount,
          total: completedTotal
        },
        refunded: {
          count: refundedCount,
          total: refundedTotal
        },
        pending: {
          count: pendingCount,
          total: pendingTotal
        },
        netRevenue: income - refundedTotal,
        totalRevenue: income,
        totalExpenses: expenses,
        avgPayment: incomeCount > 0 ? income / incomeCount : 0,
        successRate: (completedCount + refundedCount + pendingCount) > 0 ? 
          (completedCount / (completedCount + refundedCount + pendingCount)) * 100 : 0
      };
    } catch (error) {
      console.error('Error fetching payment metrics:', error);
      throw error;
    }
  }
}

module.exports = new PaymentsService();