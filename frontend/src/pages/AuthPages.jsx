import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import { Logo, Msg } from "../components.jsx";

function useForm(path, init) {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState(init);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { const r = await api(path, { method: "POST", body: f }); signIn(r.token, r.user); nav(r.user.role === "ngo" ? "/ngo" : r.user.role === "admin" ? "/admin" : "/"); }
    catch (ex) { setErr(ex.message); }
  };
  return { f, set, submit, err };
}

export function Login() {
  const { f, set, submit, err } = useForm("/auth/login/", { username: "", password: "" });
  return (
    <div className="auth-shell">
      <div className="auth-story">
        <Link to="/" className="auth-brand"><Logo /><span>Trust<b>Give</b></span></Link>
        <div className="auth-story-copy">
          <span className="eyebrow">Give with confidence</span>
          <h1>Every contribution should create visible change.</h1>
          <p>Follow verified campaigns, see how funds are used, and keep your impact in one trusted place.</p>
        </div>
        <div className="auth-proof"><span>✓</span><div><strong>Transparent by design</strong><small>Every donation is recorded and traceable.</small></div></div>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-heading"><span className="eyebrow">Welcome back</span><h2>Log in to TrustGive</h2><p>Continue making a meaningful difference.</p></div>
        <label>Username</label><input value={f.username} onChange={set("username")} autoComplete="username" required />
        <label>Password</label><input type="password" value={f.password} onChange={set("password")} autoComplete="current-password" required />
        <button className="btn full">Log in</button><Msg error={err} />
        <p className="auth-switch">New to TrustGive? <Link to="/register">Create an account</Link></p>
      </form>
    </div>
  );
}

export function Register() {
  const { f, set, submit, err } = useForm("/auth/register/", { username: "", email: "", password: "", role: "donor", ngo_name: "", location: "" });
  return (
    <form className="auth-card auth-card-register" onSubmit={submit}>
      <Link to="/" className="auth-brand auth-brand-mobile"><Logo /><span>Trust<b>Give</b></span></Link>
      <div className="auth-heading"><span className="eyebrow">Join the movement</span><h2>Create your account</h2><p>Start supporting causes that matter to you.</p></div>
      <label>I am a</label>
      <select value={f.role} onChange={set("role")}><option value="donor">Donor</option><option value="ngo">NGO</option></select>
      <label>Username</label><input value={f.username} onChange={set("username")} autoComplete="username" required />
      <label>Email address</label><input type="email" value={f.email} onChange={set("email")} autoComplete="email" required />
      <label>Password <span className="label-hint">Minimum 8 characters</span></label><input type="password" value={f.password} onChange={set("password")} autoComplete="new-password" required minLength={8} />
      {f.role === "ngo" && (<><label>Organisation name</label><input value={f.ngo_name} onChange={set("ngo_name")} required />
        <label>Location</label><input value={f.location} onChange={set("location")} /></>)}
      <button className="btn full">Create account</button><Msg error={err} />
      <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
    </form>
  );
}
