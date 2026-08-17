import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'STARRYZ 5 | Mide tu Popularidad en el Campus',
  description: 'Descubre y mide la popularidad de alumnos e instituciones educativas.',
  openGraph: {
    title: 'STARRYZ 5 | Mide tu Popularidad en el Campus',
    description: 'Descubre y mide la popularidad de alumnos e instituciones educativas.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'STARRYZ 5 | Mide tu Popularidad en el Campus',
    description: 'Descubre y mide la popularidad de alumnos e instituciones educativas.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
