const { databasePool } = require('../config/database.config');

class ReportsService {
  async getMetrics(startDate, endDate, groupBy = 'month') {
    // PESTAÑA "TODOS": Datos reales de actividad en el período seleccionado
    // Sin filtros de atribución - incluye TODOS los contactos
    const unit = ['day', 'month', 'year'].includes(groupBy) ? groupBy : 'month'
    try {
      // Parallel queries by source
      const [ads, sessions, contacts, appointments, payments, newCustomers] = await Promise.all([
        databasePool.query(
          `SELECT DATE_TRUNC($3, date) AS period,
                  COALESCE(SUM(spend),0)   AS spend,
                  COALESCE(SUM(reach),0)   AS reach,
                  COALESCE(SUM(clicks),0)  AS clicks
           FROM meta.meta_ads
           WHERE date >= $1 AND date <= $2
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        databasePool.query(
          `SELECT DATE_TRUNC($3, ts) AS period,
                  COUNT(DISTINCT visitor_id) AS visitors
           FROM tracking_sessions
           WHERE ts >= $1 AND ts <= $2
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        // TODOS los contactos creados en el período (sin importar attribution_ad_id)
        databasePool.query(
          `SELECT DATE_TRUNC($3, created_at) AS period,
                  COUNT(*) AS leads
           FROM contacts
           WHERE created_at >= $1 AND created_at <= $2
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        // TODAS las citas creadas en el período
        databasePool.query(
          `SELECT DATE_TRUNC($3, created_at) AS period,
                  COUNT(*) AS appointments
           FROM appointments
           WHERE created_at >= $1 AND created_at <= $2
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        // TODOS los pagos realizados en el período (usando fecha de pago real)
        databasePool.query(
          `SELECT DATE_TRUNC($3, COALESCE(paid_at, created_at)) AS period,
                  COUNT(*) FILTER (WHERE status = 'completed') AS sales,
                  COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END),0) AS revenue
           FROM payments
           WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) <= $2
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        // Clientes nuevos: contactos con su PRIMER pago en el período
        databasePool.query(
          `WITH first_payments AS (
            SELECT contact_id,
                   MIN(COALESCE(paid_at, created_at)) as first_payment_date
            FROM payments
            WHERE status = 'completed'
            GROUP BY contact_id
          )
          SELECT DATE_TRUNC($3, first_payment_date) AS period,
                 COUNT(*) AS new_customers
          FROM first_payments
          WHERE first_payment_date >= $1 AND first_payment_date <= $2
          GROUP BY period
          ORDER BY period`,
          [startDate, endDate, unit]
        )
      ])

      // Helper to format key per unit
      const formatKey = (d) => {
        const date = new Date(d)
        if (unit === 'day') return date.toISOString().slice(0, 10)
        if (unit === 'month') return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2,'0')}`
        return String(date.getUTCFullYear())
      }

      // Build all periods between start and end for dense series
      const periods = new Set()
      const cursor = new Date(startDate)
      while (cursor <= endDate) {
        periods.add(formatKey(cursor))
        if (unit === 'day') {
          cursor.setDate(cursor.getDate() + 1)
        } else if (unit === 'month') {
          cursor.setMonth(cursor.getMonth() + 1)
          cursor.setDate(1)
        } else {
          cursor.setFullYear(cursor.getFullYear() + 1)
          cursor.setMonth(0, 1)
        }
      }

      const map = new Map()
      const ensure = (key) => {
        if (!map.has(key)) {
          map.set(key, {
            date: key,
            spend: 0,
            reach: 0,
            clicks: 0,
            cpc: null,
            visitors: 0,
            cpv: null,
            visitorToLeadRate: null,
            leads: 0,
            cpl: null,
            appointmentsPerLead: null,
            appointments: 0,
            costPerAppointment: null,
            salesPerAppointment: null,
            sales: 0,
            new_customers: 0,
            cac: null,
            revenue: 0,
          })
        }
        return map.get(key)
      }

      const applyRows = (rows, assign) => {
        for (const row of rows) {
          const key = formatKey(row.period)
          const obj = ensure(key)
          assign(obj, row)
        }
      }

      applyRows(ads.rows, (o, r) => {
        o.spend = parseFloat(r.spend) || 0
        o.reach = parseInt(r.reach) || 0
        o.clicks = parseInt(r.clicks) || 0
      })
      applyRows(sessions.rows, (o, r) => { o.visitors = parseInt(r.visitors) || 0 })
      applyRows(contacts.rows, (o, r) => { o.leads = parseInt(r.leads) || 0 })
      applyRows(appointments.rows, (o, r) => { o.appointments = parseInt(r.appointments) || 0 })
      applyRows(payments.rows, (o, r) => {
        o.sales = parseInt(r.sales) || 0
        o.revenue = parseFloat(r.revenue) || 0
      })
      applyRows(newCustomers.rows, (o, r) => {
        o.new_customers = parseInt(r.new_customers) || 0
      })

      // Compute derived metrics
      for (const [key, o] of map) {
        o.cpc = o.clicks > 0 ? o.spend / o.clicks : null
        o.cpv = o.visitors > 0 ? o.spend / o.visitors : null
        o.visitorToLeadRate = o.visitors > 0 ? (o.leads / o.visitors) * 100 : null
        o.cpl = o.leads > 0 ? o.spend / o.leads : null
        o.appointmentsPerLead = o.leads > 0 ? (o.appointments / o.leads) * 100 : null
        o.costPerAppointment = o.appointments > 0 ? o.spend / o.appointments : null
        o.salesPerAppointment = o.appointments > 0 ? (o.sales / o.appointments) * 100 : null
        o.cac = o.sales > 0 ? o.spend / o.sales : null
      }

      // Ensure dense list ordered chronologically
      const ordered = Array.from(periods).sort().map(k => ensure(k))
      return ordered
    } catch (error) {
      console.error('Error building report metrics:', error)
      throw error
    }
  }

  async getAttributedMetrics(startDate, endDate, groupBy = 'month') {
    // PESTAÑA "ATRIBUIDOS": Solo contactos con attribution_ad_id
    // Usa Last Attribution - TODO se basa en la fecha de creación del contacto
    const unit = ['day', 'month', 'year'].includes(groupBy) ? groupBy : 'month'
    try {
      const [ads, sessions, contacts, appointments, payments, newCustomers] = await Promise.all([
        // Gastos de Meta Ads
        databasePool.query(
          `SELECT DATE_TRUNC($3, date) AS period,
                  COALESCE(SUM(spend),0) AS spend,
                  COALESCE(SUM(reach),0) AS reach,
                  COALESCE(SUM(clicks),0) AS clicks
           FROM meta.meta_ads
           WHERE date >= $1 AND date <= $2
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        // Visitantes totales (sin filtro de atribución)
        databasePool.query(
          `SELECT DATE_TRUNC($3, ts) AS period,
                  COUNT(DISTINCT visitor_id) AS visitors
           FROM tracking_sessions
           WHERE ts >= $1 AND ts <= $2
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        // Solo contactos con attribution_ad_id Y que coincidan con anuncio activo
        databasePool.query(
          `SELECT DATE_TRUNC($3, c.created_at) AS period,
                  COUNT(*) AS leads
           FROM contacts c
           WHERE c.created_at >= $1 AND c.created_at <= $2
             AND c.attribution_ad_id IS NOT NULL
             -- Validar con ventana de atribución de 3 días
             AND EXISTS (
               SELECT 1 FROM meta.meta_ads ma
               WHERE ma.ad_id = c.attribution_ad_id
                 AND (
                   ma.date::date = c.created_at::date
                   OR (
                     ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                     AND ma.date::date <= c.created_at::date
                   )
                 )
             )
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        // Citas: usar fecha de creación del CONTACTO para Last Attribution
        databasePool.query(
          `SELECT DATE_TRUNC($3, c.created_at) AS period,
                  COUNT(DISTINCT a.contact_id) AS appointments
           FROM contacts c
           JOIN appointments a ON a.contact_id = c.contact_id
           WHERE c.created_at >= $1 AND c.created_at <= $2
             AND c.attribution_ad_id IS NOT NULL
             -- Validar con ventana de atribución de 3 días
             AND EXISTS (
               SELECT 1 FROM meta.meta_ads ma
               WHERE ma.ad_id = c.attribution_ad_id
                 AND (
                   ma.date::date = c.created_at::date
                   OR (
                     ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                     AND ma.date::date <= c.created_at::date
                   )
                 )
             )
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        // Ventas: usar fecha de creación del CONTACTO para Last Attribution
        databasePool.query(
          `SELECT DATE_TRUNC($3, c.created_at) AS period,
                  COUNT(DISTINCT c.contact_id) FILTER (
                    WHERE EXISTS (
                      SELECT 1 FROM payments p 
                      WHERE p.contact_id = c.contact_id 
                        AND p.status = 'completed'
                    )
                  ) AS sales,
                  COALESCE(SUM((
                    SELECT SUM(amount) 
                    FROM payments p 
                    WHERE p.contact_id = c.contact_id 
                      AND p.status = 'completed'
                  )), 0) AS revenue
           FROM contacts c
           WHERE c.created_at >= $1 AND c.created_at <= $2
             AND c.attribution_ad_id IS NOT NULL
             -- Validar con ventana de atribución de 3 días
             AND EXISTS (
               SELECT 1 FROM meta.meta_ads ma
               WHERE ma.ad_id = c.attribution_ad_id
                 AND (
                   ma.date::date = c.created_at::date
                   OR (
                     ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                     AND ma.date::date <= c.created_at::date
                   )
                 )
             )
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        // Clientes nuevos: contactos con attribution_ad_id creados en el período QUE TIENEN PAGOS
        databasePool.query(
          `SELECT DATE_TRUNC($3, c.created_at) AS period,
                  COUNT(DISTINCT c.contact_id) AS new_customers
           FROM contacts c
           WHERE c.created_at >= $1 AND c.created_at <= $2
             AND c.attribution_ad_id IS NOT NULL
             -- Solo contar los que tienen pagos completados (son clientes reales)
             AND EXISTS (
               SELECT 1 FROM payments p 
               WHERE p.contact_id = c.contact_id 
               AND p.status = 'completed'
             )
             -- Validar con ventana de atribución de 3 días
             AND EXISTS (
               SELECT 1 FROM meta.meta_ads ma
               WHERE ma.ad_id = c.attribution_ad_id
                 AND (
                   ma.date::date = c.created_at::date
                   OR (
                     ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                     AND ma.date::date <= c.created_at::date
                   )
                 )
             )
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        )
      ])

      // Helper to format key per unit
      const formatKey = (d) => {
        const date = new Date(d)
        if (unit === 'day') return date.toISOString().slice(0, 10)
        if (unit === 'month') return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2,'0')}`
        return String(date.getUTCFullYear())
      }

      // Build all periods between start and end for dense series
      const periods = new Set()
      const cursor = new Date(startDate)
      while (cursor <= endDate) {
        periods.add(formatKey(cursor))
        if (unit === 'day') {
          cursor.setDate(cursor.getDate() + 1)
        } else if (unit === 'month') {
          cursor.setMonth(cursor.getMonth() + 1)
          cursor.setDate(1)
        } else {
          cursor.setFullYear(cursor.getFullYear() + 1)
          cursor.setMonth(0, 1)
        }
      }

      const map = new Map()
      const ensure = (key) => {
        if (!map.has(key)) {
          map.set(key, {
            date: key,
            spend: 0,
            reach: 0,
            clicks: 0,
            cpc: null,
            visitors: 0,
            cpv: null,
            visitorToLeadRate: null,
            leads: 0,
            cpl: null,
            appointmentsPerLead: null,
            appointments: 0,
            costPerAppointment: null,
            salesPerAppointment: null,
            sales: 0,
            new_customers: 0,
            cac: null,
            revenue: 0,
          })
        }
        return map.get(key)
      }

      const applyRows = (rows, assign) => {
        for (const row of rows) {
          const key = formatKey(row.period)
          const obj = ensure(key)
          assign(obj, row)
        }
      }

      applyRows(ads.rows, (o, r) => {
        o.spend = parseFloat(r.spend) || 0
        o.reach = parseInt(r.reach) || 0
        o.clicks = parseInt(r.clicks) || 0
      })
      applyRows(sessions.rows, (o, r) => { o.visitors = parseInt(r.visitors) || 0 })
      applyRows(contacts.rows, (o, r) => { o.leads = parseInt(r.leads) || 0 })
      applyRows(appointments.rows, (o, r) => { o.appointments = parseInt(r.appointments) || 0 })
      applyRows(payments.rows, (o, r) => {
        o.sales = parseInt(r.sales) || 0
        o.revenue = parseFloat(r.revenue) || 0
      })
      applyRows(newCustomers.rows, (o, r) => {
        o.new_customers = parseInt(r.new_customers) || 0
      })

      // Compute derived metrics
      for (const [key, o] of map) {
        o.cpc = o.clicks > 0 ? o.spend / o.clicks : null
        o.cpv = o.visitors > 0 ? o.spend / o.visitors : null
        o.visitorToLeadRate = o.visitors > 0 ? (o.leads / o.visitors) * 100 : null
        o.cpl = o.leads > 0 ? o.spend / o.leads : null
        o.appointmentsPerLead = o.leads > 0 ? (o.appointments / o.leads) * 100 : null
        o.costPerAppointment = o.appointments > 0 ? o.spend / o.appointments : null
        o.salesPerAppointment = o.appointments > 0 ? (o.sales / o.appointments) * 100 : null
        o.cac = o.sales > 0 ? o.spend / o.sales : null
      }

      // Ensure dense list ordered chronologically
      const ordered = Array.from(periods).sort().map(k => ensure(k))
      return ordered
    } catch (error) {
      console.error('Error building attributed report metrics:', error)
      throw error
    }
  }

  // MÉTODOS PARA DETALLES DE REPORTES
  
  // Obtener ventas detalladas (TODOS) - Agrupado por cliente con total acumulado
  async getSalesDetails(startDate, endDate) {
    try {
      const result = await databasePool.query(`
        WITH client_sales AS (
          SELECT 
            c.contact_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.attribution_ad_id,
            c.created_at as contact_created_at,
            MIN(COALESCE(p.paid_at, p.created_at)) as first_payment_date,
            MAX(COALESCE(p.paid_at, p.created_at)) as last_payment_date,
            SUM(p.amount) as total_amount,
            COUNT(p.id) as payment_count,
            -- Array de todos los pagos para detalle
            ARRAY_AGG(
              json_build_object(
                'amount', p.amount,
                'date', COALESCE(p.paid_at, p.created_at)
              ) ORDER BY COALESCE(p.paid_at, p.created_at) DESC
            ) as payment_details
          FROM contacts c
          INNER JOIN payments p ON c.contact_id = p.contact_id
          WHERE p.status = 'completed'
            AND COALESCE(p.paid_at, p.created_at) >= $1 
            AND COALESCE(p.paid_at, p.created_at) <= $2
          GROUP BY c.contact_id, c.first_name, c.last_name, c.email, c.phone, c.attribution_ad_id, c.created_at
        )
        SELECT * FROM client_sales
        ORDER BY first_payment_date DESC
      `, [startDate, endDate])
      
      return result.rows.map(row => ({
        id: row.contact_id, // Usar contact_id como ID único
        contact_id: row.contact_id,
        amount: parseFloat(row.total_amount), // Total acumulado
        payment_count: row.payment_count,
        payment_details: row.payment_details,
        status: 'completed',
        created_at: row.first_payment_date,
        paid_at: row.last_payment_date,
        contact: {
          contact_id: row.contact_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone,
          attribution_ad_id: row.attribution_ad_id
        }
      }))
    } catch (error) {
      console.error('Error getting sales details:', error)
      throw error
    }
  }

  // Obtener ventas atribuidas (SOLO CON ATTRIBUTION_AD_ID) - Total lifetime value
  async getSalesDetailsAttributed(startDate, endDate) {
    try {
      const result = await databasePool.query(`
        WITH attributed_clients AS (
          -- Primero identificar clientes atribuidos creados en el período
          SELECT DISTINCT c.contact_id
          FROM contacts c
          WHERE c.created_at >= $1 AND c.created_at <= $2
            AND c.attribution_ad_id IS NOT NULL
            -- Validar con ventana de atribución de 3 días
            AND EXISTS (
              SELECT 1 FROM meta.meta_ads ma
              WHERE ma.ad_id = c.attribution_ad_id
                AND (
                  ma.date::date = c.created_at::date
                  OR (
                    ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                    AND ma.date::date <= c.created_at::date
                  )
                )
            )
        ),
        client_lifetime_sales AS (
          -- Obtener TODOS los pagos de estos clientes (lifetime value)
          SELECT 
            c.contact_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.attribution_ad_id,
            c.created_at as contact_created_at,
            MIN(COALESCE(p.paid_at, p.created_at)) as first_payment_date,
            MAX(COALESCE(p.paid_at, p.created_at)) as last_payment_date,
            SUM(p.amount) as total_lifetime_value,
            COUNT(p.id) as total_payments,
            -- Array de todos los pagos para detalle
            ARRAY_AGG(
              json_build_object(
                'amount', p.amount,
                'date', COALESCE(p.paid_at, p.created_at)
              ) ORDER BY COALESCE(p.paid_at, p.created_at) DESC
            ) as payment_details
          FROM attributed_clients ac
          INNER JOIN contacts c ON ac.contact_id = c.contact_id
          INNER JOIN payments p ON c.contact_id = p.contact_id
          WHERE p.status = 'completed'
          GROUP BY c.contact_id, c.first_name, c.last_name, c.email, c.phone, c.attribution_ad_id, c.created_at
        )
        SELECT * FROM client_lifetime_sales
        ORDER BY contact_created_at DESC
      `, [startDate, endDate])
      
      return result.rows.map(row => ({
        id: row.contact_id, // Usar contact_id como ID único
        contact_id: row.contact_id,
        amount: parseFloat(row.total_lifetime_value), // Total lifetime value
        payment_count: row.total_payments,
        payment_details: row.payment_details,
        status: 'completed',
        created_at: row.first_payment_date,
        paid_at: row.last_payment_date,
        contact: {
          contact_id: row.contact_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone,
          attribution_ad_id: row.attribution_ad_id
        }
      }))
    } catch (error) {
      console.error('Error getting attributed sales details:', error)
      throw error
    }
  }

  // Obtener leads detallados (TODOS)
  async getLeadsDetails(startDate, endDate) {
    try {
      const result = await databasePool.query(`
        SELECT 
          contact_id,
          first_name,
          last_name,
          email,
          phone,
          status,
          created_at,
          attribution_ad_id
        FROM contacts
        WHERE created_at >= $1 AND created_at <= $2
        ORDER BY created_at DESC
      `, [startDate, endDate])
      
      return result.rows
    } catch (error) {
      console.error('Error getting leads details:', error)
      throw error
    }
  }

  // Obtener leads atribuidos (SOLO CON ATTRIBUTION_AD_ID)
  async getLeadsDetailsAttributed(startDate, endDate) {
    try {
      const result = await databasePool.query(`
        SELECT 
          c.contact_id,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.status,
          c.created_at,
          c.attribution_ad_id
        FROM contacts c
        WHERE c.created_at >= $1 AND c.created_at <= $2
          AND c.attribution_ad_id IS NOT NULL
          -- Validar con ventana de atribución de 3 días
          AND EXISTS (
            SELECT 1 FROM meta.meta_ads ma
            WHERE ma.ad_id = c.attribution_ad_id
              AND (
                ma.date::date = c.created_at::date
                OR (
                  ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                  AND ma.date::date <= c.created_at::date
                )
              )
          )
        ORDER BY c.created_at DESC
      `, [startDate, endDate])
      
      return result.rows
    } catch (error) {
      console.error('Error getting attributed leads details:', error)
      throw error
    }
  }

  // Obtener citas detalladas (TODOS)
  async getAppointmentsDetails(startDate, endDate) {
    try {
      const result = await databasePool.query(`
        SELECT 
          a.id,
          a.contact_id,
          a.created_at,
          a.metadata,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.attribution_ad_id
        FROM appointments a
        LEFT JOIN contacts c ON a.contact_id = c.contact_id
        WHERE a.created_at >= $1 AND a.created_at <= $2
        ORDER BY a.created_at DESC
      `, [startDate, endDate])
      
      return result.rows.map(row => ({
        id: row.id,
        contact_id: row.contact_id,
        appointment_date: row.created_at, // Usar created_at como fecha de cita
        created_at: row.created_at,
        status: 'scheduled', // Estado por defecto
        contact: row.first_name ? {
          contact_id: row.contact_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone,
          attribution_ad_id: row.attribution_ad_id
        } : null
      }))
    } catch (error) {
      console.error('Error getting appointments details:', error)
      throw error
    }
  }

  // Obtener citas atribuidas (usando fecha de creación del CONTACTO para Last Attribution)
  async getAppointmentsDetailsAttributed(startDate, endDate) {
    try {
      const result = await databasePool.query(`
        SELECT 
          a.id,
          a.contact_id,
          a.created_at,
          a.metadata,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.attribution_ad_id
        FROM appointments a
        JOIN contacts c ON a.contact_id = c.contact_id
        WHERE c.created_at >= $1 AND c.created_at <= $2
          AND c.attribution_ad_id IS NOT NULL
          -- Validar con ventana de atribución de 3 días
          AND EXISTS (
            SELECT 1 FROM meta.meta_ads ma
            WHERE ma.ad_id = c.attribution_ad_id
              AND (
                ma.date::date = c.created_at::date
                OR (
                  ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                  AND ma.date::date <= c.created_at::date
                )
              )
          )
        ORDER BY a.created_at DESC
      `, [startDate, endDate])
      
      return result.rows.map(row => ({
        id: row.id,
        contact_id: row.contact_id,
        appointment_date: row.created_at, // Usar created_at como fecha de cita
        created_at: row.created_at,
        status: 'scheduled', // Estado por defecto
        contact: {
          contact_id: row.contact_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone,
          attribution_ad_id: row.attribution_ad_id
        }
      }))
    } catch (error) {
      console.error('Error getting attributed appointments details:', error)
      throw error
    }
  }

  // Obtener clientes nuevos (TODOS) - con primer pago en el período
  async getNewCustomersDetails(startDate, endDate) {
    try {
      const result = await databasePool.query(`
        WITH first_payments AS (
          SELECT 
            c.contact_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.attribution_ad_id,
            c.created_at as contact_created_at,
            MIN(COALESCE(p.paid_at, p.created_at)) as first_payment_date,
            SUM(p.amount) as total_amount,
            COUNT(p.id) as payment_count
          FROM contacts c
          INNER JOIN payments p ON c.contact_id = p.contact_id
          WHERE p.status = 'completed'
          GROUP BY c.contact_id, c.first_name, c.last_name, c.email, c.phone, c.attribution_ad_id, c.created_at
          HAVING MIN(COALESCE(p.paid_at, p.created_at)) >= $1 
            AND MIN(COALESCE(p.paid_at, p.created_at)) <= $2
        )
        SELECT * FROM first_payments
        ORDER BY first_payment_date DESC
      `, [startDate, endDate])
      
      return result.rows.map(row => ({
        contact_id: row.contact_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: row.phone,
        created_at: row.contact_created_at,
        status: 'client',
        attribution_ad_id: row.attribution_ad_id,
        first_payment_date: row.first_payment_date,
        total_amount: parseFloat(row.total_amount),
        payment_count: row.payment_count
      }))
    } catch (error) {
      console.error('Error getting new customers details:', error)
      throw error
    }
  }

  // Obtener clientes nuevos atribuidos - contactos con attribution_ad_id creados en el período QUE TIENEN PAGOS
  async getNewCustomersDetailsAttributed(startDate, endDate) {
    try {
      const result = await databasePool.query(`
        WITH attributed_customers AS (
          SELECT 
            c.contact_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.attribution_ad_id,
            c.created_at as contact_created_at,
            MIN(COALESCE(p.paid_at, p.created_at)) as first_payment_date,
            SUM(p.amount) as total_amount,
            COUNT(p.id) as payment_count
          FROM contacts c
          INNER JOIN payments p ON c.contact_id = p.contact_id
          WHERE c.created_at >= $1 AND c.created_at <= $2
            AND c.attribution_ad_id IS NOT NULL
            AND p.status = 'completed'
            -- Validar con ventana de atribución de 3 días
            AND EXISTS (
              SELECT 1 FROM meta.meta_ads ma
              WHERE ma.ad_id = c.attribution_ad_id
                AND (
                  ma.date::date = c.created_at::date
                  OR (
                    ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                    AND ma.date::date <= c.created_at::date
                  )
                )
            )
          GROUP BY c.contact_id, c.first_name, c.last_name, c.email, c.phone, c.attribution_ad_id, c.created_at
        )
        SELECT * FROM attributed_customers
        ORDER BY contact_created_at DESC
      `, [startDate, endDate])
      
      return result.rows.map(row => ({
        contact_id: row.contact_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: row.phone,
        created_at: row.contact_created_at,
        status: 'client',
        attribution_ad_id: row.attribution_ad_id,
        first_payment_date: row.first_payment_date,
        total_amount: parseFloat(row.total_amount),
        payment_count: row.payment_count
      }))
    } catch (error) {
      console.error('Error getting attributed new customers details:', error)
      throw error
    }
  }
}

module.exports = new ReportsService()

