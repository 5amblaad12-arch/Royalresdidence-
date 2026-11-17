import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap section" style={{ textAlign: "center" }}>
      <div className="cap">Page not found</div>
      <h1 className="mt16" style={{ fontSize: 44 }}>This page drifted down the Nile.</h1>
      <p className="lead mt16">The link may be old or mistyped.</p>
      <div className="row mt32" style={{ justifyContent: "center" }}><Link className="btn btn-navy" href="/">Back to the residence</Link><Link className="btn btn-ghost" href="/book">Book your stay</Link></div>
    </main>
  );
}
