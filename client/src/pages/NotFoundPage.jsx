import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, MapPin, Wrench } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <main className="not-found-page">
      <header className="not-found-header">
        <Link to="/" className="not-found-brand" aria-label="Akazi home">akazi<span>.</span></Link>
        <span className="not-found-meta">FIELD NOTE 04 / PAGE NOT FOUND</span>
      </header>

      <div className="not-found-content">
        <section className="not-found-copy">
          <p className="not-found-eyebrow"><span /> ROUTE INTERRUPTED</p>
          <h1>This path is<br />under <em>repair.</em></h1>
          <p className="not-found-description">
            The page you were looking for has wandered off the map. Let’s get you back to the work that matters.
          </p>
          <div className="not-found-actions">
            <Link to="/" className="not-found-home"><ArrowLeft size={17} /> Back to home</Link>
            <Link to="/jobs" className="not-found-jobs">Explore open jobs <ArrowUpRight size={17} /></Link>
          </div>
        </section>

        <div className="route-illustration" aria-hidden="true">
          <div className="route-coordinate route-coordinate-top">AKZ / 404</div>
          <div className="route-orbit route-orbit-one" />
          <div className="route-orbit route-orbit-two" />
          <div className="route-dash route-dash-one" />
          <div className="route-dash route-dash-two" />
          <div className="route-marker"><MapPin size={25} strokeWidth={1.7} /></div>
          <div className="route-sign">
            <span className="route-sign-code">404</span>
            <span className="route-sign-label">NO SUCH<br />DESTINATION</span>
            <span className="route-sign-tool"><Wrench size={21} strokeWidth={1.8} /></span>
          </div>
          <div className="route-coordinate route-coordinate-bottom">RWANDA · KEEP GOING</div>
          <div className="route-stamp">DETOUR<br />AHEAD</div>
        </div>
      </div>

      <footer className="not-found-footer">
        <span>AKAZI / A BETTER ROUTE TO WORK</span>
        <span>01°56' S&nbsp;&nbsp; 30°04' E</span>
      </footer>
    </main>
  );
}