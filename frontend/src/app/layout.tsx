import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Michi — ソウル旅プランナー",
  description: "好みと条件から、実在するソウルの場所で旅程をつくります。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <a className="skip-link" href="#main-content">本文へ移動</a>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/" aria-label="Michi ホーム">
              <span className="brand-mark" aria-hidden="true">M</span>
              <span>Michi</span>
            </Link>
            <span className="city-label">SEOUL ONLY</span>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <p>実在する場所データと条件にもとづく、説明できる旅程。</p>
        </footer>
      </body>
    </html>
  );
}
