/* eslint-disable @next/next/no-img-element -- the admin shell renders these outside next/image's optimiser. */

/** gen.E logo on the CMS login screen. */
export function LoginLogo() {
  return (
    <div className="gene-login-logo">
      <img src="/brand/gen-e-logo.png" alt="gen.E" width={960} height={298} className="gene-login-logo__img" />
      <span className="gene-login-logo__label">Editorial CMS</span>
    </div>
  );
}

/** Compact gen.E mark in the admin header and nav. */
export function NavIcon() {
  return <img src="/brand/gen-e-mark.png" alt="gen.E" width={28} height={28} className="gene-nav-icon" />;
}
