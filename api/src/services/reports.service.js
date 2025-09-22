const { databasePool } = require('../config/database.config');
const { checkMetaAdsTableExists, queryMetaAdsIfExists } = require('../utils/meta-helper');
const { adjustDateRange } = require('../utils/date-helper');

class ReportsService {
  async getMetrics(startDate, endDate, groupBy = 'month') {
    // Ajustar fechas para incluir todo el día
    const adjusted = adjustDateRange(startDate, endDate);
    startDate = adjusted.startDate;
    endDate = adjusted.endDate;
    // PESTAÑA "TODOS": Datos reales de actividad en el período seleccionado
    // Sin filtros de atribución - incluye TODOS los contactos
    const unit = ['day', 'month', 'year'].includes(groupBy) ? groupBy : 'month'
    try {
      // Check if meta_ads table exists first
      let adsPromise;
      try {
        const checkAds = await databasePool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'meta'
            AND table_name = 'meta_ads'
          )`
        );
        const hasAdsTable = checkAds.rows[0].exists;

        if (hasAdsTable) {
          adsPromise = databasePool.query(
            `SELECT DATE_TRUNC($3, date) AS period,
                    COALESCE(SUM(spend),0)   AS spend,
                    COALESCE(SUM(reach),0)   AS reach,
                    COALESCE(SUM(clicks),0)  AS clicks
             FROM meta.meta_ads
             WHERE date >= $1 AND date <= $2
             GROUP BY period
             ORDER BY period`,
            [startDate, endDate, unit]
          );
        } else {
          // Return empty result if table doesn't exist
          adsPromise = Promise.resolve({ rows: [] });
        }
      } catch (e) {
        // If error checking, return empty result
        adsPromise = Promise.resolve({ rows: [] });
      }

      // Parallel queries by source
      const [ads, sessions, contacts, appointments, payments, newCustomers] = await Promise.all([
        adsPromise,
        // Visitantes únicos desde tracking.sessions
        databasePool.query(
          `SELECT DATE_TRUNC($3, started_at) AS period,
                  COUNT(DISTINCT visitor_id) AS visitors
           FROM tracking.sessions
           WHERE started_at >= $1 AND started_at <= $2
             AND visitor_id IS NOT NULL
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        // TODOS los contactos creados en el período (sin importar rstk_adid)
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
    // Ajustar fechas para incluir todo el día
    const adjusted = adjustDateRange(startDate, endDate);
    startDate = adjusted.startDate;
    endDate = adjusted.endDate;
    // PESTAÑA "ATRIBUIDOS": Solo contactos con rstk_adid
    // Usa Last Attribution - TODO se basa en la fecha de creación del contacto
    const unit = ['day', 'month', 'year'].includes(groupBy) ? groupBy : 'month'
    try {
      // Check if meta_ads table exists
      const hasAdsTable = await checkMetaAdsTableExists();

      const [ads, sessions, contacts, appointments, payments, newCustomers] = await Promise.all([
        // Gastos de Meta Ads - use helper
        queryMetaAdsIfExists(
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
        // Visitantes únicos desde tracking.sessions (sin filtro de atribución)
        databasePool.query(
          `SELECT DATE_TRUNC($3, started_at) AS period,
                  COUNT(DISTINCT visitor_id) AS visitors
           FROM tracking.sessions
           WHERE started_at >= $1 AND started_at <= $2
             AND visitor_id IS NOT NULL
           GROUP BY period
           ORDER BY period`,
          [startDate, endDate, unit]
        ),
        // Solo contactos con rstk_adid Y que coincidan con anuncio activo
        databasePool.query(
          `SELECT DATE_TRUNC($3, c.created_at) AS period,
                  COUNT(*) AS leads
           FROM contacts c
           WHERE c.created_at >= $1 AND c.created_at <= $2
             AND c.rstk_adid IS NOT NULL
             -- Validar con ventana de atribución de 3 días
             AND EXISTS (
               SELECT 1 FROM meta.meta_ads ma
               WHERE ma.ad_id = c.rstk_adid
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
             AND c.rstk_adid IS NOT NULL
             -- Validar con ventana de atribución de 3 días
             AND EXISTS (
               SELECT 1 FROM meta.meta_ads ma
               WHERE ma.ad_id = c.rstk_adid
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
             AND c.rstk_adid IS NOT NULL
             -- Validar con ventana de atribución de 3 días
             AND EXISTS (
               SELECT 1 FROM meta.meta_ads ma
               WHERE ma.ad_id = c.rstk_adid
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
        // Clientes nuevos: contactos con rstk_adid creados en el período QUE TIENEN PAGOS
        databasePool.query(
          `SELECT DATE_TRUNC($3, c.created_at) AS period,
                  COUNT(DISTINCT c.contact_id) AS new_customers
           FROM contacts c
           WHERE c.created_at >= $1 AND c.created_at <= $2
             AND c.rstk_adid IS NOT NULL
             -- Solo contar los que tienen pagos completados (son clientes reales)
             AND EXISTS (
               SELECT 1 FROM payments p 
               WHERE p.contact_id = c.contact_id 
               AND p.status = 'completed'
             )
             -- Validar con ventana de atribución de 3 días
             AND EXISTS (
               SELECT 1 FROM meta.meta_ads ma
               WHERE ma.ad_id = c.rstk_adid
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
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
      const result = await databasePool.query(`
        WITH client_sales AS (
          SELECT
            c.contact_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.rstk_adid,
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
          GROUP BY c.contact_id, c.first_name, c.last_name, c.email, c.phone, c.rstk_adid, c.created_at
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
          rstk_adid: row.rstk_adid
        }
      }))
    } catch (error) {
      console.error('Error getting sales details:', error)
      throw error
    }
  }

  // Obtener ventas atribuidas (SOLO CON rstk_adid) - Total lifetime value
  async getSalesDetailsAttributed(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
      const result = await databasePool.query(`
        WITH attributed_clients AS (
          -- Primero identificar clientes atribuidos creados en el período
          SELECT DISTINCT c.contact_id
          FROM contacts c
          WHERE c.created_at >= $1 AND c.created_at <= $2
            AND c.rstk_adid IS NOT NULL
            -- Validar con ventana de atribución de 3 días
            AND EXISTS (
              SELECT 1 FROM meta.meta_ads ma
              WHERE ma.ad_id = c.rstk_adid
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
            c.rstk_adid,
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
          GROUP BY c.contact_id, c.first_name, c.last_name, c.email, c.phone, c.rstk_adid, c.created_at
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
          rstk_adid: row.rstk_adid
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
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
      const result = await databasePool.query(`
        SELECT
          contact_id,
          first_name,
          last_name,
          email,
          phone,
          status,
          created_at,
          rstk_adid
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

  // Obtener leads atribuidos (SOLO CON rstk_adid)
  async getLeadsDetailsAttributed(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
      const result = await databasePool.query(`
        SELECT
          c.contact_id,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.status,
          c.created_at,
          c.rstk_adid
        FROM contacts c
        WHERE c.created_at >= $1 AND c.created_at <= $2
          AND c.rstk_adid IS NOT NULL
          -- Validar con ventana de atribución de 3 días
          AND EXISTS (
            SELECT 1 FROM meta.meta_ads ma
            WHERE ma.ad_id = c.rstk_adid
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
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
      const result = await databasePool.query(`
        SELECT
          MIN(a.appointment_id) as id,
          a.contact_id,
          MIN(a.created_at) as created_at,
          MIN(a.appointment_date) as appointment_date,
          COUNT(a.appointment_id) as appointment_count,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.rstk_adid
        FROM appointments a
        LEFT JOIN contacts c ON a.contact_id = c.contact_id
        WHERE a.created_at >= $1 AND a.created_at <= $2
        GROUP BY a.contact_id, c.first_name, c.last_name, c.email, c.phone, c.rstk_adid
        ORDER BY MIN(a.created_at) DESC
      `, [startDate, endDate])

      return result.rows.map(row => ({
        id: row.id,
        contact_id: row.contact_id,
        appointment_date: row.appointment_date || row.created_at, // Usar appointment_date o created_at
        created_at: row.created_at,
        status: 'scheduled', // Estado por defecto
        appointment_count: parseInt(row.appointment_count) || 1, // Número total de citas del contacto
        contact: {
          contact_id: row.contact_id,
          first_name: row.first_name || '',
          last_name: row.last_name || '',
          email: row.email || '',
          phone: row.phone || '',
          rstk_adid: row.rstk_adid
        }
      }))
    } catch (error) {
      console.error('Error getting appointments details:', error)
      throw error
    }
  }

  // Obtener citas atribuidas (usando fecha de creación del CONTACTO para Last Attribution)
  async getAppointmentsDetailsAttributed(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
      const result = await databasePool.query(`
        SELECT
          MIN(a.appointment_id) as id,
          a.contact_id,
          MIN(a.created_at) as created_at,
          MIN(a.appointment_date) as appointment_date,
          COUNT(a.appointment_id) as appointment_count,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.rstk_adid
        FROM appointments a
        JOIN contacts c ON a.contact_id = c.contact_id
        WHERE c.created_at >= $1 AND c.created_at <= $2
          AND c.rstk_adid IS NOT NULL
          -- Validar con ventana de atribución de 3 días
          AND EXISTS (
            SELECT 1 FROM meta.meta_ads ma
            WHERE ma.ad_id = c.rstk_adid
              AND (
                ma.date::date = c.created_at::date
                OR (
                  ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                  AND ma.date::date <= c.created_at::date
                )
              )
          )
        GROUP BY a.contact_id, c.first_name, c.last_name, c.email, c.phone, c.rstk_adid
        ORDER BY MIN(a.created_at) DESC
      `, [startDate, endDate])

      return result.rows.map(row => ({
        id: row.id,
        contact_id: row.contact_id,
        appointment_date: row.appointment_date || row.created_at, // Usar appointment_date o created_at
        created_at: row.created_at,
        status: 'scheduled', // Estado por defecto
        appointment_count: parseInt(row.appointment_count) || 1, // Número total de citas del contacto
        contact: {
          contact_id: row.contact_id,
          first_name: row.first_name || '',
          last_name: row.last_name || '',
          email: row.email || '',
          phone: row.phone || '',
          rstk_adid: row.rstk_adid
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
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
      const result = await databasePool.query(`
        WITH first_payments AS (
          SELECT
            c.contact_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.rstk_adid,
            c.created_at as contact_created_at,
            MIN(COALESCE(p.paid_at, p.created_at)) as first_payment_date,
            SUM(p.amount) as total_amount,
            COUNT(p.id) as payment_count
          FROM contacts c
          INNER JOIN payments p ON c.contact_id = p.contact_id
          WHERE p.status = 'completed'
          GROUP BY c.contact_id, c.first_name, c.last_name, c.email, c.phone, c.rstk_adid, c.created_at
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
        rstk_adid: row.rstk_adid,
        first_payment_date: row.first_payment_date,
        total_amount: parseFloat(row.total_amount),
        payment_count: row.payment_count
      }))
    } catch (error) {
      console.error('Error getting new customers details:', error)
      throw error
    }
  }

  // Obtener clientes nuevos atribuidos - contactos con rstk_adid creados en el período QUE TIENEN PAGOS
  async getNewCustomersDetailsAttributed(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
      const result = await databasePool.query(`
        WITH attributed_customers AS (
          SELECT
            c.contact_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.rstk_adid,
            c.created_at as contact_created_at,
            MIN(COALESCE(p.paid_at, p.created_at)) as first_payment_date,
            SUM(p.amount) as total_amount,
            COUNT(p.id) as payment_count
          FROM contacts c
          INNER JOIN payments p ON c.contact_id = p.contact_id
          WHERE c.created_at >= $1 AND c.created_at <= $2
            AND c.rstk_adid IS NOT NULL
            AND p.status = 'completed'
            -- Validar con ventana de atribución de 3 días
            AND EXISTS (
              SELECT 1 FROM meta.meta_ads ma
              WHERE ma.ad_id = c.rstk_adid
                AND (
                  ma.date::date = c.created_at::date
                  OR (
                    ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                    AND ma.date::date <= c.created_at::date
                  )
                )
            )
          GROUP BY c.contact_id, c.first_name, c.last_name, c.email, c.phone, c.rstk_adid, c.created_at
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
        rstk_adid: row.rstk_adid,
        first_payment_date: row.first_payment_date,
        total_amount: parseFloat(row.total_amount),
        payment_count: row.payment_count
      }))
    } catch (error) {
      console.error('Error getting attributed new customers details:', error)
      throw error
    }
  }

  // Summary metrics for reports with trends
  async getReportsMetrics(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      const adjustedStartDate = adjusted.startDate;
      const adjustedEndDate = adjusted.endDate;
      // Calculate the previous period for comparison
      const periodLength = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const previousEndDate = new Date(startDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodLength + 1);

      // Query for current period metrics
      const currentMetricsQuery = `
        WITH revenue_stats AS (
          SELECT
            COALESCE(SUM(amount), 0) as total_revenue
          FROM payments
          WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) <= $2 AND status = 'completed'
        ),
        expense_stats AS (
          SELECT
            COALESCE(SUM(spend), 0) as total_spend
          FROM meta.meta_ads
          WHERE date >= $1 AND date <= $2
        ),
        customer_stats AS (
          SELECT
            COUNT(DISTINCT p.contact_id) as new_customers
          FROM payments p
          WHERE COALESCE(p.paid_at, p.created_at) >= $1 AND COALESCE(p.paid_at, p.created_at) <= $2 AND p.status = 'completed'
        ),
        lead_stats AS (
          SELECT
            COUNT(*) as total_leads
          FROM contacts
          WHERE created_at >= $1 AND created_at <= $2
        )
        SELECT
          r.total_revenue,
          e.total_spend,
          c.new_customers,
          l.total_leads,
          CASE
            WHEN e.total_spend > 0 THEN r.total_revenue / e.total_spend
            ELSE 0
          END as roas,
          CASE
            WHEN c.new_customers > 0 THEN r.total_revenue / c.new_customers
            ELSE 0
          END as avg_revenue_per_customer
        FROM revenue_stats r, expense_stats e, customer_stats c, lead_stats l
      `;

      // Query for previous period metrics (same structure)
      const previousMetricsQuery = currentMetricsQuery;

      const [currentResult, previousResult] = await Promise.all([
        databasePool.query(currentMetricsQuery, [startDate, endDate]),
        databasePool.query(previousMetricsQuery, [previousStartDate, previousEndDate])
      ]);

      const current = currentResult.rows[0];
      const previous = previousResult.rows[0];

      // Calculate percentage changes
      const calculateChange = (current, previous) => {
        if (!previous || previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / Math.abs(previous)) * 100;
      };

      return {
        totalRevenue: parseFloat(current.total_revenue) || 0,
        totalSpend: parseFloat(current.total_spend) || 0,
        newCustomers: parseInt(current.new_customers) || 0,
        totalLeads: parseInt(current.total_leads) || 0,
        roas: parseFloat(current.roas) || 0,
        avgRevenuePerCustomer: parseFloat(current.avg_revenue_per_customer) || 0,
        trends: {
          totalRevenue: calculateChange(current.total_revenue, previous.total_revenue),
          totalSpend: calculateChange(current.total_spend, previous.total_spend),
          newCustomers: calculateChange(current.new_customers, previous.new_customers),
          totalLeads: calculateChange(current.total_leads, previous.total_leads),
          roas: calculateChange(current.roas, previous.roas),
          avgRevenuePerCustomer: calculateChange(current.avg_revenue_per_customer, previous.avg_revenue_per_customer)
        }
      };
    } catch (error) {
      console.error('Error getting reports metrics:', error);
      throw error;
    }
  }
}

module.exports = new ReportsService()

