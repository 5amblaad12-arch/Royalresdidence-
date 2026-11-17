"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap section" style={{ textAlign: "center" }}>
      <h1 style={{ fontSize: 40 }}>Something went wrong</h1>
      <p className="lead mt16">Please try again. If it keeps happening, message us on WhatsApp.</p>
      <button className="btn btn-navy mt32" type="button" onClick={() => reset()}>Try again</button>
    </main>
  );
}
