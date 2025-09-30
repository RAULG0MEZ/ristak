const metaService = require('../services/meta.service')
const { getMetaTokenRefreshService } = require('../services/meta-token-refresh.service')

async function startOAuth(req, res) {
  try {
    const state = (req.query.state || '').toString()
    const url = metaService.getLoginUrl(state)
    // Redirect browser to FB login
    res.redirect(url)
  } catch (err) {
    console.error('startOAuth error:', err)
    res.status(500).json({ error: { code: 'meta_oauth_start_failed', message: err.message } })
  }
}

async function oauthCallback(req, res) {
  try {
    const { code } = req.query
    if (!code) return res.status(400).send('Missing code')

    await metaService.exchangeCodeForToken(code)
    // Return a simple page that notifies opener and closes the popup
    res.set('Content-Type', 'text/html')
    res.send(`<!DOCTYPE html><html><body>
      <script>
        try { window.opener && window.opener.postMessage({ source: 'ristak', type: 'meta-oauth-success' }, '*'); } catch (e) {}
        window.close();
      </script>
      Conexión completada. Puedes cerrar esta ventana.
    </body></html>`)
  } catch (err) {
    console.error('oauthCallback error:', err)
    res.set('Content-Type', 'text/html')
    res.status(500).send(`<!DOCTYPE html><html><body>
      <p>Error en conexión: ${err.message}</p>
      <script>try { window.opener && window.opener.postMessage({ source: 'ristak', type: 'meta-oauth-error', message: ${JSON.stringify(err.message)} }, '*'); } catch (e) {}</script>
    </body></html>`)
  }
}

async function getConfig(req, res) {
  try {
    const cfg = await metaService.getConfig()
    // Do not expose access_token
    if (cfg) delete cfg.access_token
    res.json({ data: cfg || null })
  } catch (err) {
    res.status(500).json({ error: { code: 'meta_get_config_failed', message: err.message } })
  }
}

async function listAdAccounts(req, res) {
  try {
    const accounts = await metaService.getAdAccounts()
    res.json({ data: accounts })
  } catch (err) {
    res.status(500).json({ error: { code: 'meta_list_ad_accounts_failed', message: err.message } })
  }
}

async function listPixels(req, res) {
  try {
    const { ad_account_id } = req.query
    if (!ad_account_id) return res.status(400).json({ error: { code: 'validation_error', message: 'ad_account_id is required' } })
    const pixels = await metaService.getPixelsForAccount(String(ad_account_id))
    res.json({ data: pixels })
  } catch (err) {
    res.status(500).json({ error: { code: 'meta_list_pixels_failed', message: err.message } })
  }
}

async function configure(req, res) {
  try {
    const { adAccountId, adAccountName, pixelId, pixelName, sinceDate, schedule } = req.body || {}
    if (!adAccountId || !pixelId || !sinceDate || !schedule) {
      return res.status(400).json({ error: { code: 'validation_error', message: 'Missing required fields' } })
    }

    // Configure will now handle clearing DB, scheduling, and initial sync
    await metaService.configure({ adAccountId, adAccountName, pixelId, pixelName, sinceDate, schedule })
    res.status(202).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: { code: 'meta_configure_failed', message: err.message } })
  }
}

async function manualSync(req, res) {
  try {
    // Manual sync should be incremental (false) - only updates last 3 days
    // Initial sync happens automatically in configure()
    const result = await metaService.startSync(false)
    res.status(202).json({ ok: true, result })
  } catch (err) {
    res.status(500).json({ error: { code: 'meta_sync_failed', message: err.message } })
  }
}

async function syncStatus(req, res) {
  try {
    const status = metaService.getStatus()
    res.json({ data: status })
  } catch (err) {
    res.status(500).json({ error: { code: 'meta_sync_status_failed', message: err.message } })
  }
}

async function disconnect(req, res) {
  try {
    const result = await metaService.disconnect()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: { code: 'meta_disconnect_failed', message: err.message } })
  }
}

async function initSchema(req, res) {
  try {
    await metaService.ensureTables()
    res.json({ success: true, message: 'Meta schema initialized successfully' })
  } catch (err) {
    res.status(500).json({ error: { code: 'meta_init_schema_failed', message: err.message } })
  }
}

// FUNCIONES PARA MANEJO DE TOKENS DE META/FACEBOOK
async function getTokenStatus(req, res) {
  try {
    const tokenService = getMetaTokenRefreshService()
    const status = await tokenService.getMetaTokenStatus()

    // Agregar información adicional para el usuario
    if (status.configured) {
      if (status.requiresReauth) {
        status.message = '⚠️ El token de Meta requiere re-autenticación. El usuario debe volver a conectar su cuenta de Facebook.'
      } else if (status.isExpired) {
        status.message = '❌ El token de Meta ha expirado.'
      } else if (status.requiresRefresh) {
        status.message = `⚠️ El token de Meta expira pronto (en ${status.daysUntilExpiry} días). Se renovará automáticamente.`
      } else {
        status.message = `✅ Token de Meta válido. Expira en ${status.daysUntilExpiry} días.`
      }
    }

    res.json({ success: true, data: status })
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'meta_token_status_failed',
        message: err.message
      }
    })
  }
}

async function refreshToken(req, res) {
  try {
    const tokenService = getMetaTokenRefreshService()

    // Verificar primero el estado del token
    const status = await tokenService.getMetaTokenStatus()

    if (!status.configured) {
      return res.status(400).json({
        error: {
          code: 'meta_not_configured',
          message: 'Meta no está configurado. Conecta primero tu cuenta de Facebook.'
        }
      })
    }

    if (status.requiresReauth) {
      return res.status(400).json({
        error: {
          code: 'meta_reauth_required',
          message: 'El token requiere re-autenticación completa. El usuario debe volver a conectar su cuenta de Facebook.'
        }
      })
    }

    // Intentar renovar el token
    await tokenService.forceMetaTokenRefresh()

    res.json({
      success: true,
      message: 'Token de Meta renovado exitosamente',
      data: await tokenService.getMetaTokenStatus()
    })
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'meta_token_refresh_failed',
        message: `Error renovando token: ${err.message}`
      }
    })
  }
}

module.exports = {
  startOAuth,
  oauthCallback,
  getConfig,
  listAdAccounts,
  listPixels,
  configure,
  manualSync,
  syncStatus,
  disconnect,
  initSchema,
  getTokenStatus,
  refreshToken,
}
