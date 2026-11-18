import React from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { Logo } from "./components.jsx";
import Campaigns from "./pages/Campaigns.jsx";
import CampaignDetail from "./pages/CampaignDetail.jsx";
import { Login, Register } from "./pages/AuthPages.jsx";
import MyDonations from "./pages/MyDonations.jsx";
import NgoDashboard from "./pages/NgoDashboard.jsx";
import Ledger from "./pages/Ledger.jsx";
import Analytics from "./pages/Analytics.jsx";
import AdminReview from "./pages/AdminReview.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AccessDenied from "./pages/AccessDenied.jsx";
import ProfileSettings from "./pages/ProfileSettings.jsx";

// Guard component: protects routes based on role(s)
// roles: undefined = any authenticated user; string/array = specific roles only
function Guard({ roles, children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;

  const allowed = !roles
    ? true
    : Array.isArray(roles)
    ? roles.includes(user.role)
    : user.role === roles;

  if (!allowed) return <AccessDenied />;
  return children;
}

function Nav() {
  const { user, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const profileRef = React.useRef(null);
  React.useEffect(() => {
    const close = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <header className="nav">
      <Link to="/" className="brand"><Logo /><span>Trust<b>Give</b></span></Link>
      <nav>
        <NavLink to="/" end>Campaigns</NavLink>
        <NavLink to="/analytics">Transparency</NavLink>
        <NavLink to="/ledger">Ledger</NavLink>
        {/* Role-based nav links */}
        {user?.role === "donor" && <NavLink to="/my-donations">My Donations</NavLink>}
        {user?.role === "ngo" && <NavLink to="/ngo">NGO Dashboard</NavLink>}
        {user?.role === "admin" && <>
          <NavLink to="/admin/dashboard">Admin Dashboard</NavLink>
          <NavLink to="/admin">Fraud Review</NavLink>
        </>}
      </nav>
      <div className="who">
        {user ? (
          <div className="profile" ref={profileRef}>
            <button className="avatar" title="Open profile" aria-label="Open profile menu"
              aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}>
              {user.username[0]}
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <div className="profile-name">{user.username}</div>
                <div className="profile-email">{user.email || "No email added"}</div>
                <div className="profile-role-badge"
                  style={{ fontSize: ".75rem", padding: "2px 8px", color: "var(--muted)", marginTop: 4 }}>
                  {user.role === "ngo" ? "NGO" : user.role === "admin" ? "Administrator" : "Donor"}
                </div>
                <Link className="btn ghost profile-settings-link" to="/profile"
                  onClick={() => setProfileOpen(false)}>Profile settings</Link>
                <button className="btn ghost profile-signout" onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        ) : (
          <><Link className="btn ghost" to="/login">Log in</Link><Link className="btn" to="/register">Sign up</Link></>
        )}
      </div>
    </header>
  );
}

function BackToTop() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return show ? (
    <button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top">↑</button>
  ) : null;
}

const Page = ({ children }) => <div className="page padded">{children}</div>;

function SiteFooter() {
  const { pathname } = useLocation();
  if (["/login", "/register", "/profile"].includes(pathname)) return null;
  return (
    <footer className="foot">
      <div className="foot-in">
        <div className="foot-main">
          <div className="foot-about">
            <Link to="/" className="foot-brand"><Logo /><span>Trust<b>Give</b></span></Link>
            <p>A transparent record for donations, campaigns, and programme spending.</p>
            <span className="foot-status"><i />Ledger verified and monitored</span>
          </div>
          <div className="foot-column">
            <h4>Explore</h4>
            <Link to="/">Campaigns</Link>
            <Link to="/analytics">Transparency</Link>
            <Link to="/ledger">Public ledger</Link>
          </div>
          <div className="foot-column">
            <h4>Get involved</h4>
            <Link to="/register">Create an account</Link>
            <Link to="/login">Log in</Link>
            <Link to="/register">Start a campaign</Link>
          </div>
          <div className="foot-note">
            <span className="foot-mark">◆</span>
            <p>Built for people who want to see where their giving goes.</p>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 TrustGive</span>
          <span>AI-screened · Hash-chained · Human impact</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<Page><CampaignDetail /></Page>} />
          <Route path="/login" element={<Page><Login /></Page>} />
          <Route path="/register" element={<Page><Register /></Page>} />
          <Route path="/ledger" element={<Page><Ledger /></Page>} />
          <Route path="/analytics" element={<Page><Analytics /></Page>} />

          {/* Any authenticated user */}
          <Route path="/profile" element={<Page><Guard><ProfileSettings /></Guard></Page>} />

          {/* Donor-only */}
          <Route path="/my-donations"
            element={<Page><Guard roles="donor"><MyDonations /></Guard></Page>} />

          {/* NGO-only */}
          <Route path="/ngo"
            element={<Page><Guard roles="ngo"><NgoDashboard /></Guard></Page>} />

          {/* Admin-only */}
          <Route path="/admin"
            element={<Page><Guard roles="admin"><AdminReview /></Guard></Page>} />
          <Route path="/admin/dashboard"
            element={<Page><Guard roles="admin"><AdminDashboard /></Guard></Page>} />

          {/* Catch-all: redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BackToTop />
      <SiteFooter />
    </>
  );
}
