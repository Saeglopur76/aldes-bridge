import { useEffect, useState } from 'react'
import { getProducts, sendCommand } from '../api'
import type { AldesProduct, DeviceProfile } from '../types'
import { fmtParis } from '../parisTime'
import styles from './TempsPanel.module.css'

interface Props {
  pollMs?: number
  clientId?: string | null
  connected?: boolean
  profile?: DeviceProfile | null
}

function fmtDeg(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : v.toFixed(1) + ' °C'
}
function fmtNum(v: number | null | undefined, unit: string): string {
  return v === null || v === undefined ? '—' : `${v} ${unit}`
}

export default function VmcPanel({ pollMs = 5000, clientId, connected, profile }: Props) {
  const [products, setProducts] = useState<AldesProduct[]>([])
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setInterval> | null = null
    const poll = async () => {
      try {
        const p = await getProducts()
        if (alive) setProducts(p)
      } catch {
        /* silencieux, retenté au prochain poll */
      }
    }
    poll()
    timer = setInterval(poll, pollMs)
    return () => { alive = false; if (timer) clearInterval(timer) }
  }, [pollMs])

  const canSend = !!connected && !!clientId
  const modes = profile?.air_modes ?? []

  const setSpeed = async (code: string) => {
    if (!canSend) return
    const payload = JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'changeMode', params: [code] })
    setSending(code)
    try {
      await sendCommand(`devices/${clientId}/messages/devicebound`, payload, 1)
    } catch (e) {
      alert(`échec envoi ${code} : ${(e as Error).message}`)
    } finally {
      setSending(null)
    }
  }

  if (products.length === 0) {
    return <div className={styles.panel}><div className={styles.empty}>Aucune télémétrie pour l'instant.</div></div>
  }

  return (
    <div className={styles.panel}>
      {products.map((p) => {
        const v = p.indicator.ventilation
        return (
          <div key={p.serial_number} className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.name}>{p.name}</div>
                <div className={styles.sub}>{p.modem} · {p.serial_number}</div>
              </div>
              <span className={styles.badge + ' ' + (p.isConnected ? styles.on : styles.off)}>
                {p.isConnected ? '● connectée' : '○ hors ligne'}
              </span>
            </div>

            <div className={styles.quickGroup}>
              <div className={styles.quick}>
                <span className={styles.quickLabel}>Vitesse</span>
                {modes.map((m) => (
                  <button
                    key={m.code}
                    className={styles.quickBtn + (p.indicator.current_air_mode === m.code ? ' ' + styles.active : '')}
                    onClick={() => setSpeed(m.code)}
                    disabled={!canSend || sending !== null}
                    title={`changeMode ["${m.code}"]`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Température extérieure</span>
                <span className={styles.statValue}>{fmtDeg(v?.outside_temp)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Température extraction</span>
                <span className={styles.statValue}>{fmtDeg(v?.extract_temp)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Température rejet</span>
                <span className={styles.statValue}>{fmtDeg(v?.reject_temp)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Vitesse extraction</span>
                <span className={styles.statValue}>{fmtNum(v?.extract_speed, 'tr/min')}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Vitesse insufflation</span>
                <span className={styles.statValue}>{fmtNum(v?.supply_speed, 'tr/min')}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Débit extraction</span>
                <span className={styles.statValue}>{fmtNum(v?.extract_flow, 'm³/h')}</span>
              </div>
            </div>

            <div className={styles.foot}>
              {p.updatedAt ? <span>mise à jour : {fmtParis(p.updatedAt)} (Paris)</span> : 'pas encore de données'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
