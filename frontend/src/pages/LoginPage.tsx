import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { clearMeCache, login } from '../lib/api'
import { getJurisdiction, setAccessToken, setJurisdiction, type Jurisdiction } from '../lib/auth'

export function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('admin@local')
  const [password, setPassword] = useState('admin1234')
  const [jurisdiction, setJuris] = useState<Jurisdiction>(getJurisdiction() ?? 'EU')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="min-h-full bg-transparent">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-12 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-950/30 px-3 py-1 text-xs font-semibold text-slate-100 shadow-chrome">
            <ShieldCheck size={14} className="text-softblue" />
            Secure reconciliation workspace
          </div>
          <div className="text-3xl font-semibold tracking-tight text-ink">
            Holding Reconciliation Platform
          </div>
          <div className="max-w-md text-sm leading-6 text-slate-600">
            Upload internal and counterparty files, validate previews, and build reconciliations with a
            clean audit-ready workflow.
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/25 px-5 py-4 shadow-chrome">
            <div className="text-xs font-semibold text-shellSub">Dev credentials</div>
            <div className="mt-2 text-sm text-slate-200">
              Email: <span className="font-mono">admin@local</span>
              <br />
              Password: <span className="font-mono">admin1234</span>
            </div>
          </div>
        </div>

        <Card title="Sign in" subtitle="Use your platform credentials to continue.">
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              setLoading(true)
              try {
                clearMeCache()
                const res = await login(email, password, jurisdiction)
                setAccessToken(res.accessToken)
                setJurisdiction((res.user.jurisdiction as Jurisdiction) ?? jurisdiction)
                nav('/', { replace: true })
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Login failed')
              } finally {
                setLoading(false)
              }
            }}
          >
            <Field label="Email" required>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label="Jurisdiction" required hint="Select the region you want to work in.">
              <Select value={jurisdiction} onChange={(e) => setJuris(e.target.value as Jurisdiction)}>
                <option value="ALL">ALL</option>
                <option value="EU">EU</option>
                <option value="US">US</option>
                <option value="ME">ME</option>
                <option value="ASIA">ASIA</option>
                <option value="HK">HK</option>
              </Select>
            </Field>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <Button disabled={loading} type="submit" className="w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

