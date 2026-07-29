import { useState } from 'react'
import { supabase, usernameToEmail, USERNAME_RULE } from '../supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const uname = username.trim().toLowerCase()
    if (!USERNAME_RULE.test(uname)) {
      setError('Username: 3–20 characters, lowercase letters, numbers or underscores.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setBusy(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: usernameToEmail(uname),
        password,
        options: {
          data: { username: uname, display_name: displayName.trim() || uname },
        },
      })
      setBusy(false)
      if (error) {
        setError(
          error.message.toLowerCase().includes('already')
            ? 'That username is taken. Try another.'
            : error.message
        )
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(uname),
        password,
      })
      setBusy(false)
      if (error) setError('Wrong username or password.')
    }
  }

  return (
    <div className="screen center">
      <div className="card">
        <h1 className="brand">Vasooli</h1>
        <p className="subtitle">Settle up without the spreadsheet.</p>

        <div className="tab-row">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => { setMode('login'); setError('') }}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => { setMode('signup'); setError('') }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
            placeholder="slayerr"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
          />

          {mode === 'signup' && (
            <>
              <label>Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Slayer"
                autoComplete="name"
              />
            </>
          )}

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Just a sec…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="hint small">
            Your username is how friends add you to a group, so pick something they'll recognise.
          </p>
        )}
      </div>
    </div>
  )
}
