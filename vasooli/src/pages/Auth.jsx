import { useState } from 'react'
import { supabase, usernameToEmail, USERNAME_RULE } from '../supabaseClient'

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  function switchMode(next) {
    setMode(next)
    setError('')
    setNotice('')
  }

  const [usernameTouched, setUsernameTouched] = useState(false)
  const [upiId, setUpiId] = useState('')

  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s_]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 20)
  }

  function handleDisplayNameChange(value) {
    setDisplayName(value)
    if (!usernameTouched) setUsername(slugify(value))
  }

  function handleUsernameChange(value) {
    setUsernameTouched(true)
    setUsername(value.replace(/\s/g, ''))
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError('')
    const uname = username.trim().toLowerCase()
    if (!USERNAME_RULE.test(uname)) {
      return setError('Username: 3–20 characters, lowercase letters, numbers or underscores.')
    }
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (email.trim() && !EMAIL_RULE.test(email.trim())) {
      return setError("That email address doesn't look right.")
    }

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim() || usernameToEmail(uname),
      password,
      options: {
        data: { username: uname, display_name: displayName.trim() || uname },
      },
    })

    if (!error && data.user && upiId.trim()) {
      await supabase.from('profiles').update({ upi_id: upiId.trim() }).eq('id', data.user.id)
    }

    setBusy(false)
    if (error) {
      setError(
        error.message.toLowerCase().includes('already')
          ? 'That username (or email) is already taken.'
          : error.message
      )
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    const uname = username.trim().toLowerCase()
    if (!uname || !password) return setError('Enter your username and password.')

    setBusy(true)
    const { data: loginEmail, error: lookupError } = await supabase.rpc('get_login_email', {
      p_username: uname,
    })
    if (lookupError || !loginEmail) {
      setBusy(false)
      return setError('No account with that username.')
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    setBusy(false)
    if (error) setError('Wrong username or password.')
  }

  async function handleForgot(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    const uname = username.trim().toLowerCase()
    if (!uname) return setError('Enter your username.')

    setBusy(true)
    const { data: loginEmail, error: lookupError } = await supabase.rpc('get_login_email', {
      p_username: uname,
    })
    setBusy(false)
    if (lookupError || !loginEmail) return setError('No account with that username.')

    if (loginEmail.endsWith('@users.vasooli.app')) {
      return setError(
        'No recovery email on file for this account. Ask your group admin to reset your password for you.'
      )
    }

    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: window.location.origin,
    })
    setBusy(false)
    if (error) return setError(error.message)
    setNotice(`Reset link sent to the email on file for @${uname}. Check that inbox.`)
  }

  return (
    <div className="screen center">
      <div className="card">
        <h1 className="brand">Vasooli</h1>
        <p className="subtitle">Settle up without the spreadsheet.</p>

        {mode !== 'forgot' && (
          <div className="tab-row">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
              Log in
            </button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>
              Sign up
            </button>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="stack">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
              placeholder="slayerr"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
            />
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Just a sec…' : 'Log in'}
            </button>
            <button type="button" className="btn-link mt" onClick={() => switchMode('forgot')}>
              Forgot password?
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="stack">
            <label>Your name</label>
            <input
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              placeholder="Slayer"
              autoComplete="name"
            />
            <label>Login name <span className="faint">(auto-filled — only edit if it's taken)</span></label>
            <input
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="slayer"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
            />
            <label>Email <span className="faint">(optional — lets you reset your password yourself)</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <label>UPI ID <span className="faint">(optional — lets friends pay you directly)</span></label>
            <input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@oksbi"
              autoCapitalize="none"
            />
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Just a sec…' : 'Create account'}
            </button>
            <p className="hint small">
              Your username is how friends add you to a group, so pick something they'll recognise.
            </p>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="stack">
            <p className="hint">Enter your username and we'll email a reset link, if you added one at signup.</p>
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
              autoCapitalize="none"
              autoCorrect="off"
            />
            {error && <p className="error">{error}</p>}
            {notice && <p className="success">{notice}</p>}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <button type="button" className="btn-link mt" onClick={() => switchMode('login')}>
              ← Back to log in
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
