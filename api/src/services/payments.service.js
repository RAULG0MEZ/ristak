const { databasePool } = require('../config/database.config');
const crypto = require('crypto');
const { adjustDateRange } = require('../utils/date-helper');

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
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
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
  
  async updatePayment(id, updateData) {
    try {
      const client = await databasePool.connect();

      try {
        await client.query('BEGIN');

        // 1. Actualizar campos del pago
        const paymentFields = [];
        const paymentValues = [];
        let fieldIndex = 1;

        if (updateData.description !== undefined) {
          paymentFields.push(`description = $${fieldIndex++}`);
          paymentValues.push(updateData.description);
        }
        if (updateData.amount !== undefined) {
          paymentFields.push(`amount = $${fieldIndex++}`);
          paymentValues.push(Math.abs(updateData.amount));
        }
        if (updateData.status !== undefined) {
          paymentFields.push(`status = $${fieldIndex++}`);
          paymentValues.push(updateData.status);
        }

        let updatedPayment = null;

        if (paymentFields.length > 0) {
          paymentFields.push(`updated_at = $${fieldIndex++}`);
          // Usar ISO string para garantizar UTC
          paymentValues.push(new Date().toISOString());
          paymentValues.push(id);

          const paymentQuery = `
            UPDATE payments
            SET ${paymentFields.join(', ')}
            WHERE id = $${fieldIndex}
            RETURNING *
          `;
          const paymentResult = await client.query(paymentQuery, paymentValues);
          if (paymentResult.rows.length === 0) {
            throw new Error('Payment not found');
          }
          updatedPayment = paymentResult.rows[0];
        }

        // 2. Si hay campos de contacto, actualizar tabla contacts
        if (updateData.contactName || updateData.email) {
          // Obtener el contact_id del pago
          const getContactIdQuery = `
            SELECT contact_id FROM payments WHERE id = $1
          `;
          const contactIdResult = await client.query(getContactIdQuery, [id]);

          if (contactIdResult.rows.length > 0) {
            const contactId = contactIdResult.rows[0].contact_id;

            const contactFields = [];
            const contactValues = [];
            let contactFieldIndex = 1;

            if (updateData.contactName !== undefined) {
              contactFields.push(`first_name = $${contactFieldIndex++}`);
              contactValues.push(updateData.contactName);
            }
            if (updateData.email !== undefined) {
              contactFields.push(`email = $${contactFieldIndex++}`);
              contactValues.push(updateData.email);
            }

            if (contactFields.length > 0) {
              contactFields.push(`updated_at = $${contactFieldIndex++}`);
              // Usar ISO string para garantizar UTC
              contactValues.push(new Date().toISOString());
              contactValues.push(contactId);

              const contactQuery = `
                UPDATE contacts
                SET ${contactFields.join(', ')}
                WHERE contact_id = $${contactFieldIndex}
              `;
              await client.query(contactQuery, contactValues);
            }
          }
        }

        // 3. Obtener el pago actualizado con información del contacto
        const finalQuery = `
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
          WHERE p.id = $1
        `;

        const finalResult = await client.query(finalQuery, [id]);

        if (finalResult.rows.length === 0) {
          throw new Error('Payment not found');
        }

        await client.query('COMMIT');

        const row = finalResult.rows[0];
        return {
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
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error updating payment:', error);
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
      // Convertir fecha a UTC - el frontend debe enviar en ISO string UTC
      const paidAt = paymentData.date ? new Date(paymentData.date).toISOString() : new Date().toISOString();
      // Usar ISO string para garantizar UTC
      const now = new Date().toISOString();

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
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;

      // Calcular período anterior para trends
      const periodLength = (endDate - startDate) / (1000 * 60 * 60 * 24);
      const previousEndDate = new Date(startDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodLength);

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

      // Ejecutar queries para período actual
      const [completed, refunded, pending, incomeExpense] = await Promise.all([
        databasePool.query(completedQuery, [startDate, endDate]),
        databasePool.query(refundedQuery, [startDate, endDate]),
        databasePool.query(pendingQuery, [startDate, endDate]),
        databasePool.query(incomeExpenseQuery, [startDate, endDate])
      ]);

      // Ejecutar queries para período anterior
      const [prevCompleted, prevRefunded, prevIncomeExpense] = await Promise.all([
        databasePool.query(completedQuery, [previousStartDate, previousEndDate]),
        databasePool.query(refundedQuery, [previousStartDate, previousEndDate]),
        databasePool.query(incomeExpenseQuery, [previousStartDate, previousEndDate])
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
      const netRevenue = income - refundedTotal;
      const avgPayment = incomeCount > 0 ? income / incomeCount : 0;

      const prevCompletedCount = parseInt(prevCompleted.rows[0].count) || 0;
      const prevIncome = parseFloat(prevIncomeExpense.rows[0].income) || 0;
      const prevRefundedTotal = parseFloat(prevRefunded.rows[0].total) || 0;
      const prevIncomeCount = parseInt(prevIncomeExpense.rows[0].income_count) || 0;
      const prevNetRevenue = prevIncome - prevRefundedTotal;
      const prevAvgPayment = prevIncomeCount > 0 ? prevIncome / prevIncomeCount : 0;

      // Función para calcular trends
      const calculateTrend = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / Math.abs(previous)) * 100;
      };

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
        netRevenue: netRevenue,
        totalRevenue: income,
        totalExpenses: expenses,
        avgPayment: avgPayment,
        successRate: (completedCount + refundedCount + pendingCount) > 0 ?
          (completedCount / (completedCount + refundedCount + pendingCount)) * 100 : 0,
        trends: {
          netRevenue: calculateTrend(netRevenue, prevNetRevenue),
          avgPayment: calculateTrend(avgPayment, prevAvgPayment),
          completedCount: calculateTrend(completedCount, prevCompletedCount),
          refunds: calculateTrend(refundedTotal, prevRefundedTotal)
        }
      };
    } catch (error) {
      console.error('Error fetching payment metrics:', error);
      throw error;
    }
  }
  // Nuevo método para obtener pagos con paginación (sin filtro de fecha)
  async getPaymentsPaginated(offset, limit) {
    try {
      const countQuery = `SELECT COUNT(*) as total FROM payments`;

      const dataQuery = `
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
          COALESCE(p.paid_at, p.created_at) as date,
          p.created_at,
          p.updated_at,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.company
        FROM payments p
        LEFT JOIN contacts c ON p.contact_id = c.contact_id
        ORDER BY COALESCE(p.paid_at, p.created_at) DESC
        LIMIT $1 OFFSET $2
      `;

      const [countResult, dataResult] = await Promise.all([
        databasePool.query(countQuery),
        databasePool.query(dataQuery, [limit, offset])
      ]);

      const payments = dataResult.rows.map(row => ({
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
        paymentMethod: row.payment_method || 'unknown',
        status: row.status,
        description: row.description,
        invoiceNumber: row.invoice_number,
        date: row.date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return {
        payments,
        total: parseInt(countResult.rows[0].total) || 0
      };
    } catch (error) {
      console.error('Error fetching paginated payments:', error);
      throw error;
    }
  }

  // Nuevo método para obtener pagos con paginación Y filtro de fecha
  async getPaymentsWithPagination(startDate, endDate, offset, limit) {
    try {
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
      const countQuery = `
        SELECT COUNT(*) as total
        FROM payments
        WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) <= $2
      `;

      const dataQuery = `
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
          COALESCE(p.paid_at, p.created_at) as date,
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
        LIMIT $3 OFFSET $4
      `;

      const [countResult, dataResult] = await Promise.all([
        databasePool.query(countQuery, [startDate, endDate]),
        databasePool.query(dataQuery, [startDate, endDate, limit, offset])
      ]);

      const payments = dataResult.rows.map(row => ({
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
        paymentMethod: row.payment_method || 'unknown',
        status: row.status,
        description: row.description,
        invoiceNumber: row.invoice_number,
        date: row.date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return {
        payments,
        total: parseInt(countResult.rows[0].total) || 0
      };
    } catch (error) {
      console.error('Error fetching payments with pagination:', error);
      throw error;
    }
  }

  // Método agnóstico para obtener pagos por contact_id
  async getPaymentsByContactId(contactId) {
    try {
      const query = `
        SELECT
          p.id,
          p.transaction_id,
          p.contact_id,
          p.amount,
          p.currency,
          p.payment_method,
          p.status,
          p.description,
          p.invoice_number,
          COALESCE(p.paid_at, p.created_at) as date,
          p.created_at,
          p.updated_at
        FROM payments p
        WHERE p.contact_id = $1
        ORDER BY COALESCE(p.paid_at, p.created_at) DESC
      `;

      const result = await databasePool.query(query, [contactId]);

      // Mapear resultados al formato esperado por el frontend
      const payments = result.rows.map(row => ({
        id: row.id,
        transactionId: row.transaction_id,
        contactId: row.contact_id,
        amount: row.amount,
        currency: row.currency,
        paymentMethod: row.payment_method,
        status: row.status,
        description: row.description,
        invoiceNumber: row.invoice_number,
        date: row.date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return payments;
    } catch (error) {
      console.error('Error fetching payments by contact ID:', error);
      throw error;
    }
  }
}

module.exports = new PaymentsService();
