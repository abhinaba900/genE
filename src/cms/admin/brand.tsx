/* eslint-disable @next/next/no-img-element -- the admin shell renders these outside next/image's optimiser. */

// Film posters for the login panel: static files in /public, served small (≈7 KB AVIF each)
// through Next's image optimiser.
const POSTERS = [
  "indian-startup-turns-plastic-waste-into-wood",
  "engineer-builds-a-forest-on-a-terrace-in-the-middle",
  "this-company-is-turning-landfills-back-into-landscapes",
  "inside-bengaluru-s-airport-terminal-in-a-garden",
  "this-city-in-tamil-nadu-is-using-roads-to-save-water-instead",
  "cng-scooter-vs-ev-scooter",
  "sustainability-meets-slow-living-in-hyderabad",
  "making-drinking-water-free-of-microplastics-pesticides",
  "an-aadhaar-card-for-garbage",
  "why-indian-men-should-learn-to-talk-about-periods",
  "india-has-a-high-fever-and-el-nino-is-to-blame",
  "this-place-is-where-india-finds-out-how-to-turn-waste",
];
const poster = (slug: string) => `/_next/image?url=${encodeURIComponent(`/media/posters/${slug}.jpg`)}&w=280&q=75`;

/**
 * gen.E login screen: an editorial panel of the site's films beside the sign-in form.
 * Payload renders this as the login "Logo"; `display: contents` in custom.css lets the panel
 * and heading join the form in one split-screen grid (`.login .template-minimal__wrap`).
 */
export function LoginLogo() {
  return (
    <div className="gene-login">
      <aside className="gene-login__panel" aria-hidden>
        <div className="gene-login__posters">
          {POSTERS.map((slug) => (
            <img key={slug} src={poster(slug)} alt="" width={280} height={498} decoding="async" />
          ))}
        </div>
        <div className="gene-login__panel-copy">
          <img src="/brand/gen-e-mark.png" alt="" width={44} height={44} className="gene-login__mark" />
          <p className="gene-login__tagline">
            Watch the story. <em>Explore the details.</em>
          </p>
          <p className="gene-login__panel-note">The newsroom behind gen.E’s films and reporting.</p>
        </div>
      </aside>

      <div className="gene-login__head">
        <img src="/brand/gen-e-logo.png" alt="gen.E" width={960} height={298} className="gene-login__logo" />
        <span className="gene-login__badge">Editorial CMS</span>
        <h1 className="gene-login__title">Welcome back</h1>
        <p className="gene-login__lede">Sign in to write, edit and publish stories.</p>
      </div>
    </div>
  );
}

/** Compact gen.E mark in the admin header and nav. */
export function NavIcon() {
  return <img src="/brand/gen-e-mark.png" alt="gen.E" width={28} height={28} className="gene-nav-icon" />;
}
