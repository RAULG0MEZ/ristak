const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../../.env.local') })
const { databasePool } = require('../config/database.config')
// Fetch polyfill for Node < 18
let _fetch = globalThis.fetch
const fetch = async (...args) => {
  if (_fetch) return _fetch(...args)
  // Dynamic import for CommonJS compatibility with node-fetch v3 (ESM-only)
  const mod = await import('node-fetch')
  return mod.default(...args)
}
const { encrypt, decrypt } = require('../utils/crypto.util')

const GRAPH_VER = process.env.META_GRAPH_VERSION || 'v23.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VER}`

class MetaService {
  constructor() {
    this.syncState = {
      running: false,
      startedAt: null,
      processed: 0,
      total: null,
      message: null,
    }
    this.intervalHandle = null
    
    // Ensure tables exist
    this.ensureTables().catch(err => {
      console.error('Failed to ensure meta tables:', err)
    })
    
    // Check if we need to schedule jobs after database is ready
    setTimeout(() => {
      this.checkAndScheduleJobs()
    }, 5000)
  }

  async ensureTables() {
    // Create meta schema if it doesn't exist
    await databasePool.query(`CREATE SCHEMA IF NOT EXISTS meta`)
    
    // Create meta_config table in meta schema
    await databasePool.query(`
      CREATE TABLE IF NOT EXISTS meta.meta_config (
        id SERIAL PRIMARY KEY,
        access_token TEXT,
        token_expires_at TIMESTAMPTZ,
        meta_user_id TEXT,
        meta_user_name TEXT,
        ad_account_id TEXT,
        ad_account_name TEXT,
        pixel_id TEXT,
        pixel_name TEXT,
        pixel_capi_token TEXT,
        since_date DATE,
        schedule TEXT DEFAULT '24h',
        sync_status TEXT DEFAULT 'idle',
        last_sync_at TIMESTAMPTZ,
        last_sync_error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `)
    // Create meta_ads table in meta schema
    await databasePool.query(`
      CREATE TABLE IF NOT EXISTS meta.meta_ads (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        campaign_id TEXT,
        campaign_name TEXT,
        adset_id TEXT,
        adset_name TEXT,
        ad_id TEXT,
        ad_name TEXT,
        spend DECIMAL(10,2),
        reach INTEGER,
        clicks INTEGER,
        cpc DECIMAL(10,4),
        ad_account_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)
    
    // Create indexes for better performance
    await databasePool.query(`
      CREATE INDEX IF NOT EXISTS idx_meta_ads_date ON meta.meta_ads(date);
      CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON meta.meta_ads(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_meta_ads_account ON meta.meta_ads(ad_account_id);
    `)
  }

  getRedirectUri() {
    // First check for explicit redirect URI
    const explicit = process.env.META_REDIRECT_URI
    if (explicit) return explicit
    
    // Use API_BASE_URL if available
    const apiBaseUrl = process.env.API_BASE_URL
    if (apiBaseUrl) {
      return `${apiBaseUrl}/meta/oauth/callback`
    }
    
    // Fallback to localhost with configurable port
    const port = process.env.API_PORT || 3002
    return `http://localhost:${port}/api/meta/oauth/callback`
  }

  getLoginUrl(state) {
    const clientId = process.env.META_APP_ID
    if (!clientId) throw new Error('META_APP_ID is required')
    const redirectUri = encodeURIComponent(this.getRedirectUri())
    const scope = encodeURIComponent([
      'ads_read',
      'ads_management',
      'business_management',
      'pages_read_engagement',
      'read_insights',
      'public_profile',
      'email',
    ].join(','))
    const stateParam = encodeURIComponent(state || '')
    return `https://www.facebook.com/${GRAPH_VER}/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${stateParam}`
  }

  async exchangeCodeForToken(code) {
    const clientId = process.env.META_APP_ID
    const clientSecret = process.env.META_APP_SECRET
    const redirectUri = this.getRedirectUri()
    if (!clientId || !clientSecret) throw new Error('META credentials missing')

    // Preserve existing configuration before updating
    const existingConfig = await this.getConfig()
    const preserveFields = {}

    // Keep existing configuration if it exists
    if (existingConfig) {
      if (existingConfig.ad_account_id) preserveFields.ad_account_id = existingConfig.ad_account_id
      if (existingConfig.ad_account_name) preserveFields.ad_account_name = existingConfig.ad_account_name
      if (existingConfig.pixel_id) preserveFields.pixel_id = existingConfig.pixel_id
      if (existingConfig.pixel_name) preserveFields.pixel_name = existingConfig.pixel_name
      if (existingConfig.since_date) preserveFields.since_date = existingConfig.since_date
      if (existingConfig.schedule) preserveFields.schedule = existingConfig.schedule

      // Preserve encrypted pixel CAPI token if it exists
      if (existingConfig.pixel_capi_token) {
        preserveFields.pixel_capi_token = encrypt(existingConfig.pixel_capi_token)
      }
    }

    const url = `${GRAPH_BASE}/oauth/access_token?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${encodeURIComponent(clientSecret)}&code=${encodeURIComponent(code)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
    const data = await res.json()
    // Long-lived token
    const longUrl = `${GRAPH_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&fb_exchange_token=${encodeURIComponent(data.access_token)}`
    const res2 = await fetch(longUrl)
    if (!res2.ok) throw new Error(`Long-lived token exchange failed: ${res2.status}`)
    const data2 = await res2.json()

    const meRes = await fetch(`${GRAPH_BASE}/me?fields=id,name&access_token=${encodeURIComponent(data2.access_token)}`)
    if (!meRes.ok) throw new Error(`Fetching user failed: ${meRes.status}`)
    const me = await meRes.json()

    const expiresInSec = data2.expires_in ? parseInt(data2.expires_in) : null
    const expiresAt = expiresInSec ? new Date(Date.now() + expiresInSec * 1000) : null

    // Update token and user info, but preserve existing configuration
    await this.upsertConfig({
      access_token: encrypt(data2.access_token),
      token_expires_at: expiresAt ? expiresAt.toISOString() : null,
      meta_user_id: me.id,
      meta_user_name: me.name,
      ...preserveFields // Spread preserved fields to maintain existing configuration
    })

    // If we had a complete configuration before, restore the sync schedule
    if (preserveFields.ad_account_id && preserveFields.schedule && preserveFields.since_date) {
      console.log('OAuth completed - restoring previous sync schedule with existing configuration')
      await this.setupSchedule()
    }

    return { user: me }
  }

  async upsertConfig(partial) {
    // Upsert single row (id=1) in meta schema
    const fields = Object.keys(partial)
    const values = Object.values(partial)
    const set = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
    const now = new Date().toISOString()
    if (fields.length === 0) return
    await databasePool.query(
      `INSERT INTO meta.meta_config (id, ${fields.join(', ')}, created_at, updated_at)
       VALUES (1, ${values.map((_, i) => `$${i + 1}`).join(', ')}, $${values.length + 1}, $${values.length + 2})
       ON CONFLICT (id) DO UPDATE SET ${set}, updated_at = EXCLUDED.updated_at`,
      [...values, now, now]
    )
  }

  async getConfig() {
    const { rows } = await databasePool.query('SELECT * FROM meta.meta_config WHERE id = 1 LIMIT 1')
    if (!rows.length) return null
    const row = rows[0]
    return {
      ...row,
      access_token: row.access_token ? decrypt(row.access_token) : null,
      pixel_capi_token: row.pixel_capi_token ? decrypt(row.pixel_capi_token) : null,
    }
  }
  
  async getCapiToken() {
    const cfg = await this.getConfig()
    return cfg?.pixel_capi_token || cfg?.access_token || null
  }

  async disconnect() {
    // Stop any scheduled sync
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    
    // Clear sync state
    this.syncState = {
      running: false,
      startedAt: null,
      processed: 0,
      total: null,
      message: null,
    }
    
    // Delete all meta data from meta schema
    await databasePool.query('BEGIN')
    try {
      // Delete ads data
      await databasePool.query('DELETE FROM meta.meta_ads')
      // Delete config
      await databasePool.query('DELETE FROM meta.meta_config WHERE id = 1')
      await databasePool.query('COMMIT')
      return { success: true, message: 'Meta account disconnected successfully' }
    } catch (err) {
      await databasePool.query('ROLLBACK')
      throw new Error(`Failed to disconnect: ${err.message}`)
    }
  }

  async getAdAccounts() {
    const cfg = await this.getConfig()
    if (!cfg?.access_token) throw new Error('Meta not connected')
    const url = `${GRAPH_BASE}/me/adaccounts?fields=id,account_id,name,account_status&limit=100&access_token=${encodeURIComponent(cfg.access_token)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`adaccounts fetch failed: ${res.status}`)
    const data = await res.json()
    return data.data || []
  }

  async getPixelsForAccount(adAccountId) {
    const cfg = await this.getConfig()
    if (!cfg?.access_token) throw new Error('Meta not connected')
    const act = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
    const url = `${GRAPH_BASE}/${act}/adspixels?fields=id,name,code&limit=200&access_token=${encodeURIComponent(cfg.access_token)}`
    const res = await fetch(url)
    if (!res.ok) {
      const errorData = await res.text()
      console.error(`Pixels fetch failed for ${act}:`, errorData)
      // Try alternative endpoint or return empty if no access
      if (res.status === 400 || res.status === 403) {
        // Account might not have pixels or no permission
        return []
      }
      throw new Error(`pixels fetch failed: ${res.status}`)
    }
    const data = await res.json()
    return data.data || []
  }

  async setupSchedule() {
    // Clear any existing schedule
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    
    const cfg = await this.getConfig()
    if (!cfg?.schedule || !cfg?.access_token || !cfg?.ad_account_id) {
      return
    }
    
    const ms = this.scheduleToMs(cfg.schedule)
    if (!ms) return
    
    // Set up the interval for INCREMENTAL syncs (only last 3 days)
    this.intervalHandle = setInterval(() => {
      this.startSync(false).catch(err => console.error('Meta incremental sync error:', err))
    }, ms)
    
    // Run incremental sync immediately if needed
    if (cfg.last_sync_at) {
      const lastSync = new Date(cfg.last_sync_at).getTime()
      if (Date.now() - lastSync > ms) {
        this.startSync(false).catch(err => console.error('Scheduled incremental sync error:', err))
      }
    }
  }
  
  async checkAndScheduleJobs() {
    try {
      const cfg = await this.getConfig()
      if (cfg?.access_token && cfg?.ad_account_id && cfg?.schedule) {
        await this.setupSchedule()
      }
    } catch (err) {
      console.error('Failed to check Meta Ads configuration:', err)
    }
  }

  scheduleToMs(s) {
    const map = { '1h': 3600000, '3h': 10800000, '6h': 21600000, '12h': 43200000, '24h': 86400000 }
    return map[s] || null
  }

  async configure({ adAccountId, adAccountName, pixelId, pixelName, sinceDate, schedule }) {
    // Check if this is a significant configuration change
    const existingConfig = await this.getConfig()
    const isNewAccount = !existingConfig?.ad_account_id || existingConfig.ad_account_id !== adAccountId
    const isNewPixel = !existingConfig?.pixel_id || existingConfig.pixel_id !== pixelId
    const isNewDateRange = !existingConfig?.since_date || existingConfig.since_date !== sinceDate

    // Only do initial sync if account, pixel or date range changed significantly
    const needsInitialSync = isNewAccount || isNewPixel || isNewDateRange

    // Generate CAPI token for the pixel
    let pixelCapiToken = null
    if (pixelId) {
      const cfg = await this.getConfig()
      if (cfg?.access_token) {
        try {
          // The access token itself can be used as CAPI token for server events
          // We store it encrypted separately for CAPI use
          pixelCapiToken = encrypt(cfg.access_token)
        } catch (err) {
          console.error('Failed to generate CAPI token:', err)
        }
      }
    }

    // Update configuration in credentials table
    await this.upsertConfig({
      ad_account_id: adAccountId,
      ad_account_name: adAccountName,
      pixel_id: pixelId,
      pixel_name: pixelName,
      pixel_capi_token: pixelCapiToken,
      since_date: sinceDate,
      schedule
    })

    // Schedule periodic sync
    await this.setupSchedule()

    if (needsInitialSync) {
      // Start INITIAL sync with the new configuration (will clear all and fetch from since_date)
      console.log('Configuration changed significantly - starting initial sync...')
      this.startSync(true).catch(err => console.error('Initial sync failed:', err))
    } else {
      // Just do an incremental sync to update recent data
      console.log('Configuration updated - running incremental sync for recent data...')
      this.startSync(false).catch(err => console.error('Incremental sync failed:', err))
    }
  }

  getStatus() {
    const { running, startedAt, processed, total, message } = this.syncState
    return { running, startedAt, processed, total, message }
  }

  async startSync(isInitial = false) {
    if (this.syncState.running) return { alreadyRunning: true }
    const cfg = await this.getConfig()
    if (!cfg?.access_token || !cfg?.ad_account_id) throw new Error('Meta not configured')
    
    // Use the configured since_date, not a default
    if (!cfg.since_date) {
      throw new Error('Since date not configured')
    }
    
    // Determine date range based on sync type
    let since, until
    
    if (isInitial) {
      // INITIAL SYNC: Full sync from configured date
      since = new Date(cfg.since_date)
      until = new Date()
      console.log(`Starting INITIAL sync from ${since.toISOString().slice(0, 10)} to ${until.toISOString().slice(0, 10)}`)
      
      // Delete ALL data for fresh start
      await databasePool.query('BEGIN')
      await databasePool.query('DELETE FROM meta.meta_ads')
      await databasePool.query('COMMIT')
      console.log('Cleared all existing meta ads data for initial sync')
    } else {
      // INCREMENTAL SYNC: Only last 3 days
      until = new Date()
      since = new Date()
      since.setDate(since.getDate() - 3) // 3 days back for safety
      console.log(`Starting INCREMENTAL sync from ${since.toISOString().slice(0, 10)} to ${until.toISOString().slice(0, 10)}`)
      
      // Delete only last 3 days to refresh with new data
      await databasePool.query('BEGIN')
      await databasePool.query(
        'DELETE FROM meta.meta_ads WHERE date >= $1',
        [since.toISOString().slice(0, 10)]
      )
      await databasePool.query('COMMIT')
      console.log(`Cleared data from ${since.toISOString().slice(0, 10)} for incremental update`)
    }

    this.syncState = { running: true, startedAt: new Date().toISOString(), processed: 0, total: null, message: 'Fetching insights' }
    await this.upsertConfig({ sync_status: 'running', last_sync_error: null })

    try {

      // 2) Split date range into monthly chunks to avoid API limits
      const allRows = []
      const currentDate = new Date(since)
      const endDate = new Date(until)
      
      // Process month by month
      while (currentDate <= endDate) {
        // Calculate chunk end date (end of current month or endDate, whichever is earlier)
        const chunkEnd = new Date(currentDate)
        chunkEnd.setMonth(chunkEnd.getMonth() + 1)
        chunkEnd.setDate(0) // Last day of the month
        
        const chunkEndDate = chunkEnd > endDate ? endDate : chunkEnd
        
        const timeRange = JSON.stringify({
          since: currentDate.toISOString().slice(0, 10),
          until: chunkEndDate.toISOString().slice(0, 10)
        })
        
        console.log(`Fetching data for period: ${currentDate.toISOString().slice(0, 10)} to ${chunkEndDate.toISOString().slice(0, 10)}`)
        this.syncState.message = `Fetching ${currentDate.toISOString().slice(0, 7)}...`
        
        const fields = ['date_start', 'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name', 'spend', 'reach', 'clicks', 'cpc']
        const base = `${GRAPH_BASE}/act_${cfg.ad_account_id}/insights?level=ad&time_increment=1&fields=${encodeURIComponent(fields.join(','))}&time_range=${encodeURIComponent(timeRange)}&limit=500&access_token=${encodeURIComponent(cfg.access_token)}`
        
        let url = base
        const monthRows = []
        
        // Paginate through results for this month
        while (url) {
          const res = await fetch(url)
          if (!res.ok) {
            const errorText = await res.text()
            console.error(`Insights API error (${res.status}) for ${currentDate.toISOString().slice(0, 7)}:`, errorText)
            
            // Skip this month if there's an error but continue with others
            if (res.status === 400 || res.status === 500 || res.status === 503) {
              console.log(`Skipping ${currentDate.toISOString().slice(0, 7)} due to API error`)
              break
            }
            throw new Error(`insights fetch failed: ${res.status}`)
          }
          
          const data = await res.json()
          const batch = data.data || []
          monthRows.push(...batch)
          
          // Check for next page
          url = data.paging?.next || null
          
          // Add small delay between pages to avoid rate limiting
          if (url) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        allRows.push(...monthRows)
        this.syncState.processed = allRows.length
        console.log(`Fetched ${monthRows.length} rows for ${currentDate.toISOString().slice(0, 7)}`)
        
        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1)
        currentDate.setDate(1) // First day of next month
        
        // Small delay between months to avoid rate limiting
        if (currentDate <= endDate) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      this.syncState.total = allRows.length
      this.syncState.message = 'Inserting rows'
      console.log(`Total rows fetched: ${allRows.length}`)

      // 3) bulk insert in very small chunks to avoid timeouts
      const chunkSize = 25 // Much smaller chunks to avoid DB timeout
      const toDecimal = (v) => v == null ? null : Number(v)
      let insertedCount = 0
      
      for (let i = 0; i < allRows.length; i += chunkSize) {
        const part = allRows.slice(i, i + chunkSize)
        const values = []
        const params = []
        
        part.forEach((r, idx) => {
          const d = r.date_start
          const spend = toDecimal(r.spend) || 0
          const reach = parseInt(r.reach || '0', 10)
          const clicks = parseInt(r.clicks || '0', 10)
          const cpc = r.cpc != null ? toDecimal(r.cpc) : null
          params.push(d, r.campaign_id, r.campaign_name, r.adset_id, r.adset_name, r.ad_id, r.ad_name, spend, reach, clicks, cpc, cfg.ad_account_id)
          const baseIndex = idx * 12
          values.push(`($${baseIndex + 1}::date, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12})`)
        })
        
        if (values.length) {
          try {
            // Use a separate transaction for each chunk to avoid long-running transactions
            await databasePool.query('BEGIN')
            await databasePool.query(
              `INSERT INTO meta.meta_ads (
                date, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, spend, reach, clicks, cpc, ad_account_id
              ) VALUES ${values.join(', ')}`,
              params
            )
            await databasePool.query('COMMIT')
            insertedCount += part.length
            console.log(`Inserted batch: ${insertedCount}/${allRows.length} rows`)
          } catch (insertErr) {
            await databasePool.query('ROLLBACK').catch(() => {})
            console.error(`Failed to insert batch ${i}-${i + chunkSize}:`, insertErr.message)
            // Continue with next batch instead of failing completely
          }
        }
        
        this.syncState.message = `Inserted ${insertedCount} of ${allRows.length} rows`
        
        // Small delay between batches to avoid overwhelming the DB
        if (i + chunkSize < allRows.length) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
      
      // Update the total with actual inserted count
      this.syncState.total = insertedCount

      await this.upsertConfig({ sync_status: 'idle', last_sync_at: new Date().toISOString(), last_sync_error: null })
      this.syncState = { running: false, startedAt: this.syncState.startedAt, processed: this.syncState.processed, total: this.syncState.total, message: 'Done' }
      console.log(`Sync completed successfully. Inserted ${this.syncState.total || 0} rows`)
      return { inserted: this.syncState.total || 0 }
    } catch (err) {
      console.error('Meta sync failed:', err)
      await databasePool.query('ROLLBACK').catch(() => {})
      await this.upsertConfig({ sync_status: 'idle', last_sync_error: err.message })
      this.syncState = { running: false, startedAt: this.syncState.startedAt, processed: 0, total: 0, message: `Error: ${err.message}` }
      throw err
    }
  }
}

module.exports = new MetaService()
